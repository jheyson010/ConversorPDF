const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const OUTPUTS_DIR = path.join(DATA_DIR, 'outputs');
const DB_PATH = path.join(DATA_DIR, 'docflow.sqlite');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  OUTPUTS_DIR,
  DB_PATH,
  PUBLIC_DIR,
};
