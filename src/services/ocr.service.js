const { createWorker } = require('tesseract.js');

let workerPromise;

function imageDataToBuffer(imageData) {
  const match = /^data:image\/(?:png|jpeg|jpg);base64,(.+)$/.exec(String(imageData || ''));
  if (!match) {
    const error = new Error('Imagen OCR inválida.');
    error.status = 400;
    throw error;
  }
  return Buffer.from(match[1], 'base64');
}

function imageBufferToDataUrl(buffer) {
  return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('spa+eng', 1, {
      logger: () => {},
      langPath: './data',
    });
  }
  return workerPromise;
}

function normalizeBox(bbox) {
  if (!bbox) return null;
  const x0 = Number(bbox.x0 ?? bbox.left);
  const y0 = Number(bbox.y0 ?? bbox.top);
  const x1 = Number(bbox.x1 ?? bbox.right);
  const y1 = Number(bbox.y1 ?? bbox.bottom);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

function collectBlocks(data) {
  const lines = [];
  const words = [];

  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const lineBox = normalizeBox(line.bbox);
        const lineText = String(line.text || '').trim();
        if (lineText && lineBox) {
          lines.push({
            text: lineText,
            confidence: Number(line.confidence || 0),
            bbox: lineBox,
          });
        }

        for (const word of line.words || []) {
          const wordBox = normalizeBox(word.bbox);
          const wordText = String(word.text || '').trim();
          if (wordText && wordBox) {
            words.push({
              text: wordText,
              confidence: Number(word.confidence || 0),
              bbox: wordBox,
            });
          }
        }
      }
    }
  }

  if (!lines.length) {
    for (const line of data.lines || []) {
      const lineBox = normalizeBox(line.bbox);
      const lineText = String(line.text || '').trim();
      if (lineText) {
        lines.push({
          text: lineText,
          confidence: Number(line.confidence || 0),
          bbox: lineBox,
        });
      }
    }
  }

  return { lines, words, text: String(data.text || '').trim() };
}

async function recognizeImageBuffer(buffer) {
  const worker = await getWorker();
  const result = await worker.recognize(buffer, {}, { blocks: true });
  return collectBlocks(result.data || {});
}

async function recognizeImage(imageData) {
  return recognizeImageBuffer(imageDataToBuffer(imageData));
}

module.exports = {
  recognizeImage,
  recognizeImageBuffer,
  imageBufferToDataUrl,
};
