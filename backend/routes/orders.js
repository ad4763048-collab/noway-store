const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { supabase } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getPaymentConfig } = require('../services/secureSettings');
const { audit } = require('../services/audit');

const router = express.Router();
const checkoutSchema = z.object({
  captchaToken: z.string().min(20).max(2048).optional(),
  idempotencyKey: z.string().uuid(),
  couponCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/).optional(),
  items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(10) })).min(1).max(20),
});

function publicUrl() { return (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''); }
function money(value) { return Math.round(Number(value) * 100) / 100; }

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip, idempotency_key: crypto.randomUUID() });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!process.env.TURNSTILE_EXPECTED_HOSTNAME || result.hostname === process.env.TURNSTILE_EXPECTED_HOSTNAME);
}

async function resolveCoupon(code, subtotal) {
  if (!code) return { coupon: null, discount: 0 };
  const { data: coupon, error } = await supabase.from('coupons').select('*').eq('code', code).eq('is_active', true).maybeSingle();
  if (error) throw error;
  const now = Date.now();
  if (!coupon || (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) || (coupon.ends_at && new Date(coupon.ends_at).getTime() <= now) || (coupon.max_redemptions && coupon.redemptions_count >= coupon.max_redemptions) || subtotal < Number(coupon.minimum_order)) {
    return { error: 'invalid_coupon' };
  }
  const rawDiscount = coupon.discount_type === 'percent' ? subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
  const discount = money(Math.min(rawDiscount, subtotal));
  if (money(subtotal - discount) <= 0) return { error: 'coupon_requires_positive_total' };
  return { coupon, discount };
}

async function createPreference(order, items) {
  const paymentConfig = await getPaymentConfig();
  if (!paymentConfig?.accessToken) throw new Error('payment_not_configured');
  const siteUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const preferenceItems = Number(order.discount_amount) > 0
    ? [{ title: `Pedido NoWay (${items.length} item(ns))`, quantity: 1, unit_price: Number(order.total), currency_id: 'BRL' }]
    : items.map((item) => ({ title: item.product_name, quantity: item.quantity, unit_price: Number(item.unit_price), currency_id: 'BRL' }));
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${paymentConfig.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_reference: order.id,
      notification_url: `${publicUrl()}/api/orders/webhook/mercado-pago`,
      payer: { email: order.user_email },
      back_urls: { success: `${siteUrl}?payment=success`, failure: `${siteUrl}?payment=failure`, pending: `${siteUrl}?payment=pending` },
      auto_return: 'approved',
      items: preferenceItems,
    }),
  });
  if (!response.ok) throw new Error('payment_provider_error');
  return response.json();
}

router.post('/checkout', requireAuth, validate(checkoutSchema), async (req, res, next) => {
  try {
    if (!(await verifyTurnstile(req.body.captchaToken, req.ip))) return res.status(403).json({ error: 'captcha_failed' });
    const { data: existing, error: existingError } = await supabase.from('orders').select('id, status, checkout_url').eq('user_id', req.user.id).eq('idempotency_key', req.body.idempotencyKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.checkout_url) return res.json({ order: existing, checkoutUrl: existing.checkout_url });
    if (existing) return res.status(409).json({ error: 'checkout_in_progress' });

    const ids = [...new Set(req.body.items.map((item) => item.id))];
    if (ids.length !== req.body.items.length) return res.status(400).json({ error: 'duplicate_item' });
    const { data: products, error } = await supabase.from('products').select('*').in('id', ids).eq('is_active', true);
    if (error) throw error;
    if (!products || products.length !== ids.length) return res.status(400).json({ error: 'invalid_item' });
    const byId = new Map(products.map((product) => [product.id, product]));
    const orderItems = req.body.items.map(({ id, qty }) => {
      const product = byId.get(id);
      return { product_id: id, product_name: product.name, quantity: qty, unit_price: product.price };
    });
    const subtotal = money(orderItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0));
    const couponResult = await resolveCoupon(req.body.couponCode, subtotal);
    if (couponResult.error) return res.status(400).json({ error: couponResult.error });
    const total = money(subtotal - couponResult.discount);
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      user_id: req.user.id, user_email: req.user.email, total, status: 'pending_payment', idempotency_key: req.body.idempotencyKey,
      coupon_id: couponResult.coupon?.id || null, coupon_code: couponResult.coupon?.code || null, discount_amount: couponResult.discount,
    }).select().single();
    if (orderError?.code === '23505') return res.status(409).json({ error: 'checkout_in_progress' });
    if (orderError) throw orderError;
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) throw itemsError;
    const preference = await createPreference(order, orderItems);
    const { error: referenceError } = await supabase.from('orders').update({ payment_reference: preference.id, checkout_url: preference.init_point }).eq('id', order.id);
    if (referenceError) throw referenceError;
    res.status(201).json({ order: { ...order, items: orderItems }, checkoutUrl: preference.init_point });
  } catch (error) {
    if (error.message === 'payment_not_configured') return res.status(503).json({ error: 'payment_not_configured' });
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data });
  } catch (error) { next(error); }
});

