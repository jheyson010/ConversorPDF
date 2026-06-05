const fs = require('fs');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { assertExt, renderTextPdf } = require('./renderer');

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function wordToPdf(document) {
  assertExt(document, ['.docx'], 'un archivo DOCX');
  const result = await mammoth.extractRawText({ path: document.storage_path });
  const lines = result.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return renderTextPdf(document.original_name, [{ lines }]);
}

async function excelToPdf(document) {
  assertExt(document, ['.xlsx', '.xls'], 'un archivo Excel');
  const workbook = XLSX.readFile(document.storage_path, { cellDates: true });
  const sections = workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false });
    const lines = rows.slice(0, 120).map((row) => row.map((cell) => String(cell ?? '')).join('    '));
    return { heading: sheetName, lines, mono: true };
  });
  return renderTextPdf(document.original_name, sections);
}

async function pptToPdf(document) {
  assertExt(document, ['.pptx'], 'un archivo PPTX');
  const zip = await JSZip.loadAsync(fs.readFileSync(document.storage_path));
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] || 0) - Number(b.match(/slide(\d+)/)?.[1] || 0));

  const sections = [];
  for (const name of slideFiles) {
    const xml = await zip.file(name).async('string');
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => decodeXml(m[1]).trim())
      .filter(Boolean);
    sections.push({ heading: `Diapositiva ${sections.length + 1}`, lines: texts });
  }
  if (!sections.length) sections.push({ lines: ['No se encontró texto en la presentación.'] });
  return renderTextPdf(document.original_name, sections);
}

module.exports = { wordToPdf, excelToPdf, pptToPdf };
