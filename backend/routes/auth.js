const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { JWT_SECRET, attachUserIfPresent, isAdmin } = require('../middleware/auth');
const { supabase } = require('../db');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function publicUser(user) {
  const { getAccess } = require('../middleware/access');
  const access = await getAccess(user);
  return {
    ...user,
    role: access?.owner ? 'owner' : access ? 'staff' : 'customer',
    permissions: access?.permissions || [],
  };
}

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'missing_credential' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload.email || payload.email_verified !== true) return res.status(401).json({ error: 'unverified_google_account' });
    const baseUser = { id: payload.sub, name: payload.name, email: payload.email, picture: payload.picture, role: isAdmin(payload.email) ? 'owner' : 'customer' };
    const { data: previous, error: previousError } = await supabase.from('profiles').select('id').eq('id', baseUser.id).maybeSingle();
    if (previousError) throw previousError;
    const { error: profileError } = await supabase.from('profiles').upsert({ id: baseUser.id, email: baseUser.email, full_name: baseUser.name || '', avatar_url: baseUser.picture || null, role: baseUser.role, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (profileError) throw profileError;
    const user = await publicUser(baseUser);
    if (!previous) {
      const { audit } = require('../services/audit');
      await audit({ eventType: 'customer.added', targetType: 'customer', targetId: user.id, summary: `Cliente cadastrado: ${user.name || user.email}` });
    }
    const sessionToken = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('noway_session', sessionToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 24 * 60 * 60 * 1000 });
    res.json({ user });
  } catch (err) {
    console.error('google_login_failed', err.name || 'error');
    res.status(401).json({ error: 'invalid_google_token' });
  }
});

router.get('/me', attachUserIfPresent, async (req, res, next) => {
  try {
    res.json({ user: req.user ? await publicUser(req.user) : null });
  } catch (error) { next(error); }
});
router.post('/logout', (req, res) => {
  res.clearCookie('noway_session', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

module.exports = router;