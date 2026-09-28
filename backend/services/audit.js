const { supabase } = require('../db');
const { decrypt } = require('./secureSettings');

const EVENT_TYPES = [
  'all', 'product.created', 'product.updated', 'product.deleted', 'category.created', 'category.deleted',
  'customer.added', 'payment.approved', 'payment.rejected', 'coupon.created', 'coupon.deleted',
  'staff.added', 'staff.removed', 'role.created', 'order.fulfillment_updated', 'role.deleted', 'settings.updated',
];

function discordUrl(value) {
  try {
    const url = new URL(value);
    return (url.hostname === 'discord.com' || url.hostname === 'discordapp.com') && url.pathname.startsWith('/api/webhooks/') ? url : null;
  } catch {
    return null;
  }
}

async function sendDiscord(eventType, entry) {
  const { data, error } = await supabase.from('discord_webhooks').select('encrypted_url').eq('is_active', true).in('event_type', [eventType, 'all']);
  if (error || !data?.length) return;
  const content = `**${eventType}**\n${entry.summary}`.slice(0, 1800);
  await Promise.allSettled(data.map(async ({ encrypted_url: encryptedUrl }) => {
    const url = discordUrl(decrypt(encryptedUrl));
    if (!url) return;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
  }));
}

async function audit({ eventType, actorId = null, targetType = null, targetId = null, summary, metadata = {} }) {
  const { data, error } = await supabase.from('audit_logs').insert({
    event_type: eventType, actor_id: actorId, target_type: targetType, target_id: targetId, summary, metadata,
  }).select().single();
  if (error) throw error;
  void sendDiscord(eventType, data);
  return data;
}

module.exports = { audit, EVENT_TYPES, discordUrl };
