const path = require('path');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const DATA_DIR = process.env.RUNTIME_DATA_DIR || (IS_VERCEL ? path.join(os.tmpdir(), 'docflow') : path.join(ROOT_DIR, 'data'));
const STATIC_DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const OUTPUTS_DIR = path.join(DATA_DIR, 'outputs');
const DB_PATH = path.join(DATA_DIR, 'docflow.sqlite');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  STATIC_DATA_DIR,
  UPLOADS_DIR,
  OUTPUTS_DIR,
  DB_PATH,
  PUBLIC_DIR,
};
