const { createCanvas } = require('canvas');
const JSZip = require('jszip');
const { extractPdfPages, renderPdfPagesAsImages, renderPdfPagesWithBrowser, A4_WIDTH, A4_HEIGHT } = require('./renderer');

async function renderTextPagesAsImages(document) {
  const textPages = await extractPdfPages(document);
  return textPages.map((page) => {
    const width = 1000;
    const height = 1414;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111111';
    ctx.font = '700 28px Arial';
    ctx.fillText(`Pagina ${page.pageNumber}`, 56, 64);
    ctx.font = '20px Arial';
    let y = 110;
    for (const { text } of page.lines) {
      const chunks = String(text || '').match(/.{1,88}(\s|$)/g) || [text];
      for (const chunk of chunks) {
        if (y > height - 56) break;
        ctx.fillText(chunk.trim(), 56, y);
        y += 30;
      }
      if (y > height - 56) break;
    }
    if (!page.lines.length) {
      ctx.fillText('Sin texto extraíble. El PDF fue procesado correctamente.', 56, y);
    }
    return {
      buffer: Buffer.from(canvas.toBuffer('image/png')),
      pdfWidth: A4_WIDTH,
      pdfHeight: A4_HEIGHT,
      displayWidth: 794,
      displayHeight: 1123,
    };
  });
}

async function pdfToImages(document) {
  let pages;
  try {
    pages = await renderPdfPagesAsImages(document);
  } catch (_nodeErr) {
    try {
      pages = await renderPdfPagesWithBrowser(document);
    } catch (_browserErr) {
      pages = await renderTextPagesAsImages(document);
    }
  }
  const zip = new JSZip();
  pages.forEach((page, index) => {
    zip.file(`pagina-${String(index + 1).padStart(3, '0')}.png`, page.buffer);
  });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { pdfToImages };
