const express = require('express');
const {
  SESSION_DAYS,
  verifyGoogleCredential,
  loginWithEmail,
  deleteSession,
} = require('../services/auth.service');

const router = express.Router();

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

router.get('/me', (req, res) => {
  res.json({ user: req.publicUser });
});

router.post('/logout', async (req, res, next) => {
  try {
    await deleteSession(req.cookies.docflow_session);
  } catch (error) {
    return next(error);
  }
  res.clearCookie('docflow_session');
  return res.json({ ok: true });
});

router.get('/google/client', (_req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '660499321480-v9blu82drm6fctvchpt1u4u0o5a8lqvk.apps.googleusercontent.com',
  });
});

router.post('/google', async (req, res, next) => {
  try {
    const result = await verifyGoogleCredential(req.body.credential);
    if (!result) return res.status(401).json({ message: 'No se pudo validar tu cuenta de Google.' });

    res.cookie('docflow_session', result.token, sessionCookieOptions());
    return res.json({ user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.post('/email', async (req, res, next) => {
  try {
    const result = await loginWithEmail(req.body.email);
    res.cookie('docflow_session', result.token, sessionCookieOptions());
    return res.json({ user: result.user });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
