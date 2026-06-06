require('dotenv').config({ quiet: true, override: true });

const db = require('../src/db/database');

db.initDatabase()
  .then(async () => {
    const row = await db.get('SELECT COUNT(*) AS total FROM users');
    console.log(`DocFlow DB lista (${db.getEngine()}) - usuarios: ${row?.total ?? 0}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
