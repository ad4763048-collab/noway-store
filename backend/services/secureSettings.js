const crypto = require('crypto');
const { supabase } = require('../db');

function encryptionKey() {
  const key = Buffer.from(process.env.CONFIG_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('CONFIG_ENCRYPTION_KEY deve ter 32 bytes em base64.');
  return key;
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value) {
  const [ivValue, tagValue, payload] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
}

async function getPaymentConfig() {
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_WEBHOOK_SECRET) {
    return { accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN, webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET };
  }
  const { data, error } = await supabase.from('secure_settings').select('encrypted_value').eq('key', 'mercado_pago').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return JSON.parse(decrypt(data.encrypted_value));
}

async function setPaymentConfig(values) {
  const current = await getPaymentConfig().catch(() => null);
  const next = {
    accessToken: values.accessToken || current?.accessToken,
    webhookSecret: values.webhookSecret || current?.webhookSecret,
  };
  if (!next.accessToken || !next.webhookSecret) throw new Error('payment_configuration_incomplete');
  const { error } = await supabase.from('secure_settings').upsert({
    key: 'mercado_pago', encrypted_value: encrypt(JSON.stringify(next)), updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
}

async function paymentConfigured() {
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_WEBHOOK_SECRET) return true;
  const { data, error } = await supabase.from('secure_settings').select('key').eq('key', 'mercado_pago').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

module.exports = { encrypt, decrypt, getPaymentConfig, setPaymentConfig, paymentConfigured };
