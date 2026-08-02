const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MERCADO_PAGO_PREAPPROVAL_URL,
  createProSubscription,
  getProPlan,
  planFromSubscriptionStatus,
  subscriptionPayload,
} = require('../src/services/subscription.service');
const db = require('../src/db/database');

test('subscriptionPayload builds a Mercado Pago monthly PEN 6 subscription', () => {
  const payload = subscriptionPayload({
    user: { id: 'user-123', email: 'cliente@example.com' },
    baseUrl: 'https://docflow.example.com',
  });

  assert.equal(payload.reason, 'DocFlow Pro mensual');
  assert.equal(payload.payer_email, 'cliente@example.com');
  assert.equal(payload.auto_recurring.frequency, 1);
  assert.equal(payload.auto_recurring.frequency_type, 'months');
  assert.equal(payload.auto_recurring.transaction_amount, 6);
  assert.equal(payload.auto_recurring.currency_id, 'PEN');
  assert.equal(payload.back_url, 'https://docflow.example.com/dashboard.html?subscription=return');
  assert.equal(payload.status, 'pending');
  assert.match(payload.external_reference, /^docflow:user-123:/);
});

test('getProPlan can be configured without changing code', () => {
  const previousAmount = process.env.DOCFLOW_PRO_MONTHLY_AMOUNT;
  const previousCurrency = process.env.DOCFLOW_PRO_CURRENCY;
  process.env.DOCFLOW_PRO_MONTHLY_AMOUNT = '9';
  process.env.DOCFLOW_PRO_CURRENCY = 'USD';

  const plan = getProPlan();

  assert.equal(plan.amount, 9);
  assert.equal(plan.currency, 'USD');

  if (previousAmount === undefined) delete process.env.DOCFLOW_PRO_MONTHLY_AMOUNT;
  else process.env.DOCFLOW_PRO_MONTHLY_AMOUNT = previousAmount;
  if (previousCurrency === undefined) delete process.env.DOCFLOW_PRO_CURRENCY;
  else process.env.DOCFLOW_PRO_CURRENCY = previousCurrency;
});

test('subscription status controls app plan safely', () => {
  assert.equal(planFromSubscriptionStatus('authorized'), 'pro');
  assert.equal(planFromSubscriptionStatus('active'), 'pro');
  assert.equal(planFromSubscriptionStatus('pending'), 'free');
  assert.equal(planFromSubscriptionStatus('cancelled'), 'free');
});

test('Mercado Pago preapproval endpoint is the subscriptions checkout endpoint', () => {
  assert.equal(MERCADO_PAGO_PREAPPROVAL_URL, 'https://api.mercadopago.com/preapproval');
});

test('createProSubscription posts to Mercado Pago and stores pending status', async () => {
  const previousToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-token';
  const previousUpdate = db.update;
  const updates = [];
  db.update = async (...args) => updates.push(args);

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 'preapproval-1',
        status: 'pending',
        init_point: 'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_id=preapproval-1',
      }),
    };
  };

  try {
    const result = await createProSubscription({
      user: { id: 'user-123', email: 'cliente@example.com' },
      baseUrl: 'https://docflow.example.com',
      fetchImpl,
    });

    assert.equal(result.checkoutUrl, 'https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_id=preapproval-1');
    assert.equal(calls[0].url, MERCADO_PAGO_PREAPPROVAL_URL);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer TEST-token');
    assert.equal(JSON.parse(calls[0].options.body).auto_recurring.transaction_amount, 6);
    assert.equal(updates.length, 1);
    assert.equal(updates[0][0], 'users');
    assert.equal(updates[0][1].subscription_status, 'pending');
    assert.equal(updates[0][1].subscription_id, 'preapproval-1');
  } finally {
    db.update = previousUpdate;
    if (previousToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    else process.env.MERCADO_PAGO_ACCESS_TOKEN = previousToken;
  }
});
