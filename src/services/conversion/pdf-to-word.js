const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas, loadImage } = require('canvas');
const { Document, ImageRun, Packer, Paragraph, TextRun, Textbox } = require('docx');
const { extractPdfPages, renderPdfPagesAsImages, renderPdfPagesWithBrowser } = require('./renderer');
const { recognizeImageBuffer } = require('../ocr.service');

// Detects whether a line looks like a heading: short all-caps or large font.
function isHeadingLine(text, maxHeight) {
  if (!text || text.length < 2 || text.length > 100) return false;
  const isAllCaps = text === text.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(text);
  const isLargeFont = maxHeight >= 14;
  return isAllCaps || isLargeFont;
}

// Detects whether a line looks like a table row: multiple segments separated by large gaps.
function isTableRow(text) {
  return /\s{3,}/.test(text);
}

// Converts a table-like line into tab-separated text for better alignment in Word.
function normalizeTableRow(text) {
  return text.replace(/\s{3,}/g, '\t');
}

function countTextLines(pages) {
  return pages.reduce((total, page) => total + page.lines.filter((line) => line.text.trim()).length, 0);
}

function normalizeOcrLine(line) {
  return {
    text: String(line.text || '').trim(),
    maxHeight: line.bbox ? Math.max(8, Math.round((line.bbox.y1 - line.bbox.y0) / 2)) : 10,
  };
}

function pointsToInches(value) {
  return `${Math.max(0, Number(value || 0)) / 72}in`;
}

function hasPosition(line) {
  return [line.x, line.y, line.width, line.maxHeight].every(Number.isFinite);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbCss([r, g, b]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function sampleBackgroundColor(ctx, canvas, x, y, width, height) {
  const samples = [];
  const regions = [
    [x, y - 8, width, 5],
    [x, y + height + 3, width, 5],
    [x - 8, y, 5, height],
    [x + width + 3, y, 5, height],
  ];

  for (const [rx, ry, rw, rh] of regions) {
    const sx = clamp(Math.floor(rx), 0, canvas.width - 1);
    const sy = clamp(Math.floor(ry), 0, canvas.height - 1);
    const sw = clamp(Math.floor(rw), 1, canvas.width - sx);
    const sh = clamp(Math.floor(rh), 1, canvas.height - sy);
    if (sw <= 0 || sh <= 0) continue;
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] > 220) samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  if (!samples.length) return 'rgb(255, 255, 255)';
  const avg = samples.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
    .map((sum) => sum / samples.length);
  return rgbCss(avg);
}

function makeTextRun(line, sizePt) {
  const heading = isHeadingLine(line.text, line.maxHeight);
  return new TextRun({
    text: line.text,
    bold: heading || line.bold,
    size: Math.round(sizePt * 2),
    font: 'Arial',
  });
}

function textBoxForLine(line, pdfHeight, lineIndex, options = {}) {
  const sizePt = Math.max(7, Math.min(options.maxSize || 32, Number(line.maxHeight || 10)));
  const top = pdfHeight - Number(line.y || 0) - sizePt * 1.15;
  const width = Math.max(36, Number(line.width || 32) + Math.max(10, sizePt * 0.7));
  const height = Math.max(sizePt * 1.75, 13);

  return new Textbox({
    style: {
      position: 'absolute',
      left: pointsToInches(line.x),
      top: pointsToInches(top),
      width: pointsToInches(width),
      height: pointsToInches(height),
      wrapStyle: 'none',
      zIndex: String((options.zIndexBase || 10) + lineIndex),
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: Math.round(sizePt * 20), lineRule: 'exact' },
        children: [makeTextRun(line, sizePt)],
      }),
    ],
  });
}

function shouldUseHybridWord(pages, options = {}) {
  if (options.mode === 'hybrid') return true;
  if (options.mode === 'pdf2docx' || options.mode === 'layout') return false;
  if (options.autoHybrid !== true) return false;

  const complexPages = pages.filter((page) => {
    const pdfWidth = Number(page.pdfWidth || 0);
    const pdfHeight = Number(page.pdfHeight || 0);
    const positioned = page.lines.filter((line) => line.text && hasPosition(line));
    if (!positioned.length) return false;

    const sparse = positioned.length <= 38;
    const landscape = pdfWidth > pdfHeight;
    const largeText = positioned.some((line) => Number(line.maxHeight || 0) >= 16);
    const spreadColumns = positioned.some((line) => Number(line.x || 0) > pdfWidth * 0.48);
    const coversLittleText = positioned.reduce((sum, line) => sum + String(line.text || '').length, 0) < 1800;

    return landscape || (sparse && (largeText || spreadColumns || coversLittleText));
  }).length;

  return complexPages >= Math.max(1, Math.ceil(pages.length * 0.35));
}

