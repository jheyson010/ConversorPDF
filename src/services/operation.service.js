const crypto = require('crypto');
const db = require('../db/database');

function nowIso() {
  return new Date().toISOString();
}

async function createOperation({ userId, tool, inputDocumentIds, options }) {
  const operation = {
    id: crypto.randomUUID(),
    user_id: userId,
    tool,
    status: 'running',
    input_document_ids: JSON.stringify(inputDocumentIds),
    output_document_id: null,
    options: JSON.stringify(options || {}),
    error: null,
    created_at: nowIso(),
    finished_at: null,
  };
  await db.insert('operations', operation);
  return operation;
}

async function finishOperation(id, outputDocumentId) {
  await db.update(
    'operations',
    { status: 'done', output_document_id: outputDocumentId, finished_at: nowIso(), error: null },
    'id = ?',
    [id]
  );
}

async function failOperation(id, error) {
  await db.update(
    'operations',
    { status: 'failed', error: error.message || String(error), finished_at: nowIso() },
    'id = ?',
    [id]
  );
}

async function listOperationsForUser(userId) {
  return db.all(
    `SELECT id, tool, status, input_document_ids, output_document_id, options, error, created_at, finished_at
     FROM operations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
}

function publicOperation(operation) {
  return {
    id: operation.id,
    tool: operation.tool,
    status: operation.status,
    inputDocumentIds: JSON.parse(operation.input_document_ids || '[]'),
    outputDocumentId: operation.output_document_id || null,
    outputUrl: operation.output_document_id ? `/api/files/${operation.output_document_id}/download` : null,
    options: JSON.parse(operation.options || '{}'),
    error: operation.error,
    createdAt: operation.created_at,
    finishedAt: operation.finished_at,
  };
}

module.exports = {
  createOperation,
  finishOperation,
  failOperation,
  listOperationsForUser,
  publicOperation,
};
