const express = require('express');
const { z } = require('zod');
const { supabase } = require('../db');
const { requireAuth, isAdmin } = require('../middleware/auth');
const { getAccess, requirePermission, requireOwner, ALL_PERMISSIONS } = require('../middleware/access');
const { validate } = require('../middleware/validate');
const { audit, EVENT_TYPES, discordUrl } = require('../services/audit');
const { encrypt, paymentConfigured, setPaymentConfig } = require('../services/secureSettings');

const router = express.Router();
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/);
const id = z.string().uuid();
const productSchema = z.object({
  category: slug,
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1000),
  price: z.number().positive().max(100000),
  old_price: z.number().positive().max(100000).nullable().optional(),
  tag: z.string().trim().max(40).default(''),
  badge: z.string().trim().max(40).default(''),
  storage_path: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().positive().max(100000),
  minimum_order: z.number().min(0).max(100000).default(0),
  max_redemptions: z.number().int().positive().max(1000000).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
}).refine((value) => value.discount_type !== 'percent' || value.discount_value <= 100, { message: 'percent_too_high' });
const roleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(250).default(''),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).min(1),
});
const categorySchema = z.object({ slug, name: z.string().trim().min(2).max(60), sort_order: z.number().int().min(0).max(10000).default(0) });
const webhookSchema = z.object({ name: z.string().trim().min(2).max(60), event_type: z.enum(EVENT_TYPES), url: z.string().url().max(2000) });

function actor(req) { return req.user?.id || null; }
async function requireExisting(table, key, value) {
  const { data, error } = await supabase.from(table).select('*').eq(key, value).maybeSingle();
  if (error) throw error;
  return data;
}

router.use(requireAuth);

router.get('/access', async (req, res, next) => {
  try {
    const access = await getAccess(req.user);
    if (!access?.permissions.includes('admin.access')) return res.status(403).json({ error: 'permission_denied' });
    res.json({ access });
  } catch (error) { next(error); }
});

