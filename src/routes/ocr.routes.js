const express = require('express');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

function ocr() {
  return require('../services/ocr.service');
}

router.use(requireUser);

router.post('/image', async (req, res, next) => {
  try {
    const result = await ocr().recognizeImage(req.body.imageData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
