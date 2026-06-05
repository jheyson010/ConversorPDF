const express = require('express');
const { requireUser } = require('../middleware/auth');
const { recognizeImage } = require('../services/ocr.service');

const router = express.Router();

router.use(requireUser);

router.post('/image', async (req, res, next) => {
  try {
    const result = await recognizeImage(req.body.imageData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
