const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');
const { Document, Packer, Paragraph } = require('docx');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const conversion = require('../src/services/conversion');
const pdf = require('../src/services/pdf');

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docflow-test-'));
}

function documentRecord(storagePath, originalName, mimeType) {
  return {
    original_name: originalName,
    mime_type: mimeType,
    storage_path: storagePath,
  };
}

async function createPdf(filePath, pageCount = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = doc.addPage([300, 220]);
    page.drawText(`Compra prueba pagina ${index + 1}`, {
      x: 32,
      y: 170,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  fs.writeFileSync(filePath, await doc.save());
}

async function createSlideLikePdf(filePath) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([800, 450]);
  page.drawRectangle({ x: 0, y: 0, width: 800, height: 450, color: rgb(0.96, 0.9, 0.86) });
  page.drawRectangle({ x: 360, y: 120, width: 360, height: 170, color: rgb(0.96, 0.64, 0.67) });
  page.drawRectangle({ x: 70, y: 120, width: 250, height: 170, color: rgb(0.98, 0.78, 0.66) });
  page.drawText('El Valor del Cambio', { x: 300, y: 332, size: 34, font: bold, color: rgb(0, 0, 0) });
  page.drawText('La autoconciencia es la base de casi', { x: 300, y: 286, size: 21, font, color: rgb(0, 0, 0) });
  page.drawText('todos los elementos de la inteligencia', { x: 300, y: 254, size: 21, font, color: rgb(0, 0, 0) });
  page.drawText('emocional.', { x: 300, y: 222, size: 21, font, color: rgb(0, 0, 0) });
  fs.writeFileSync(filePath, await doc.save());
}

test('pdfToWord text mode creates an editable DOCX with extracted PDF text', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'sample.pdf');
  await createPdf(pdfPath, 1);

  const buffer = await conversion.pdfToWord(
    documentRecord(pdfPath, 'sample.pdf', 'application/pdf'),
    { mode: 'text' }
  );

  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  assert.match(documentXml, /Compra prueba pagina 1/);
});

test('wordToPdf creates a valid PDF from a DOCX file', async () => {
  const dir = tempDir();
  const docxPath = path.join(dir, 'sample.docx');
  const docx = new Document({
    sections: [{ children: [new Paragraph('Documento de prueba')] }],
  });
  fs.writeFileSync(docxPath, await Packer.toBuffer(docx));

  const buffer = await conversion.wordToPdf(
    documentRecord(docxPath, 'sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  );
  const output = await PDFDocument.load(buffer);

  assert.equal(output.getPageCount(), 1);
});

test('pdfToImages creates a ZIP with one PNG per PDF page', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'sample.pdf');
  await createPdf(pdfPath, 2);

  const buffer = await conversion.pdfToImages(
    documentRecord(pdfPath, 'sample.pdf', 'application/pdf')
  );
  const zip = await JSZip.loadAsync(buffer);

  assert.ok(zip.file('pagina-001.png'));
  assert.ok(zip.file('pagina-002.png'));
});

test('imagesToPdf creates a PDF page for each uploaded image', async () => {
  const dir = tempDir();
  const imagePath = path.join(dir, 'pixel.png');
  fs.writeFileSync(imagePath, onePixelPng);

  const buffer = await pdf.imagesToPdf([
    documentRecord(imagePath, 'pixel.png', 'image/png'),
  ]);
  const output = await PDFDocument.load(buffer);

  assert.equal(output.getPageCount(), 1);
});

test('editPdf applies page order and returns a loadable PDF', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'pages.pdf');
  await createPdf(pdfPath, 2);

  const buffer = await pdf.editPdf(
    documentRecord(pdfPath, 'pages.pdf', 'application/pdf'),
    {
      pageOrder: [2],
      textAnnotations: [
        {
          page: 2,
          x: 32,
          y: 120,
          text: 'Editado',
          size: 14,
          color: '#111111',
          fontFamily: 'Helvetica',
        },
      ],
    }
  );
  const output = await PDFDocument.load(buffer);

  assert.equal(output.getPageCount(), 1);
});

test('editPdf applies page rotation and saves it in the PDF', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'rotate.pdf');
  await createPdf(pdfPath, 1);

  const buffer = await pdf.editPdf(
    documentRecord(pdfPath, 'rotate.pdf', 'application/pdf'),
    { rotations: { 1: 90 } }
  );
  const output = await PDFDocument.load(buffer);

  assert.equal(output.getPage(0).getRotation().angle, 90);
});

test('editPdf saves highlight underline strike and notes as a loadable PDF', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'markup.pdf');
  await createPdf(pdfPath, 1);

  const buffer = await pdf.editPdf(
    documentRecord(pdfPath, 'markup.pdf', 'application/pdf'),
    {
      markups: [
        { type: 'highlight', page: 1, x: 28, y: 160, width: 180, height: 22, color: '#ffd64a' },
        { type: 'underline', page: 1, x: 28, y: 154, width: 180, height: 12, color: '#e0ab24' },
        { type: 'strike', page: 1, x: 28, y: 144, width: 180, height: 18, color: '#cd4040' },
        { type: 'note', page: 1, x: 32, y: 70, width: 110, height: 42, color: '#fff2a8', text: 'Nota prueba' },
      ],
    }
  );
  const output = await PDFDocument.load(buffer);

  assert.equal(output.getPageCount(), 1);
});

test('pdfToWord uses OCR fallback when the PDF has no embedded text', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'scanned.pdf');

  const doc = await PDFDocument.create();
  doc.addPage([300, 220]);
  fs.writeFileSync(pdfPath, await doc.save());

  const buffer = await conversion.pdfToWord(
    documentRecord(pdfPath, 'scanned.pdf', 'application/pdf'),
    {
      ocrRecognizer: async () => ({
        lines: [{ text: 'Texto recuperado por OCR', bbox: { x0: 10, y0: 10, x1: 210, y1: 30 } }],
        text: 'Texto recuperado por OCR',
      }),
    }
  );
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  assert.match(documentXml, /Texto recuperado por OCR/);
});

test('pdfToWord creates a DOCX package', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'faithful.pdf');
  await createPdf(pdfPath, 1);

  const buffer = await conversion.pdfToWord(
    documentRecord(pdfPath, 'faithful.pdf', 'application/pdf'),
    {}
  );
  const zip = await JSZip.loadAsync(buffer);

  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  assert.ok(zip.file('word/document.xml'));
});

test('pdfToWord hybrid mode preserves slide-like layout while keeping text editable', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'slide.pdf');
  await createSlideLikePdf(pdfPath);

  const buffer = await conversion.pdfToWord(
    documentRecord(pdfPath, 'slide.pdf', 'application/pdf'),
    { mode: 'hybrid' }
  );
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const media = zip.file(/^word\/media\//);

  assert.match(documentXml, /El Valor del Cambio/);
  assert.match(documentXml, /La autoconciencia/);
  assert.ok(media.length >= 1);
});

test('pdfToPpt creates a valid PPTX package with slide images', async () => {
  const dir = tempDir();
  const pdfPath = path.join(dir, 'presentation.pdf');
  await createPdf(pdfPath, 2);

  const buffer = await conversion.pdfToPpt(
    documentRecord(pdfPath, 'presentation.pdf', 'application/pdf')
  );
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');

  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file('ppt/presentation.xml'));
  assert.ok(zip.file('ppt/slides/slide1.xml'));
  assert.ok(zip.file('ppt/slides/slide2.xml'));
  assert.ok(zip.file('ppt/media/image1.png'));
  assert.ok(zip.file('ppt/media/image2.png'));
});
