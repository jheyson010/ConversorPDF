require('dotenv').config({ quiet: true, override: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDatabase } = require('./src/db/database');
const { attachUser } = require('./src/middleware/auth');
const { ensureStorage } = require('./src/services/storage.service');
const { PUBLIC_DIR } = require('./src/config/paths');
const authRoutes = require('./src/routes/auth.routes');
const filesRoutes = require('./src/routes/files.routes');
const toolsRoutes = require('./src/routes/tools.routes');
const ocrRoutes = require('./src/routes/ocr.routes');
const subscriptionsRoutes = require('./src/routes/subscriptions.routes');
const aiRoutes = require('./src/routes/ai.routes');
const fontsRoutes = require('./src/routes/fonts.routes');

const PORT = Number(process.env.PORT || 3000);

let appInstance;
let databasePromise;

async function ensureDatabaseReady() {
  if (!databasePromise) {
    databasePromise = Promise.resolve()
      .then(initDatabase)
      .then(() => {
        ensureStorage();
      });
  }
  return databasePromise;
}

async function withDatabase(req, _res, next) {
  try {
    await ensureDatabaseReady();
    next();
  } catch (error) {
    databasePromise = null;
    next(error);
  }
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(cookieParser());
  app.use(express.static(PUBLIC_DIR));

  app.use('/api', withDatabase, attachUser);
  app.use('/api/auth', authRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/tools', toolsRoutes);
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/fonts', fontsRoutes);

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use((error, _req, res, _next) => {
    console.error(error.stack || error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'El archivo supera el maximo de 50 MB.' });
    }
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || 'Ocurrio un error procesando el documento.',
    });
  });

  return app;
}

function getApp() {
  if (!appInstance) appInstance = createApp();
  return Promise.resolve(appInstance);
}

async function start() {
  const app = await getApp();
  const server = app.listen(PORT, () => {
    console.log(`DocFlow listo en http://localhost:${PORT}`);
  });
  globalThis.docflowServer = server;

  function shutdown(signal) {
    server.close(() => {
      console.log(`DocFlow detenido por ${signal}`);
      process.exit(0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

const exportedApp = appInstance || createApp();
appInstance = exportedApp;

module.exports = exportedApp;
module.exports.createApp = createApp;
module.exports.ensureDatabaseReady = ensureDatabaseReady;
module.exports.getApp = getApp;
module.exports.start = start;
