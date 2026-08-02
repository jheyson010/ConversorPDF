const { pdfToWord } = require('./pdf-to-word');
const { pdfToImages } = require('./pdf-to-images');
const { wordToPdf, excelToPdf, pptToPdf } = require('./office-to-pdf');
const { pdfToPpt } = require('./pdf-to-ppt');

module.exports = { pdfToWord, pdfToImages, wordToPdf, excelToPdf, pptToPdf, pdfToPpt };
