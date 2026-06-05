const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db/database');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../config/paths');

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function ensureStorage() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

function safeExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, '') || '.bin';
}

function cleanName(filename) {
  return path.basename(filename || 'documento').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${safeExtension(file.originalname)}`),
  }),
  limits: { fileSize: MAX_FILE_SIZE },
});

async function createDocumentRecord({ userId, originalName, storedName, mimeType, sizeBytes, storagePath, kind, toolSource = null }) {
  const document = {
    id: crypto.randomUUID(),
    user_id: userId,
    original_name: cleanName(originalName),
    stored_name: storedName,
    mime_type: mimeType || 'application/octet-stream',
    size_bytes: Number(sizeBytes || 0),
    storage_path: storagePath,
    kind,
    tool_source: toolSource,
    created_at: nowIso(),
  };
  await db.insert('documents', document);
  return getDocumentForUser(document.id, userId);
}

async function recordUploadedFile(file, userId) {
  return createDocumentRecord({
    userId,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: file.path,
    kind: 'upload',
  });
}

async function recordOutputFile({ userId, originalName, mimeType, buffer, toolSource }) {
  const storedName = `${crypto.randomUUID()}${safeExtension(originalName)}`;
  const storagePath = path.join(OUTPUTS_DIR, storedName);
  fs.writeFileSync(storagePath, buffer);
  return createDocumentRecord({
    userId,
    originalName,
    storedName,
    mimeType,
    sizeBytes: buffer.length,
    storagePath,
    kind: 'output',
    toolSource,
  });
}

async function getDocumentForUser(id, userId) {
  return db.get('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, userId]);
}

async function listDocumentsForUser(userId) {
  return db.all(
    `SELECT id, original_name, mime_type, size_bytes, kind, tool_source, created_at
     FROM documents WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
}

function publicDocument(document) {
  return {
    id: document.id,
    name: document.original_name,
    mimeType: document.mime_type,
    sizeBytes: document.size_bytes,
    kind: document.kind,
    toolSource: document.tool_source,
    createdAt: document.created_at,
    downloadUrl: `/api/files/${document.id}/download`,
  };
}

module.exports = {
  MAX_FILE_SIZE,
  ensureStorage,
  upload,
  recordUploadedFile,
  recordOutputFile,
  getDocumentForUser,
  listDocumentsForUser,
  publicDocument,
};
