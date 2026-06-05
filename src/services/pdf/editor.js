const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const { loadPdf, parsePageSelection, hexToRgb } = require('./utils');

async function addTextToPdf(document, options = {}) {
  const input = await loadPdf(document);
  const pageIndex = Math.max(0, Math.min(input.getPageCount() - 1, Number(options.page || 1) - 1));
  const page = input.getPage(pageIndex);
  const font = await input.embedFont(StandardFonts.Helvetica);
  const size = Math.max(8, Math.min(72, Number(options.size || 18)));
  const text = String(options.text || '').trim();
  if (!text) throw new Error('Escribe el texto que quieres añadir.');
  page.drawText(text, {
    x: Math.max(0, Number(options.x || 72)),
    y: Math.max(0, Number(options.y || 72)),
    size,
    font,
    color: rgb(0.95, 0.95, 0.9),
  });
  return input.save({ useObjectStreams: true });
}

async function editPdf(document, options = {}) {
  const input = await loadPdf(document);
  const fonts = {
    Helvetica: await input.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await input.embedFont(StandardFonts.HelveticaBold),
    TimesRoman: await input.embedFont(StandardFonts.TimesRoman),
    TimesBold: await input.embedFont(StandardFonts.TimesRomanBold),
    Courier: await input.embedFont(StandardFonts.Courier),
    CourierBold: await input.embedFont(StandardFonts.CourierBold),
  };
  const annotations = Array.isArray(options.textAnnotations) ? options.textAnnotations : [];
  const markups = Array.isArray(options.markups) ? options.markups : [];
  const rotations = options.rotations && typeof options.rotations === 'object' ? options.rotations : {};

  input.getPages().forEach((page, index) => {
    const pageNumber = index + 1;
    const rot = Number(rotations[pageNumber] || rotations[String(pageNumber)] || 0);
    if (rot) {
      const cur = page.getRotation().angle || 0;
      page.setRotation(degrees((cur + rot + 360) % 360));
    }
  });

  for (const item of annotations) {
    const pageIndex = Math.max(0, Math.min(input.getPageCount() - 1, Number(item.page || 1) - 1));
    const page = input.getPage(pageIndex);
    const size = Math.max(7, Math.min(96, Number(item.size || 16)));
    const text = String(item.text || '').trim();
    const width = Number(item.width || 0);
    const height = Number(item.height || size);
    const fontFamily = ['Helvetica', 'TimesRoman', 'Courier'].includes(item.fontFamily) ? item.fontFamily : 'Helvetica';
    const font = item.bold
      ? (fonts[`${fontFamily.replace('Roman', '')}Bold`] || fonts.TimesBold)
      : fonts[fontFamily];

    if (item.erase && width > 0) {
      page.drawRectangle({
        x: Math.max(0, Number(item.x || 0) - 4),
        y: Math.max(0, Number(item.y || 0) - Math.max(height, size) * 0.38),
        width: width + 10,
        height: Math.max(height, size) * 1.55,
        color: hexToRgb(item.backgroundColor, '#ffffff'),
      });
    }

    if (!text) continue;
    page.drawText(text, {
      x: Math.max(0, Number(item.x || 0)),
      y: Math.max(0, Number(item.y || 0)),
      size,
      font,
      color: hexToRgb(item.color),
    });
  }

  for (const item of markups) {
    const pageIndex = Math.max(0, Math.min(input.getPageCount() - 1, Number(item.page || 1) - 1));
    const page = input.getPage(pageIndex);
    const type = String(item.type || '').toLowerCase();
    const x = Math.max(0, Number(item.x || 0));
    const y = Math.max(0, Number(item.y || 0));
    const width = Math.max(1, Number(item.width || 1));
    const height = Math.max(1, Number(item.height || 1));

    if (type === 'highlight') {
      page.drawRectangle({ x, y, width, height, color: hexToRgb(item.color, '#ffd64a'), opacity: 0.35 });
    } else if (type === 'underline') {
      page.drawLine({ start: { x, y: y + 1 }, end: { x: x + width, y: y + 1 }, thickness: 1.6, color: hexToRgb(item.color, '#e0ab24') });
    } else if (type === 'strike') {
      page.drawLine({ start: { x, y: y + height * 0.5 }, end: { x: x + width, y: y + height * 0.5 }, thickness: 1.6, color: hexToRgb(item.color, '#cd4040') });
    } else if (type === 'note') {
      const noteText = String(item.text || 'Nota').slice(0, 220);
      page.drawRectangle({
        x, y,
        width: Math.max(width, 86),
        height: Math.max(height, 28),
        color: hexToRgb(item.color, '#fff2a8'),
        borderColor: rgb(0.72, 0.55, 0.12),
        borderWidth: 1,
      });
      page.drawText(noteText, {
        x: x + 5,
        y: y + Math.max(8, height - 16),
        size: 10,
        font: fonts.Helvetica,
        color: rgb(0.08, 0.08, 0.08),
        maxWidth: Math.max(40, width - 10),
      });
    }
  }

  if (Array.isArray(options.pageOrder) && options.pageOrder.length) {
    const order = options.pageOrder.map((p) => Number(p) - 1);
    const output = await PDFDocument.create();
    const pages = await output.copyPages(input, order);
    pages.forEach((page) => output.addPage(page));
    return output.save({ useObjectStreams: true });
  }

  return input.save({ useObjectStreams: true });
}

