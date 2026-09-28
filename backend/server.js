require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { supabase } = require('./db');
const { requireSameOrigin, privateNoStore } = require('./middleware/security');
const { attachUserIfPresent } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const storeRoutes = require('./routes/store');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const required = ['GOOGLE_CLIENT_ID', 'JWT_SECRET', 'CONFIG_ENCRYPTION_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_EXPECTED_HOSTNAME', 'PUBLIC_API_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error('Configuracoes obrigatorias ausentes: ' + missing.join(', '));
  if (!FRONTEND_URL.startsWith('https://') || !process.env.PUBLIC_API_URL.startsWith('https://')) throw new Error('FRONTEND_URL e PUBLIC_API_URL devem usar HTTPS em producao.');
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: isProduction ? { directives: { defaultSrc: ["'self'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"], scriptSrc: ["'self'", 'https://accounts.google.com', 'https://apis.google.com', 'https://challenges.cloudflare.com'], frameSrc: ["'self'", 'https://accounts.google.com', 'https://challenges.cloudflare.com'], connectSrc: ["'self'", 'https://accounts.google.com', 'https://challenges.cloudflare.com'], imgSrc: ["'self'", 'https:', 'data:'], styleSrc: ["'self'", "'unsafe-inline'"], objectSrc: ["'none'"], upgradeInsecureRequests: [] } } : false, hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
app.use(cors({ origin: FRONTEND_URL, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Idempotency-Key'] }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 900000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
const strictLimit = rateLimit({ windowMs: 900000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/auth', privateNoStore);
app.use('/api/orders', privateNoStore);
app.use('/api/admin', privateNoStore);
app.use('/auth/google', requireSameOrigin, strictLimit);
app.use('/auth/logout', requireSameOrigin);
app.use('/api/orders/checkout', requireSameOrigin, strictLimit);
app.use('/api/consents', attachUserIfPresent, requireSameOrigin);
app.use('/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.post('/api/consents', rateLimit({ windowMs: 3600000, limit: 20 }), async (req, res, next) => {
  const categories = req.body?.categories;
  const validConsent = categories && typeof categories === 'object' && categories.necessary === true && ['necessary', 'analytics', 'functional', 'marketing'].every((key) => typeof categories[key] === 'boolean');
  if (!validConsent) return res.status(400).json({ error: 'invalid_request' });
  try {
    const { error } = await supabase.from('consent_logs').insert({ user_id: req.user?.id || null, categories, policy_version: '2026-09-27', ip_address: req.ip, user_agent: req.get('user-agent') || '' });
    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use((err, _req, res, _next) => { console.error(err.name || 'server_error'); res.status(500).json({ error: 'internal_error' }); });
app.listen(PORT, () => console.log(`NoWay backend rodando em http://localhost:${PORT}`));