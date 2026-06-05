const fs = require('fs');
const { StandardFonts, rgb, degrees } = require('pdf-lib');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');
const { assertPdf, hexToRgb, loadPdf, parsePageSelection } = require('./utils');

async function watermarkPdf(document, options = {}) {
  const input = await loadPdf(document);
  const text = String(options.text || 'DocFlow').trim();
  const opacity = Math.max(0.08, Math.min(0.65, Number(options.opacity || 0.22)));
  const size = Math.max(14, Math.min(90, Number(options.size || 42)));
  const rotation = Math.max(-75, Math.min(75, Number(options.rotation ?? -28)));
  const selectedPages = options.pages && options.pages !== 'all'
    ? new Set(parsePageSelection(options.pages, input.getPageCount()))
    : null;
  const font = await input.embedFont(StandardFonts.HelveticaBold);

  input.getPages().forEach((page, index) => {
    if (selectedPages && !selectedPages.has(index)) return;
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size,
      font,
      color: hexToRgb(options.color, '#c9a84c') || rgb(0.79, 0.66, 0.3),
      opacity,
      rotate: degrees(rotation),
    });
  });

  return input.save({ useObjectStreams: true });
}

async function protectPdf(document, options = {}) {
  assertPdf(document);
  const password = String(options.password || '').trim();
  const ownerPassword = String(options.ownerPassword || '').trim() || null;
  if (password.length < 4) {
    const error = new Error('La contraseña debe tener al menos 4 caracteres.');
    error.status = 400;
    throw error;
  }
  const bytes = fs.readFileSync(document.storage_path);
  return encryptPDF(new Uint8Array(bytes), password, ownerPassword);
}

module.exports = { watermarkPdf, protectPdf };
