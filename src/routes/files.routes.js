const express = require('express');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { requireUser } = require('../middleware/auth');
const {
  upload,
  recordUploadedFile,
  getDocumentForUser,
  listDocumentsForUser,
  deleteDocumentForUser,
  publicDocument,
} = require('../services/storage.service');
const { listOperationsForUser, publicOperation } = require('../services/operation.service');

const router = express.Router();

router.use(requireUser);

router.get('/', async (req, res, next) => {
  try {
    const documents = await listDocumentsForUser(req.user.id);
    return res.json({
      documents: documents.map(publicDocument),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/upload', upload.array('files', 12), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Selecciona al menos un archivo.' });
    const documents = await Promise.all(files.map((file) => recordUploadedFile(file, req.user.id)));
    return res.status(201).json({ documents: documents.map(publicDocument) });
  } catch (error) {
    return next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const [documents, operations] = await Promise.all([
      listDocumentsForUser(req.user.id),
      listOperationsForUser(req.user.id),
    ]);
    return res.json({
      documents: documents.map(publicDocument),
      operations: operations.map(publicOperation),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/meta', async (req, res, next) => {
  try {
    const document = await getDocumentForUser(req.params.id, req.user.id);
    if (!document) return res.status(404).json({ message: 'Documento no encontrado.' });

    const meta = { pageCount: 0 };
    const isPdf = document.mime_type === 'application/pdf' || /\.pdf$/i.test(document.original_name || '');
    if (isPdf) {
      const pdf = await PDFDocument.load(fs.readFileSync(document.storage_path), { ignoreEncryption: true });
      meta.pageCount = pdf.getPageCount();
    }
    return res.json({ document: publicDocument(document), meta });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/download', async (req, res, next) => {
  let document;
  try {
    document = await getDocumentForUser(req.params.id, req.user.id);
    if (!document) return res.status(404).json({ message: 'Documento no encontrado.' });
  } catch (error) {
    return next(error);
  }

  const filename = path.basename(document.original_name || 'documento');
  res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '_')}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.download(document.storage_path, filename);
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteDocumentForUser(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Documento no encontrado o ya fue eliminado.' });
    return res.json({ success: true, message: 'Documento eliminado correctamente.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
