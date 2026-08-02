const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('../src/db/database');
const { recordOutputFile, getDocumentForUser } = require('../src/services/storage.service');
const { summarizeDocument, chatWithDocument } = require('../src/services/ai.service');

test('AI Service - Summarize and Chat tests', async () => {
  await initDatabase();

  // Create a sample document
  const samplePath = path.join(__dirname, 'sample-editable.pdf');
  const buffer = fs.readFileSync(samplePath);

  const doc = await recordOutputFile({
    userId: 'test-user-ai',
    originalName: 'test-doc.pdf',
    mimeType: 'application/pdf',
    buffer,
    toolSource: 'test',
  });

  assert.ok(doc.id, 'Document ID should be created');

  // Test summary
  const summaryRes = await summarizeDocument(doc.id, 'test-user-ai');
  assert.ok(summaryRes.summary, 'Summary should not be empty');
  assert.ok(summaryRes.stats, 'Stats should be present');

  // Test chat
  const chatRes = await chatWithDocument(doc.id, '¿Qué contenido tiene este PDF?', [], 'test-user-ai');
  assert.ok(chatRes.answer, 'Chat answer should be returned');
});