router.get('/overview', requirePermission('admin.access'), async (_req, res, next) => {
  try {
    const [{ count: products }, { count: orders }, { count: customers }, { count: coupons }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    res.json({ products: products || 0, orders: orders || 0, customers: customers || 0, coupons: coupons || 0 });
  } catch (error) { next(error); }
});

router.get('/products', requirePermission('catalog.manage'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ products: data });
  } catch (error) { next(error); }
});
router.post('/products', requirePermission('catalog.manage'), validate(productSchema), async (req, res, next) => {
  try {
    const category = await requireExisting('product_categories', 'slug', req.body.category);
    if (!category?.is_active) return res.status(400).json({ error: 'invalid_category' });
    const { data, error } = await supabase.from('products').insert(req.body).select().single();
    if (error) throw error;
    await audit({ eventType: 'product.created', actorId: actor(req), targetType: 'product', targetId: data.id, summary: `Produto criado: ${data.name}` });
    res.status(201).json({ product: data });
  } catch (error) { next(error); }
});
router.patch('/products/:id', requirePermission('catalog.manage'), validate(productSchema.partial()), async (req, res, next) => {
  try {
    if (req.body.category) {
      const category = await requireExisting('product_categories', 'slug', req.body.category);
      if (!category?.is_active) return res.status(400).json({ error: 'invalid_category' });
    }
    const { data, error } = await supabase.from('products').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    await audit({ eventType: 'product.updated', actorId: actor(req), targetType: 'product', targetId: data.id, summary: `Produto atualizado: ${data.name}` });
    res.json({ product: data });
  } catch (error) { next(error); }
});
router.delete('/products/:id', requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').update({ is_active: false }).eq('id', req.params.id).select('id, name').single();
    if (error) throw error;
    await audit({ eventType: 'product.deleted', actorId: actor(req), targetType: 'product', targetId: data.id, summary: `Produto desativado: ${data.name}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/categories', requirePermission('catalog.manage'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('product_categories').select('*').order('sort_order');
    if (error) throw error;
    res.json({ categories: data });
  } catch (error) { next(error); }
});
router.post('/categories', requirePermission('catalog.manage'), validate(categorySchema), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('product_categories').insert(req.body).select().single();
    if (error) throw error;
    await audit({ eventType: 'category.created', actorId: actor(req), targetType: 'category', targetId: data.id, summary: `Categoria criada: ${data.name}` });
    res.status(201).json({ category: data });
  } catch (error) { next(error); }
});
router.delete('/categories/:id', requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const category = await requireExisting('product_categories', 'id', req.params.id);
    if (!category) return res.status(404).json({ error: 'not_found' });
    const { count, error: countError } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category', category.slug);
    if (countError) throw countError;
    if (count) return res.status(409).json({ error: 'category_has_products' });
    const { error } = await supabase.from('product_categories').delete().eq('id', category.id);
    if (error) throw error;
    await audit({ eventType: 'category.deleted', actorId: actor(req), targetType: 'category', targetId: category.id, summary: `Categoria apagada: ${category.name}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/coupons', requirePermission('coupons.manage'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ coupons: data });
  } catch (error) { next(error); }
});
router.post('/coupons', requirePermission('coupons.manage'), validate(couponSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('coupons').insert({ ...req.body, created_by: actor(req) }).select().single();
    if (error) throw error;
    await audit({ eventType: 'coupon.created', actorId: actor(req), targetType: 'coupon', targetId: data.id, summary: `Cupom criado: ${data.code}` });
    res.status(201).json({ coupon: data });
  } catch (error) { next(error); }
});
router.delete('/coupons/:id', requirePermission('coupons.manage'), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('coupons').update({ is_active: false }).eq('id', req.params.id).select('id, code').single();
    if (error) throw error;
    await audit({ eventType: 'coupon.deleted', actorId: actor(req), targetType: 'coupon', targetId: data.id, summary: `Cupom desativado: ${data.code}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/orders', requirePermission('orders.view'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(250);
    if (error) throw error;
    res.json({ orders: data });
  } catch (error) { next(error); }
});
router.patch('/orders/:id/fulfillment', requirePermission('orders.fulfill'), validate(z.object({ status: z.enum(['pending', 'fulfilled', 'refunded']) })), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('orders').update({ fulfillment_status: req.body.status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await audit({ eventType: 'order.fulfillment_updated', actorId: actor(req), targetType: 'order', targetId: data.id, summary: `Entrega do pedido ${data.id.slice(0, 8)} alterada para ${data.fulfillment_status}` });
    res.json({ order: data });
  } catch (error) { next(error); }
});

router.get('/roles', requirePermission('team.manage'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('staff_roles').select('*').order('name');
    if (error) throw error;
    res.json({ roles: data, permissions: ALL_PERMISSIONS });
  } catch (error) { next(error); }
});
router.post('/roles', requireOwner, validate(roleSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('staff_roles').insert(req.body).select().single();
    if (error) throw error;
    await audit({ eventType: 'role.created', actorId: actor(req), targetType: 'role', targetId: data.id, summary: `Cargo criado: ${data.name}` });
    res.status(201).json({ role: data });
  } catch (error) { next(error); }
});
router.delete('/roles/:id', requireOwner, async (req, res, next) => {
  try {
    const role = await requireExisting('staff_roles', 'id', req.params.id);
    if (!role) return res.status(404).json({ error: 'not_found' });
    if (role.is_system) return res.status(409).json({ error: 'system_role' });
    const { count, error: countError } = await supabase.from('staff_members').select('*', { count: 'exact', head: true }).eq('role_id', role.id);
    if (countError) throw countError;
    if (count) return res.status(409).json({ error: 'role_has_members' });
    const { error } = await supabase.from('staff_roles').delete().eq('id', role.id);
    if (error) throw error;
    await audit({ eventType: 'role.deleted', actorId: actor(req), targetType: 'role', targetId: role.id, summary: `Cargo apagado: ${role.name}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/profiles/search', requirePermission('team.manage'), validate(z.object({ q: z.string().trim().min(2).max(80) }), 'query'), async (req, res, next) => {
  try {
    const term = req.query.q.replace(/[,%_]/g, '');
    const { data, error } = await supabase.from('profiles').select('id, full_name, email, avatar_url').ilike('full_name', `%${term}%`).limit(20);
    if (error) throw error;
    res.json({ profiles: data });
  } catch (error) { next(error); }
});
router.get('/staff', requirePermission('team.manage'), async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('staff_members').select('user_id, role_id, is_active, created_at, profiles(full_name, email), staff_roles(name)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ staff: data });
  } catch (error) { next(error); }
});
router.put('/staff/:userId', requirePermission('team.manage'), validate(z.object({ role_id: id, is_active: z.boolean().default(true) })), async (req, res, next) => {
  try {
    const profile = await requireExisting('profiles', 'id', req.params.userId);
    const role = await requireExisting('staff_roles', 'id', req.body.role_id);
    if (!profile || !role) return res.status(404).json({ error: 'not_found' });
    if (isAdmin(profile.email)) return res.status(409).json({ error: 'owner_managed_by_environment' });
    const { data, error } = await supabase.from('staff_members').upsert({ user_id: profile.id, role_id: role.id, is_active: req.body.is_active, assigned_by: actor(req), updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    await audit({ eventType: 'staff.added', actorId: actor(req), targetType: 'staff', targetId: data.user_id, summary: `Colaborador definido: ${profile.full_name || profile.email} (${role.name})` });
    res.json({ staff: data });
  } catch (error) { next(error); }
});
router.delete('/staff/:userId', requirePermission('team.manage'), async (req, res, next) => {
  try {
    const profile = await requireExisting('profiles', 'id', req.params.userId);
    if (!profile) return res.status(404).json({ error: 'not_found' });
    const { error } = await supabase.from('staff_members').delete().eq('user_id', profile.id);
    if (error) throw error;
    await audit({ eventType: 'staff.removed', actorId: actor(req), targetType: 'staff', targetId: profile.id, summary: `Colaborador removido: ${profile.full_name || profile.email}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/settings', requireOwner, async (_req, res, next) => {
  try {
    const [{ data: branding, error: brandingError }, { data: webhooks, error: webhooksError }, paymentReady] = await Promise.all([
      supabase.from('store_settings').select('value, updated_at').eq('key', 'branding').maybeSingle(),
      supabase.from('discord_webhooks').select('id, name, event_type, is_active, created_at').order('created_at', { ascending: false }),
      paymentConfigured(),
    ]);
    if (brandingError) throw brandingError;
    if (webhooksError) throw webhooksError;
    res.json({ branding: branding?.value || {}, paymentConfigured: paymentReady, webhooks, eventTypes: EVENT_TYPES });
  } catch (error) { next(error); }
});
router.put('/settings/branding', requireOwner, validate(z.object({ storeName: z.string().trim().min(2).max(60), developer: z.string().trim().max(100), copyright: z.string().trim().max(150), supportEmail: z.string().trim().email().max(254).optional() })), async (req, res, next) => {
  try {
    const { error } = await supabase.from('store_settings').upsert({ key: 'branding', value: req.body, updated_by: actor(req), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    await audit({ eventType: 'settings.updated', actorId: actor(req), targetType: 'settings', targetId: 'branding', summary: 'Configuracoes de marca atualizadas' });
    res.json({ branding: req.body });
  } catch (error) { next(error); }
});
router.put('/settings/mercado-pago', requireOwner, validate(z.object({ accessToken: z.string().trim().min(20).max(500).optional(), webhookSecret: z.string().trim().min(20).max(500).optional() })), async (req, res, next) => {
  try {
    await setPaymentConfig(req.body);
    await audit({ eventType: 'settings.updated', actorId: actor(req), targetType: 'settings', targetId: 'mercado_pago', summary: 'Configuracao do Mercado Pago atualizada' });
    res.json({ paymentConfigured: true });
  } catch (error) { next(error); }
});
router.post('/settings/discord-webhooks', requireOwner, validate(webhookSchema), async (req, res, next) => {
  try {
    if (!discordUrl(req.body.url)) return res.status(400).json({ error: 'invalid_discord_webhook' });
    const { data, error } = await supabase.from('discord_webhooks').insert({ name: req.body.name, event_type: req.body.event_type, encrypted_url: encrypt(req.body.url), created_by: actor(req) }).select('id, name, event_type, is_active, created_at').single();
    if (error) throw error;
    await audit({ eventType: 'settings.updated', actorId: actor(req), targetType: 'discord_webhook', targetId: data.id, summary: `Webhook de log criado: ${data.name}` });
    res.status(201).json({ webhook: data });
  } catch (error) { next(error); }
});
router.delete('/settings/discord-webhooks/:id', requireOwner, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('discord_webhooks').delete().eq('id', req.params.id).select('id, name').single();
    if (error) throw error;
    await audit({ eventType: 'settings.updated', actorId: actor(req), targetType: 'discord_webhook', targetId: data.id, summary: `Webhook de log removido: ${data.name}` });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/logs', requirePermission('logs.view'), async (req, res, next) => {
  try {
    const eventType = req.query.eventType;
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(250);
    if (eventType && EVENT_TYPES.includes(eventType)) query = query.eq('event_type', eventType);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ logs: data, eventTypes: EVENT_TYPES });
  } catch (error) { next(error); }
});

module.exports = router;