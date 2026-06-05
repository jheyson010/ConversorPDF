const { getUserBySession, publicUser } = require('../services/auth.service');

async function attachUser(req, _res, next) {
  try {
    const token = req.cookies.docflow_session;
    const user = await getUserBySession(token);
    req.user = user || null;
    req.publicUser = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Inicia sesión para guardar y ver tu historial.' });
  }
  return next();
}

module.exports = {
  attachUser,
  requireUser,
};