router.get('/:id/downloads', requireAuth, async (req, res, next) => {
  try {
    const { data: order, error } = await supabase.from('orders').select('*, order_items(product_id, product_name)').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (error || order.status !== 'paid') return res.status(404).json({ error: 'downloads_not_available' });
    const ids = order.order_items.map((item) => item.product_id).filter(Boolean);
    const { data: products, error: productsError } = await supabase.from('products').select('id, name, storage_path').in('id', ids);
    if (productsError) throw productsError;
    const downloads = await Promise.all(products.filter((product) => product.storage_path).map(async (product) => {
      const { data, error: signError } = await supabase.storage.from('downloads').createSignedUrl(product.storage_path, 900);
      if (signError) throw signError;
      return { name: product.name, url: data.signedUrl, expiresInMinutes: 15 };
    }));
    res.json({ downloads });
  } catch (error) { next(error); }
});

async function isValidMercadoPagoSignature(req) {
  const paymentConfig = await getPaymentConfig();
  const secret = paymentConfig?.webhookSecret;
  if (!secret) return false;
  const values = Object.fromEntries((req.get('x-signature') || '').split(',').map((part) => part.trim().split('=')));
  const paymentId = String(req.query['data.id'] || req.body?.data?.id || '').toLowerCase();
  if (!values.ts || !values.v1 || !paymentId) return false;
  const expected = crypto.createHmac('sha256', secret).update(`id:${paymentId};request-id:${req.get('x-request-id') || ''};ts:${values.ts};`).digest('hex');
  return values.v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(values.v1), Buffer.from(expected));
}

router.post('/webhook/mercado-pago', async (req, res, next) => {
  try {
    if (!(await isValidMercadoPagoSignature(req))) return res.status(401).json({ error: 'invalid_signature' });
    const paymentId = req.body?.data?.id || req.query['data.id'];
    const paymentConfig = await getPaymentConfig();
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${paymentConfig.accessToken}` } });
    if (!response.ok) throw new Error('payment_lookup_failed');
    const payment = await response.json();
    const { data: order, error: orderError } = await supabase.from('orders').select('id, total, status, coupon_id, coupon_code').eq('id', payment.external_reference).single();
    if (orderError) throw orderError;
    if (Number(payment.transaction_amount) !== Number(order.total) || payment.currency_id !== 'BRL') {
      await supabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
      await audit({ eventType: 'payment.rejected', targetType: 'order', targetId: order.id, summary: `Pagamento recusado por divergencia de valor: ${order.id.slice(0, 8)}` }).catch(() => {});
      return res.sendStatus(200);
    }
    const status = payment.status === 'approved' ? 'paid' : ['rejected', 'cancelled'].includes(payment.status) ? 'failed' : 'pending_payment';
    const { error } = await supabase.from('orders').update({ status, payment_id: String(payment.id), paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', order.id);
    if (error) throw error;
    if (order.status !== 'paid' && status === 'paid' && order.coupon_id) {
      const { data: coupon } = await supabase.from('coupons').select('redemptions_count').eq('id', order.coupon_id).maybeSingle();
      if (coupon) await supabase.from('coupons').update({ redemptions_count: coupon.redemptions_count + 1 }).eq('id', order.coupon_id);
    }
    if (order.status !== status && ['paid', 'failed'].includes(status)) {
      await audit({ eventType: status === 'paid' ? 'payment.approved' : 'payment.rejected', targetType: 'order', targetId: order.id, summary: `Pagamento ${status === 'paid' ? 'aprovado' : 'recusado'}: ${order.id.slice(0, 8)}` }).catch(() => {});
    }
    res.sendStatus(200);
  } catch (error) { next(error); }
});

module.exports = router;