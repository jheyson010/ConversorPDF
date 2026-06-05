const { mergePdfs, combinePages, splitPdf, rotatePdf, compressPdf, imagesToPdf } = require('./operations');
const { addTextToPdf, editPdf, organizePdf, signPdf } = require('./editor');
const { watermarkPdf, protectPdf } = require('./protection');

module.exports = {
  mergePdfs,
  combinePages,
  splitPdf,
  rotatePdf,
  compressPdf,
  imagesToPdf,
  addTextToPdf,
  editPdf,
  organizePdf,
  signPdf,
  watermarkPdf,
  protectPdf,
};
