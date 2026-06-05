const fs = require('fs');
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');
const { loadPdf, parsePageSelection } = require('./utils');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

async function mergePdfs(documents) {
  if (!documents.length) throw new Error('Selecciona al menos un PDF.');
  const output = await PDFDocument.create();
  for (const doc of documents) {
    const input = await loadPdf(doc);
    const pages = await output.copyPages(input, input.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save({ useObjectStreams: true });
}

async function combinePages(documents, options = {}) {
  if (!documents.length) throw new Error('Selecciona al menos un PDF.');
  const sources = [];
  for (const doc of documents) sources.push(await loadPdf(doc));

  const sourcePages = Array.isArray(options.sourcePages) && options.sourcePages.length
    ? options.sourcePages
    : sources.flatMap((src, srcIdx) =>
        src.getPageIndices().map((pi) => ({ sourceIndex: srcIdx, page: pi + 1, rotation: 0 }))
      );

  const output = await PDFDocument.create();
  for (const item of sourcePages) {
    const srcIdx = Number(item.sourceIndex || 0);
    const pageIdx = Number(item.page || 1) - 1;
    if (!sources[srcIdx] || pageIdx < 0 || pageIdx >= sources[srcIdx].getPageCount()) continue;
    const [page] = await output.copyPages(sources[srcIdx], [pageIdx]);
    const rot = Number(item.rotation || 0);
    if (rot) {
      const cur = page.getRotation().angle || 0;
      page.setRotation(degrees((cur + rot + 360) % 360));
    }
    output.addPage(page);
  }
  return output.save({ useObjectStreams: true });
}

async function splitPdf(document, options = {}) {
  const input = await loadPdf(document);
  const selectedPages = parsePageSelection(options.pages, input.getPageCount());
  if (!selectedPages.length) throw new Error('Selecciona al menos una página.');
  const output = await PDFDocument.create();
  const pages = await output.copyPages(input, selectedPages);
  pages.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: true });
}

async function rotatePdf(document, options = {}) {
  const input = await loadPdf(document);
  const selectedPages = new Set(parsePageSelection(options.pages, input.getPageCount()));
  const rotations = options.rotations && typeof options.rotations === 'object' ? options.rotations : null;
  const amount = Number(options.degrees || 90);
  if (!rotations && ![90, 180, 270].includes(amount)) throw new Error('La rotación debe ser 90, 180 o 270 grados.');
  input.getPages().forEach((page, i) => {
    const pageNumber = i + 1;
    if (!selectedPages.has(i) && !(rotations && (rotations[pageNumber] || rotations[String(pageNumber)]))) return;
    const applied = rotations ? Number(rotations[pageNumber] || rotations[String(pageNumber)] || 0) : amount;
    if (!applied) return;
    const cur = page.getRotation().angle || 0;
    page.setRotation(degrees((cur + applied + 360) % 360));
  });
  return input.save({ useObjectStreams: true });
}

async function compressPdf(document) {
  const input = await loadPdf(document);
  return input.save({ useObjectStreams: true, addDefaultPage: false });
}

async function imagesToPdf(documents) {
  if (!documents.length) throw new Error('Selecciona una o más imágenes.');
  const output = await PDFDocument.create();
  for (const doc of documents) {
    const bytes = fs.readFileSync(doc.storage_path);
    const ext = path.extname(doc.original_name).toLowerCase();
    let image;
    if (ext === '.jpg' || ext === '.jpeg' || doc.mime_type === 'image/jpeg') {
      image = await output.embedJpg(bytes);
    } else if (ext === '.png' || doc.mime_type === 'image/png') {
      image = await output.embedPng(bytes);
    } else {
      throw new Error(`Imagen no compatible: ${doc.original_name}. Usa JPG o PNG.`);
    }
    const scale = Math.min(A4_WIDTH / image.width, A4_HEIGHT / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    const page = output.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawImage(image, { x: (A4_WIDTH - w) / 2, y: (A4_HEIGHT - h) / 2, width: w, height: h });
  }
  return output.save({ useObjectStreams: true });
}

module.exports = { mergePdfs, combinePages, splitPdf, rotatePdf, compressPdf, imagesToPdf };