async function eraseTextFromPageImage(pageImage, page) {
  const image = await loadImage(pageImage.buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const pdfWidth = Number(page.pdfWidth || pageImage.pdfWidth || 595.28);
  const pdfHeight = Number(page.pdfHeight || pageImage.pdfHeight || 841.89);
  const scaleX = image.width / pdfWidth;
  const scaleY = image.height / pdfHeight;

  for (const line of page.lines.filter((item) => item.text && hasPosition(item))) {
    const sizePt = Math.max(7, Math.min(36, Number(line.maxHeight || 10)));
    const padX = Math.max(2, sizePt * 0.2);
    const padY = Math.max(1.5, sizePt * 0.12);
    const x = clamp((Number(line.x || 0) - padX) * scaleX, 0, canvas.width - 1);
    const y = clamp((pdfHeight - Number(line.y || 0) - sizePt * 1.2 - padY) * scaleY, 0, canvas.height - 1);
    const width = clamp((Number(line.width || 32) + padX * 2) * scaleX, 1, canvas.width - x);
    const height = clamp((sizePt * 1.75 + padY * 2) * scaleY, 1, canvas.height - y);
    ctx.fillStyle = sampleBackgroundColor(ctx, canvas, x, y, width, height);
    ctx.fillRect(x, y, width, height);
  }

  return Buffer.from(canvas.toBuffer('image/png'));
}

async function convertWithPdf2Docx(document) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docflow-pdf2docx-'));
  const outputPath = path.join(tempDir, 'converted.docx');
  const script = [
    'import sys',
    'from pdf2docx import Converter',
    'pdf_path, docx_path = sys.argv[1], sys.argv[2]',
    'cv = Converter(pdf_path)',
    'try:',
    '    cv.convert(docx_path)',
    'finally:',
    '    cv.close()',
  ].join('\n');

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.env.PYTHON || 'python', ['-c', script, document.storage_path, outputPath], {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) return resolve();
        return reject(new Error(stderr || `pdf2docx termino con codigo ${code}.`));
      });
    });

    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractPdfPagesWithOcr(document, options = {}) {
  const pages = await extractPdfPages(document);
  if (countTextLines(pages) || options.ocr === false) return pages;

  let renderedPages;
  try {
    renderedPages = await renderPdfPagesAsImages(document);
  } catch (_nodeRenderError) {
    renderedPages = await renderPdfPagesWithBrowser(document);
  }
  const recognize = options.ocrRecognizer || recognizeImageBuffer;
  const ocrPages = [];

  for (let index = 0; index < renderedPages.length; index += 1) {
    const result = await recognize(renderedPages[index].buffer, { pageNumber: index + 1 });
    const lines = (result.lines || [])
      .map(normalizeOcrLine)
      .filter((line) => line.text);

    if (!lines.length && result.text) {
      for (const text of String(result.text).split(/\r?\n/)) {
        const trimmed = text.trim();
        if (trimmed) lines.push({ text: trimmed, maxHeight: 10 });
      }
    }

    ocrPages.push({ pageNumber: index + 1, lines });
  }

  return ocrPages;
}

// Produces an editable Word document from PDF text content.
// Lines with large font or all-caps become bold headings.
// Lines with multiple spaced columns get tabs for alignment.
async function pdfToWordEditable(document, options = {}) {
  const pages = await extractPdfPagesWithOcr(document, options);
  const docSections = [];

  for (let i = 0; i < pages.length; i++) {
    const { lines } = pages[i];
    const children = [];

    for (const { text, maxHeight } of lines) {
      const trimmed = text.trim();
      if (!trimmed) {
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      const heading = isHeadingLine(trimmed, maxHeight);
      const display = isTableRow(trimmed) ? normalizeTableRow(trimmed) : trimmed;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: display,
              bold: heading,
              size: heading ? 26 : 22,
              font: 'Calibri',
            }),
          ],
          spacing: { after: heading ? 160 : 60 },
        })
      );
    }

    if (!children.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    }

    docSections.push({
      properties: i > 0 ? { page: { breakType: 'nextPage' } } : {},
      children,
    });
  }

  if (!docSections.length) {
    docSections.push({
      properties: {},
      children: [new Paragraph({ children: [new TextRun({ text: 'Sin contenido de texto extraíble.' })] })],
    });
  }

  return Packer.toBuffer(new Document({ sections: docSections }));
}

