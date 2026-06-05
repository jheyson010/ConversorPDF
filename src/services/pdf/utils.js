const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

function assertPdf(document) {
  const ext = path.extname(document.original_name).toLowerCase();
  if (ext !== '.pdf' && document.mime_type !== 'application/pdf') {
    const error = new Error('Esta herramienta necesita un archivo PDF.');
    error.status = 400;
    throw error;
  }
}

function parsePageSelection(input, totalPages) {
  const text = String(input || '').trim();
  if (!text) return Array.from({ length: totalPages }, (_v, i) => i);

  const selected = new Set();
  for (const part of text.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    if (chunk.includes('-')) {
      const [startRaw, endRaw] = chunk.split('-');
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > totalPages) {
        throw new Error(`Rango inválido: ${chunk}`);
      }
      for (let p = start; p <= end; p += 1) selected.add(p - 1);
    } else {
      const p = Number(chunk);
      if (!Number.isInteger(p) || p < 1 || p > totalPages) {
        throw new Error(`Página inválida: ${chunk}`);
      }
      selected.add(p - 1);
    }
  }
  return [...selected].sort((a, b) => a - b);
}

function hexToRgb(input, fallback = '#111111') {
  const color = String(input || fallback).replace('#', '').padEnd(6, '0').slice(0, 6);
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return rgb(
    Number.isFinite(r) ? r / 255 : 0.07,
    Number.isFinite(g) ? g / 255 : 0.07,
    Number.isFinite(b) ? b / 255 : 0.07
  );
}

async function loadPdf(document) {
  assertPdf(document);
  return PDFDocument.load(fs.readFileSync(document.storage_path), { ignoreEncryption: false });
}

module.exports = { assertPdf, parsePageSelection, hexToRgb, loadPdf };
