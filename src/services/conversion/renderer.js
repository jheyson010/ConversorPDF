const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas } = require('canvas');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 54;

function assertExt(document, allowed, label) {
  const ext = path.extname(document.original_name || '').toLowerCase();
  if (!allowed.includes(ext)) {
    const error = new Error(`Esta herramienta necesita ${label}.`);
    error.status = 400;
    throw error;
  }
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

async function renderTextPdf(title, sections) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  function addPage() {
    page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN;
  }

  function drawLine(line, options = {}) {
    const size = options.size || 11;
    const font = options.mono ? mono : options.bold ? bold : regular;
    if (y < MARGIN + size) addPage();
    page.drawText(String(line || ''), {
      x: MARGIN,
      y,
      size,
      font,
      color: options.color || rgb(0.08, 0.08, 0.08),
    });
    y -= size * 1.35;
  }

  drawLine(title, { size: 18, bold: true, color: rgb(0.12, 0.12, 0.12) });
  y -= 10;

  for (const section of sections) {
    if (section.heading) {
      y -= 4;
      drawLine(section.heading, { size: 13, bold: true, color: rgb(0.23, 0.37, 0.62) });
    }
    for (const raw of section.lines || []) {
      const lines = wrapText(raw, regular, section.mono ? 9 : 11, A4_WIDTH - MARGIN * 2);
      lines.forEach((line) => drawLine(line, { mono: section.mono, size: section.mono ? 9 : 11 }));
    }
    y -= 8;
  }

  return pdf.save({ useObjectStreams: true });
}

// Extracts text content from each PDF page, preserving row/column structure.
// Returns: [{ pageNumber, pdfWidth, pdfHeight, lines: [{ text, x, y, width, maxHeight }] }]
async function extractPdfPages(document) {
  assertExt(document, ['.pdf'], 'un PDF');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(fs.readFileSync(document.storage_path));
  const pdf = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const rows = new Map();
    for (const item of textContent.items) {
      const text = String(item.str || '').trim();
      if (!text) continue;
      const y = Math.round(item.transform[5] / 4) * 4;
      const row = rows.get(y) || [];
      row.push({
        x: Number(item.transform[4] || 0),
        y: Number(item.transform[5] || 0),
        text,
        width: Number(item.width || 0),
        height: Number(item.height || item.transform[3] || 0),
        fontName: item.fontName,
      });
      rows.set(y, row);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => {
        const ordered = row.sort((a, b) => a.x - b.x);
        const minX = Math.min(...ordered.map((item) => item.x));
        const maxX = Math.max(...ordered.map((item) => item.x + Math.max(item.width, item.text.length * Math.max(item.height, 8) * 0.42)));
        const maxHeight = Math.max(...ordered.map((item) => item.height), 8);
        const y = Math.max(...ordered.map((item) => item.y));
        return {
          text: ordered.map((item) => item.text).join('  '),
          x: minX,
          y,
          width: Math.max(24, maxX - minX),
          maxHeight,
          bold: ordered.some((item) => /bold|black|heavy|semibold/i.test(String(item.fontName || ''))),
        };
      })
      .filter((line) => line.text.trim());
    pages.push({ pageNumber, pdfWidth: viewport.width, pdfHeight: viewport.height, lines });
  }

  return pages;
}

async function renderPdfPagesAsImages(document, options = {}) {
  assertExt(document, ['.pdf'], 'un PDF');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(fs.readFileSync(document.storage_path));
  const pdf = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    isImageDecoderSupported: false,
    verbosity: 0,
  }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderScale = Math.max(0.8, Math.min(2.5, Number(options.scale || 2)));
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({
      buffer: Buffer.from(canvas.toBuffer('image/png')),
      pdfWidth: baseViewport.width,
      pdfHeight: baseViewport.height,
      displayWidth: Math.round((baseViewport.width / 72) * 96),
      displayHeight: Math.round((baseViewport.height / 72) * 96),
    });
  }

  return pages;
}

function browserExecutablePath() {
  const candidates = [
    process.env.DOCFLOW_BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function renderPdfPagesWithBrowser(document) {
  const executablePath = browserExecutablePath();
  if (!executablePath) throw new Error('No se encontró Edge o Chrome para renderizar el PDF fiel.');
  const payload = JSON.stringify({ executablePath, pdfPath: document.storage_path });
  // browser-renderer.js stays in the parent services/ folder (it's a standalone worker process)
  const rendererPath = path.join(__dirname, '..', 'browser-renderer.js');
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [rendererPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      return reject(new Error(stderr || `Renderizador de navegador terminó con código ${code}.`));
    });
    child.stdin.end(payload);
  });
  const parsed = JSON.parse(result);
  return parsed.pages.map((page) => ({
    buffer: Buffer.from(page.base64, 'base64'),
    pdfWidth: page.pdfWidth,
    pdfHeight: page.pdfHeight,
    displayWidth: page.displayWidth,
    displayHeight: page.displayHeight,
  }));
}

module.exports = {
  assertExt,
  extractPdfPages,
  renderPdfPagesAsImages,
  renderPdfPagesWithBrowser,
  renderTextPdf,
  A4_WIDTH,
  A4_HEIGHT,
};
