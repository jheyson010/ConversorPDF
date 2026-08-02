const db = require('../db/database');

const MERCADO_PAGO_PREAPPROVAL_URL = 'https://api.mercadopago.com/preapproval';
const PRO_PLAN = {
  id: 'pro',
  label: 'DocFlow Pro',
  amount: 6,
  currency: 'PEN',
  frequency: 1,
  frequencyType: 'months',
};

function getAccessToken() {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN && !process.env.MP_ACCESS_TOKEN) {
    try { require('dotenv').config({ quiet: true }); } catch (_e) {}
  }
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '';
}

function getProPlan() {
  return {
    ...PRO_PLAN,
    amount: Number(process.env.DOCFLOW_PRO_MONTHLY_AMOUNT || PRO_PLAN.amount),
    currency: process.env.DOCFLOW_PRO_CURRENCY || PRO_PLAN.currency,
  };
}

function getBaseUrl(req) {
  const configured = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL;
  if (configured) {
    const value = configured.startsWith('http') ? configured : `https://${configured}`;
    return value.replace(/\/$/, '');
  }
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

function mercadoPagoHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function formatBackUrl(baseUrl) {
  const clean = String(baseUrl || '').trim();
  if (clean && !clean.includes('localhost') && !clean.includes('127.0.0.1')) {
    const formatted = clean.startsWith('http') ? clean : `https://${clean}`;
    return `${formatted.replace(/\/$/, '')}/dashboard.html?subscription=return`;
  }
  const publicUrl = process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL || 'https://canastamarket.online';
  const formatted = publicUrl.startsWith('http') ? publicUrl : `https://${publicUrl}`;
  return `${formatted.replace(/\/$/, '')}/dashboard.html?subscription=return`;
}

function subscriptionPayload({ user, baseUrl }) {
  const plan = getProPlan();
  return {
    reason: `${plan.label} mensual`,
    external_reference: `docflow:${user.id}:${Date.now()}`,
    payer_email: user.email,
    auto_recurring: {
      frequency: plan.frequency,
      frequency_type: plan.frequencyType,
      transaction_amount: plan.amount,
      currency_id: plan.currency,
    },
    back_url: formatBackUrl(baseUrl),
    status: 'pending',
  };
}

async function parseMercadoPagoResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.error || 'Mercado Pago no pudo crear la suscripcion.';
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createProSubscription({ user, baseUrl, fetchImpl = fetch }) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    const error = new Error('Falta configurar MERCADO_PAGO_ACCESS_TOKEN para activar la suscripcion.');
    error.status = 503;
    throw error;
  }

  const payload = subscriptionPayload({ user, baseUrl });
  const response = await fetchImpl(MERCADO_PAGO_PREAPPROVAL_URL, {
    method: 'POST',
    headers: mercadoPagoHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  const data = await parseMercadoPagoResponse(response);

  await db.update(
    'users',
    {
      subscription_status: data.status || 'pending',
      subscription_id: data.id || null,
      subscription_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    'id = ?',
    [user.id]
  );

  return {
    id: data.id,
    status: data.status || 'pending',
    checkoutUrl: data.init_point || data.sandbox_init_point || null,
    payload,
  };
}

function planFromSubscriptionStatus(status) {
  return ['authorized', 'active'].includes(String(status || '').toLowerCase()) ? 'pro' : 'free';
}

async function syncUserSubscription({ userId, subscription }) {
  const status = subscription.status || 'pending';
  const plan = planFromSubscriptionStatus(status);
  await db.update(
    'users',
    {
      plan,
      subscription_status: status,
      subscription_id: subscription.id || null,
      subscription_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    'id = ?',
    [userId]
  );
  return { plan, status };
}

async function fetchMercadoPagoSubscription(id, fetchImpl = fetch) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    const error = new Error('Falta configurar MERCADO_PAGO_ACCESS_TOKEN.');
    error.status = 503;
    throw error;
  }
  const response = await fetchImpl(`${MERCADO_PAGO_PREAPPROVAL_URL}/${encodeURIComponent(id)}`, {
    headers: mercadoPagoHeaders(accessToken),
  });
  return parseMercadoPagoResponse(response);
}

module.exports = {
  MERCADO_PAGO_PREAPPROVAL_URL,
  getBaseUrl,
  getProPlan,
  subscriptionPayload,
  createProSubscription,
  fetchMercadoPagoSubscription,
  syncUserSubscription,
  planFromSubscriptionStatus,
};
