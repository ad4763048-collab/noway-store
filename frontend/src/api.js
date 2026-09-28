const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(API_URL + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'request_failed');
  return data;
}

export const api = {
  getProducts: () => request('/api/products'), getStore: () => request('/api/store'), getMe: () => request('/auth/me'),
  loginWithGoogle: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }), logout: () => request('/auth/logout', { method: 'POST' }),
  checkout: (items, captchaToken, idempotencyKey, couponCode) => request('/api/orders/checkout', { method: 'POST', body: JSON.stringify({ items, captchaToken, idempotencyKey, couponCode }) }), getOrders: () => request('/api/orders'), getDownloads: (orderId) => request(`/api/orders/${orderId}/downloads`),
  getAdminAccess: () => request('/api/admin/access'), getAdminOverview: () => request('/api/admin/overview'),
  getAdminProducts: () => request('/api/admin/products'), createProduct: (product) => request('/api/admin/products', { method: 'POST', body: JSON.stringify(product) }), updateProduct: (id, product) => request(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(product) }), deleteProduct: (id) => request(`/api/admin/products/${id}`, { method: 'DELETE' }),
  getAdminCategories: () => request('/api/admin/categories'), createCategory: (category) => request('/api/admin/categories', { method: 'POST', body: JSON.stringify(category) }), deleteCategory: (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  getAdminCoupons: () => request('/api/admin/coupons'), createCoupon: (coupon) => request('/api/admin/coupons', { method: 'POST', body: JSON.stringify(coupon) }), deleteCoupon: (id) => request(`/api/admin/coupons/${id}`, { method: 'DELETE' }),
  getAdminOrders: () => request('/api/admin/orders'), updateFulfillment: (id, status) => request(`/api/admin/orders/${id}/fulfillment`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getRoles: () => request('/api/admin/roles'), createRole: (role) => request('/api/admin/roles', { method: 'POST', body: JSON.stringify(role) }), deleteRole: (id) => request(`/api/admin/roles/${id}`, { method: 'DELETE' }),
  searchProfiles: (q) => request(`/api/admin/profiles/search?q=${encodeURIComponent(q)}`), getStaff: () => request('/api/admin/staff'), saveStaff: (userId, staff) => request(`/api/admin/staff/${userId}`, { method: 'PUT', body: JSON.stringify(staff) }), removeStaff: (userId) => request(`/api/admin/staff/${userId}`, { method: 'DELETE' }),
  getSettings: () => request('/api/admin/settings'), saveBranding: (branding) => request('/api/admin/settings/branding', { method: 'PUT', body: JSON.stringify(branding) }), saveMercadoPago: (settings) => request('/api/admin/settings/mercado-pago', { method: 'PUT', body: JSON.stringify(settings) }), createDiscordWebhook: (webhook) => request('/api/admin/settings/discord-webhooks', { method: 'POST', body: JSON.stringify(webhook) }), deleteDiscordWebhook: (id) => request(`/api/admin/settings/discord-webhooks/${id}`, { method: 'DELETE' }),
  getLogs: (eventType) => request(`/api/admin/logs${eventType ? `?eventType=${encodeURIComponent(eventType)}` : ''}`),
  saveConsent: (categories) => request('/api/consents', { method: 'POST', body: JSON.stringify({ categories }) }),
};