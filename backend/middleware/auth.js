const jwt = require('jsonwebtoken');

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret === 'dev-secret-change-me')) {
  throw new Error('JWT_SECRET seguro e obrigatorio em producao.');
}
const JWT_SECRET = configuredSecret || 'dev-secret-change-me';
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || 'ad4763048@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

function requireAuth(req, res, next) {
  const token = req.cookies?.noway_session;
  if (!token) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_session' });
  }
}

// Não bloqueia a rota, mas anexa req.user se houver um cookie válido.
function attachUserIfPresent(req, _res, next) {
  const token = req.cookies?.noway_session;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // token inválido/expirado, segue sem usuário
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !adminEmails.has(String(req.user.email).toLowerCase())) {
    return res.status(403).json({ error: 'admin_required' });
  }
  next();
}

function isAdmin(email) {
  return adminEmails.has(String(email).toLowerCase());
}

module.exports = { requireAuth, requireAdmin, attachUserIfPresent, JWT_SECRET, isAdmin };
