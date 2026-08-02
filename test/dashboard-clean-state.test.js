const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf8');

test('dashboard starts without demo documents or fake processed state', () => {
  assert.doesNotMatch(dashboardHtml, /Informe_Final|CV_actualizado|Contrato_v2|Logo_empresa/);
  assert.doesNotMatch(dashboardHtml, /Archivo procesado correctamente|6\.5 \/ 10 GB|248 KB|185/);
  assert.match(dashboardHtml, /Sin archivos cargados/);
  assert.match(dashboardHtml, /No hay archivos cargados/);
});

test('dashboard exposes upload and subscription buttons', () => {
  assert.match(dashboardHtml, /id="dashboardFileInput"/);
  assert.match(dashboardHtml, /id="wordEmptyUploadButton"/);
  assert.match(dashboardHtml, /id="dashboardSubscribeButton"/);
  assert.match(dashboardHtml, /id="topSubscribeButton"/);
  assert.match(dashboardHtml, /Pro S\/ 6/);
});
