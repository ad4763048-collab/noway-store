function requireSameOrigin(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const expectedOrigin = process.env.FRONTEND_URL;
  const origin = req.get('origin');
  if (!origin || origin !== expectedOrigin) {
    return res.status(403).json({ error: 'invalid_origin' });
  }
  next();
}

function privateNoStore(_req, res, next) {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    Vary: 'Origin, Cookie',
  });
  next();
}

module.exports = { requireSameOrigin, privateNoStore };
