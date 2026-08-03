const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/database');

const SESSION_DAYS = 30;

function getGoogleClientId() {
  if (!process.env.GOOGLE_CLIENT_ID && !process.env.REACT_APP_GOOGLE_CLIENT_ID) {
    try { require('dotenv').config({ quiet: true }); } catch (_e) {}
  }
  return process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '652344578744-8muaou1p2ic972i2al68gmiagnonr25j.apps.googleusercontent.com';
}

async function verifyGoogleCredential(credential) {
  if (!credential) return null;

  const clientId = getGoogleClientId();
  const client = new OAuth2Client(clientId);

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified === false) return null;

  const user = await findOrCreateUser(payload.email, payload.name, payload.picture);
  const token = await createSessionForUser(user);
  return { token, user: publicUser(user) };
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ADMIN_EMAILS = new Set([
  'jheysonrodriguez10@gmail.com',
  'jheyson@gmail.com',
  'jheyson.rodriguez@gmail.com',
  'admin@docflow.com',
]);

function isProUser(user) {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase().trim();
  const envAdmins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((e) => e.trim());
  if (ADMIN_EMAILS.has(email) || envAdmins.includes(email)) return true;
  if (String(user.plan || '').toLowerCase() === 'pro') return true;
  if (['authorized', 'active'].includes(String(user.subscription_status || '').toLowerCase())) return true;
  return false;
}

function publicUser(user) {
  if (!user) return null;
  const pro = isProUser(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatarUrl: user.avatar_url || null,
    plan: pro ? 'pro' : (user.plan || 'free'),
    subscriptionStatus: user.subscription_status || (pro ? 'active' : 'inactive'),
    subscriptionId: user.subscription_id || null,
  };
}

async function findOrCreateUser(email, name = null, avatarUrl = null) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) {
    const error = new Error('Ingresa un correo válido.');
    error.status = 400;
    throw error;
  }

  const existing = await db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
  if (existing) {
    await db.update(
      'users',
      { name: name || existing.name, avatar_url: avatarUrl || existing.avatar_url, updated_at: nowIso() },
      'id = ?',
      [existing.id]
    );
    return db.get('SELECT * FROM users WHERE id = ?', [existing.id]);
  }

  const user = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    avatar_url: avatarUrl,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.insert('users', user);
  return db.get('SELECT * FROM users WHERE id = ?', [user.id]);
}

async function createSessionForUser(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert('sessions', {
    token,
    user_id: user.id,
    expires_at: addDays(SESSION_DAYS),
    created_at: nowIso(),
  });
  return token;
}

async function loginWithEmail(email) {
  const user = await findOrCreateUser(email);
  const token = await createSessionForUser(user);
  return { token, user: publicUser(user) };
}


async function getUserBySession(token) {
  if (!token) return null;
  const session = await db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return null;
  }
  return db.get('SELECT * FROM users WHERE id = ?', [session.user_id]);
}

async function deleteSession(token) {
  if (token) await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

module.exports = {
  SESSION_DAYS,
  verifyGoogleCredential,
  loginWithEmail,
  getUserBySession,
  deleteSession,
  publicUser,
  isProUser,
};
