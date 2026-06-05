const { pdfToWord } = require('./pdf-to-word');
const { pdfToImages } = require('./pdf-to-images');
const { wordToPdf, excelToPdf, pptToPdf } = require('./office-to-pdf');

module.exports = { pdfToWord, pdfToImages, wordToPdf, excelToPdf, pptToPdf };
