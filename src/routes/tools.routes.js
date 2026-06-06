const express = require('express');
const { requireUser } = require('../middleware/auth');
const { getDocumentForUser, recordOutputFile, publicDocument } = require('../services/storage.service');
const { createOperation, finishOperation, failOperation, publicOperation } = require('../services/operation.service');
const pdf = require('../services/pdf');

const router = express.Router();

function conversion() {
  return require('../services/conversion');
}

const tools = {
  merge: {
    outputName: 'pdf-unido.pdf',
    mimeType: 'application/pdf',
    run: (documents) => pdf.mergePdfs(documents),
  },
  combinePages: {
    outputName: 'pdf-combinado.pdf',
    mimeType: 'application/pdf',
    run: (documents, options) => pdf.combinePages(documents, options),
  },
  editPdf: {
    outputName: 'pdf-editado.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.editPdf(document, options),
  },
  organize: {
    outputName: 'pdf-organizado.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.organizePdf(document, options),
  },
  split: {
    outputName: 'pdf-dividido.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.splitPdf(document, options),
  },
  rotate: {
    outputName: 'pdf-rotado.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.rotatePdf(document, options),
  },
  watermark: {
    outputName: 'pdf-marca-de-agua.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.watermarkPdf(document, options),
  },
  sign: {
    outputName: 'pdf-firmado.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.signPdf(document, options),
  },
  text: {
    outputName: 'pdf-con-texto.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.addTextToPdf(document, options),
  },
  compress: {
    outputName: 'pdf-optimizado.pdf',
    mimeType: 'application/pdf',
    run: ([document]) => pdf.compressPdf(document),
  },
  imageToPdf: {
    outputName: 'imagenes-a-pdf.pdf',
    mimeType: 'application/pdf',
    run: (documents) => pdf.imagesToPdf(documents),
  },
  pdfToWord: {
    outputName: 'pdf-convertido.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    run: ([document], options) => conversion().pdfToWord(document, options),
  },
  pdfToWordImage: {
    outputName: 'pdf-word-visual.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    run: ([document]) => conversion().pdfToWord(document, { mode: 'image' }),
  },
  pdfToImage: {
    outputName: 'pdf-imagenes.zip',
    mimeType: 'application/zip',
    run: ([document]) => conversion().pdfToImages(document),
  },
  wordToPdf: {
    outputName: 'word-a-pdf.pdf',
    mimeType: 'application/pdf',
    run: ([document]) => conversion().wordToPdf(document),
  },
  excelToPdf: {
    outputName: 'excel-a-pdf.pdf',
    mimeType: 'application/pdf',
    run: ([document]) => conversion().excelToPdf(document),
  },
  pptToPdf: {
    outputName: 'ppt-a-pdf.pdf',
    mimeType: 'application/pdf',
    run: ([document]) => conversion().pptToPdf(document),
  },
  protect: {
    outputName: 'pdf-protegido.pdf',
    mimeType: 'application/pdf',
    run: ([document], options) => pdf.protectPdf(document, options),
  },
};

const unavailable = {};

async function documentsFromIds(ids, userId) {
  const documents = await Promise.all((ids || []).map((id) => getDocumentForUser(id, userId)));
  if (documents.some((document) => !document)) {
    const error = new Error('Uno o más documentos no existen o no pertenecen a tu cuenta.');
    error.status = 404;
    throw error;
  }
  return documents;
}

router.use(requireUser);

router.get('/', (_req, res) => {
  res.json({
    available: Object.keys(tools),
    unavailable,
  });
});

router.post('/:tool', async (req, res, next) => {
  const tool = req.params.tool;
  if (unavailable[tool]) return res.status(501).json({ message: unavailable[tool] });
  const definition = tools[tool];
  if (!definition) return res.status(404).json({ message: 'Herramienta no encontrada.' });

  const ids = Array.isArray(req.body.documentIds) ? req.body.documentIds : [req.body.documentId].filter(Boolean);
  const options = req.body.options || {};
  let operation;

  try {
    const documents = await documentsFromIds(ids, req.user.id);
    operation = await createOperation({ userId: req.user.id, tool, inputDocumentIds: ids, options });
    const outputBuffer = Buffer.from(await definition.run(documents, options));
    if (!outputBuffer.length) {
      const error = new Error('La herramienta no generó un archivo válido.');
      error.status = 500;
      throw error;
    }
    const output = await recordOutputFile({
      userId: req.user.id,
      originalName: definition.outputName,
      mimeType: definition.mimeType,
      buffer: outputBuffer,
      toolSource: tool,
    });
    await finishOperation(operation.id, output.id);

    res.json({
      operation: publicOperation({
        ...operation,
        status: 'done',
        output_document_id: output.id,
        finished_at: new Date().toISOString(),
      }),
      document: publicDocument(output),
    });
  } catch (error) {
    if (operation) await failOperation(operation.id, error);
    next(error);
  }
});

module.exports = router;