async function pdfToWordLayoutFromPages(pages) {
  if (!pages.some((page) => page.lines.some(hasPosition))) {
    return Packer.toBuffer(new Document({
      sections: [{
        children: [new Paragraph({ children: [new TextRun({ text: 'Sin posiciones de texto extraibles.' })] })],
      }],
    }));
  }

  const sections = pages.map((page, pageIndex) => {
    const pdfWidth = Number(page.pdfWidth || 595.28);
    const pdfHeight = Number(page.pdfHeight || 841.89);
    const children = page.lines
      .filter((line) => line.text && hasPosition(line))
      .map((line, lineIndex) => textBoxForLine(line, pdfHeight, lineIndex));

    if (!children.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    }

    return {
      properties: {
        ...(pageIndex > 0 ? { type: 'nextPage' } : {}),
        page: {
          size: {
            width: Math.round(pdfWidth * 20),
            height: Math.round(pdfHeight * 20),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children,
    };
  });

  return Packer.toBuffer(new Document({ sections }));
}

async function pdfToWordLayout(document, options = {}) {
  const pages = await extractPdfPagesWithOcr(document, options);
  if (!pages.some((page) => page.lines.some(hasPosition))) {
    return pdfToWordEditable(document, options);
  }

  return pdfToWordLayoutFromPages(pages);
}

async function renderPagesForHybrid(document) {
  try {
    return await renderPdfPagesAsImages(document, { scale: 1.45 });
  } catch (_nodeRenderError) {
    return renderPdfPagesWithBrowser(document);
  }
}

async function pdfToWordHybridFromPages(document, pages, options = {}) {
  if (!pages.some((page) => page.lines.some(hasPosition))) {
    return pdfToWordEditable(document, options);
  }

  const renderedPages = await renderPagesForHybrid(document);
  const sections = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const renderedPage = renderedPages[pageIndex];
    const pdfWidth = Number(page.pdfWidth || renderedPage?.pdfWidth || 595.28);
    const pdfHeight = Number(page.pdfHeight || renderedPage?.pdfHeight || 841.89);
    const children = [];

    if (renderedPage) {
      const background = await eraseTextFromPageImage(renderedPage, page);
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              type: 'png',
              data: background,
              transformation: {
                width: renderedPage.displayWidth,
                height: renderedPage.displayHeight,
              },
            }),
          ],
        })
      );
    }

    children.push(
      ...page.lines
        .filter((line) => line.text && hasPosition(line))
        .map((line, lineIndex) => textBoxForLine(line, pdfHeight, lineIndex, {
          zIndexBase: 100,
          maxSize: 44,
        }))
    );

    if (!children.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    }

    sections.push({
      properties: {
        ...(pageIndex > 0 ? { type: 'nextPage' } : {}),
        page: {
          size: {
            width: Math.round(pdfWidth * 20),
            height: Math.round(pdfHeight * 20),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children,
    });
  }

  return Packer.toBuffer(new Document({ sections }));
}

async function pdfToWordHybrid(document, options = {}) {
  const pages = await extractPdfPagesWithOcr(document, options);
  return pdfToWordHybridFromPages(document, pages, options);
}

// Produces a Word document where each page is an embedded image (visual fidelity, NOT editable).
async function pdfToWordImage(document) {
  let pages;
  try {
    pages = await renderPdfPagesAsImages(document);
  } catch (_nodeErr) {
    try {
      pages = await renderPdfPagesWithBrowser(document);
    } catch (_browserErr) {
      return pdfToWordEditable(document);
    }
  }

  const sections = pages.map((page) => ({
    properties: {
      page: {
        size: {
          width: Math.round(page.pdfWidth * 20),
          height: Math.round(page.pdfHeight * 20),
        },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: page.buffer,
            transformation: { width: page.displayWidth, height: page.displayHeight },
          }),
        ],
      }),
    ],
  }));

  return Packer.toBuffer(new Document({ sections }));
}

// mode: 'image' → visual/non-editable; default → editable text
async function pdfToWord(document, options = {}) {
  if (options.mode === 'image') return pdfToWordImage(document);
  if (options.mode === 'text' || options.mode === 'flow') return pdfToWordEditable(document, options);
  if (options.mode === 'hybrid') return pdfToWordHybrid(document, options);
  if (options.ocrRecognizer || options.ocr === true) return pdfToWordLayout(document, options);
  try {
    return await convertWithPdf2Docx(document);
  } catch (_error) {
    // Fall back to the built-in positioned-text converter when the external layout engine cannot parse a PDF.
  }
  const pages = await extractPdfPagesWithOcr(document, { ...options, ocr: false });
  if (shouldUseHybridWord(pages, options)) {
    return pdfToWordHybridFromPages(document, pages, options);
  }
  return pdfToWordLayoutFromPages(pages);
}

module.exports = { pdfToWord };
