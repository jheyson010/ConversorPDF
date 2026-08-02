const express = require('express');
const { requireUser } = require('../middleware/auth');
const { isProUser } = require('../services/auth.service');
const {
  summarizeDocument,
  chatWithDocument,
  translateDocumentText,
} = require('../services/ai.service');

const router = express.Router();

router.use(requireUser);

function requireProPlan(req, res, next) {
  if (!isProUser(req.user)) {
    return res.status(403).json({
      proRequired: true,
      message: 'El Asistente de Inteligencia Artificial es una función exclusiva del plan DocFlow Pro (S/ 6 mensual). Suscríbete para desbloquear resúmenes, traducción y consultas ilimitadas.',
    });
  }
  return next();
}

router.use(requireProPlan);

router.post('/summarize', async (req, res, next) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: 'Selecciona un documento para resumir.' });
    }
    const result = await summarizeDocument(documentId, req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/chat', async (req, res, next) => {
  try {
    const { documentId, question, chatHistory } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: 'Selecciona un documento para chatear.' });
    }
    const result = await chatWithDocument(documentId, question, chatHistory, req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/translate', async (req, res, next) => {
  try {
    const { documentId, targetLanguage } = req.body;
    if (!documentId) {
      return res.status(400).json({ message: 'Selecciona un documento para traducir.' });
    }
    const result = await translateDocumentText(documentId, targetLanguage || 'es', req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
