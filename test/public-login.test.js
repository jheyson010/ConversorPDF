const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('public landing page uses Google authentication modal', () => {
  assert.match(indexHtml, /id="googleButton"/);
  assert.match(indexHtml, /id="authDialog"/);
});

test('google login holder is exposed for google auth', () => {
  assert.match(indexHtml, /class="google-holder" id="googleButton"/);
});