async function organizePdf(document, options = {}) {
  const input = await loadPdf(document);
  const pageCount = input.getPageCount();
  const pageOrder = Array.isArray(options.pageOrder) && options.pageOrder.length
    ? options.pageOrder.map((p) => Number(p)).filter((p) => p >= 1 && p <= pageCount)
    : Array.from({ length: pageCount }, (_v, i) => i + 1);
  const rotations = options.rotations && typeof options.rotations === 'object' ? options.rotations : {};

  input.getPages().forEach((page, index) => {
    const pageNumber = index + 1;
    const rot = Number(rotations[pageNumber] || rotations[String(pageNumber)] || 0);
    if (!rot) return;
    const cur = page.getRotation().angle || 0;
    page.setRotation(degrees((cur + rot + 360) % 360));
  });

  const output = await PDFDocument.create();
  const pages = await output.copyPages(input, pageOrder.map((p) => p - 1));
  pages.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: true });
}

function signaturePosition(page, alignment, width, height) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = 54;
  const positions = {
    'inferior-derecha': { x: pageWidth - margin - width, y: margin },
    'inferior-izquierda': { x: margin, y: margin },
    'superior-derecha': { x: pageWidth - margin - width, y: pageHeight - margin - height },
    'superior-izquierda': { x: margin, y: pageHeight - margin - height },
    centro: { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2 },
  };
  return positions[alignment] || positions['inferior-derecha'];
}

function signatureImageBytes(dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) return null;
  return { type: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') };
}

async function signPdf(document, options = {}) {
  const input = await loadPdf(document);
  const pageIndex = Math.max(0, Math.min(input.getPageCount() - 1, Number(options.page || 1) - 1));
  const page = input.getPage(pageIndex);
  const alignment = String(options.alignment || 'inferior-derecha');
  const image = signatureImageBytes(options.signatureImage);

  if (image) {
    const embedded = image.type === 'png' ? await input.embedPng(image.bytes) : await input.embedJpg(image.bytes);
    const maxWidth = Math.max(80, Math.min(220, Number(options.width || 150)));
    const scale = Math.min(maxWidth / embedded.width, 70 / embedded.height, 1);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, { ...signaturePosition(page, alignment, width, height), width, height });
  } else {
    const text = String(options.signatureText || '').trim();
    if (!text) {
      const error = new Error('Dibuja, escribe o carga una firma.');
      error.status = 400;
      throw error;
    }
    const font = await input.embedFont(StandardFonts.HelveticaOblique);
    const size = Math.max(14, Math.min(42, Number(options.size || 24)));
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      ...signaturePosition(page, alignment, width, size * 1.25),
      size,
      font,
      color: hexToRgb(options.color, '#111111'),
    });
  }

  return input.save({ useObjectStreams: true });
}

module.exports = { addTextToPdf, editPdf, organizePdf, signPdf };
