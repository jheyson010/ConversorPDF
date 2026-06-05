const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/database');

const SESSION_DAYS = 30;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '660499321480-v9blu82drm6fctvchpt1u4u0o5a8lqvk.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatarUrl: user.avatar_url || null,
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

async function verifyGoogleCredential(credential) {
  if (!credential) return null;

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified === false) return null;

  const user = await findOrCreateUser(payload.email, payload.name, payload.picture);
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
};
