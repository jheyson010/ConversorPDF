const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const mysql = require('mysql2/promise');
const { DATA_DIR, DB_PATH, ROOT_DIR, STATIC_DATA_DIR } = require('../config/paths');

let SQL;
let sqliteDb;
let mysqlPool;
let engine = 'sqlite';

function hasRemoteConfig() {
  return Boolean(process.env.DATABASE_URL || process.env.TIDB_HOST || process.env.DB_HOST);
}

function persist() {
  if (engine !== 'sqlite' || !sqliteDb) return;
  const data = sqliteDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const output = {};
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) output[key] = value.toISOString();
      else output[key] = value;
    }
    return output;
  });
}

function mysqlConfigFromEnv() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 4000),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, '') || process.env.TIDB_DATABASE || process.env.DB_NAME,
    };
  }

  return {
    host: process.env.TIDB_HOST || process.env.DB_HOST,
    port: Number(process.env.TIDB_PORT || process.env.DB_PORT || 4000),
    user: process.env.TIDB_USER || process.env.DB_USER,
    password: process.env.TIDB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.TIDB_DATABASE || process.env.DB_NAME || 'docflow',
  };
}

function quoteIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error('Nombre de base de datos invalido.');
  }
  return `\`${value}\``;
}

async function ensureMysqlDatabase(config, ssl) {
  if (!config.database) return;
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    ssl,
  });
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)}`);
  } finally {
    await bootstrap.end();
  }
}

async function ensureMysqlColumn(table, column, definition) {
  const rows = await all(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!rows.length) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function sqliteHasColumn(table, column) {
  const stmt = sqliteDb.prepare(`PRAGMA table_info(${table})`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.some((row) => row.name === column);
}

function ensureSqliteColumn(table, column, definition) {
  if (!sqliteHasColumn(table, column)) {
    sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initMysql() {
  const config = mysqlConfigFromEnv();
  const caPath = process.env.TIDB_CA_PATH || process.env.DB_SSL_CA_PATH;
  const ssl = process.env.DB_SSL === 'false'
    ? undefined
    : {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(caPath && fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : {}),
      };

  await ensureMysqlDatabase(config, ssl);

  mysqlPool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 8),
    namedPlaceholders: false,
    multipleStatements: true,
    ssl,
  });

  const schemaPath = path.join(__dirname, 'tidb.schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await mysqlPool.query(schema);
  engine = 'mysql';
  await ensureMysqlColumn('users', 'plan', "VARCHAR(32) NOT NULL DEFAULT 'free'");
  await ensureMysqlColumn('users', 'subscription_status', "VARCHAR(32) NOT NULL DEFAULT 'inactive'");
  await ensureMysqlColumn('users', 'subscription_id', 'VARCHAR(128)');
  await ensureMysqlColumn('users', 'subscription_updated_at', 'DATETIME NULL');
  await ensureMysqlColumn('documents', 'content', 'LONGBLOB');
}

async function initSqlite() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  SQL = await initSqlJs({
    locateFile: (file) => {
      const bundledFile = path.join(STATIC_DATA_DIR, file);
      if (fs.existsSync(bundledFile)) return bundledFile;
      return path.join(ROOT_DIR, 'node_modules', 'sql.js', 'dist', file);
    },
  });

  sqliteDb = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  sqliteDb.run('PRAGMA foreign_keys = ON;');
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'inactive',
      subscription_id TEXT,
      subscription_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      content BLOB,
      kind TEXT NOT NULL,
      tool_source TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      status TEXT NOT NULL,
      input_document_ids TEXT NOT NULL,
      output_document_id TEXT,
      options TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  ensureSqliteColumn('users', 'plan', "TEXT NOT NULL DEFAULT 'free'");
  ensureSqliteColumn('users', 'subscription_status', "TEXT NOT NULL DEFAULT 'inactive'");
  ensureSqliteColumn('users', 'subscription_id', 'TEXT');
  ensureSqliteColumn('users', 'subscription_updated_at', 'TEXT');
  ensureSqliteColumn('documents', 'content', 'BLOB');
  engine = 'sqlite';
  persist();
}

async function initDatabase() {
  if (hasRemoteConfig()) {
    await initMysql();
    return;
  }
  await initSqlite();
}

async function run(sql, params = []) {
  if (engine === 'mysql') {
    await mysqlPool.execute(sql, params);
    return;
  }
  sqliteDb.run(sql, params);
  persist();
}

async function get(sql, params = []) {
  if (engine === 'mysql') {
    const [rows] = await mysqlPool.execute(sql, params);
    return normalizeRows(rows)[0] || null;
  }

  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

async function all(sql, params = []) {
  if (engine === 'mysql') {
    const [rows] = await mysqlPool.execute(sql, params);
    return normalizeRows(rows);
  }

  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function insert(table, values) {
  const keys = Object.keys(values);
  const placeholders = keys.map(() => '?').join(', ');
  await run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    keys.map((key) => values[key])
  );
}

async function update(table, values, whereSql, whereParams = []) {
  const keys = Object.keys(values);
  await run(
    `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE ${whereSql}`,
    [...keys.map((key) => values[key]), ...whereParams]
  );
}

function getEngine() {
  return engine;
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  insert,
  update,
  persist,
  getEngine,
};
