const express = require('express');
const { requireUser } = require('../middleware/auth');
const {
  createProSubscription,
  fetchMercadoPagoSubscription,
  getBaseUrl,
  getProPlan,
  syncUserSubscription,
} = require('../services/subscription.service');

const router = express.Router();

router.get('/status', requireUser, (req, res) => {
  res.json({
    plan: req.user.plan || 'free',
    subscriptionStatus: req.user.subscription_status || 'inactive',
    subscriptionId: req.user.subscription_id || null,
    product: getProPlan(),
  });
});

router.post('/checkout', requireUser, async (req, res, next) => {
  try {
    const result = await createProSubscription({
      user: req.user,
      baseUrl: getBaseUrl(req),
    });
    if (!result.checkoutUrl) {
      return res.status(502).json({ message: 'Mercado Pago no devolvio un enlace de pago.' });
    }
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/webhook', async (req, res, next) => {
  const subscriptionId = req.body?.data?.id || req.body?.id || req.query.id;
  if (!subscriptionId) return res.status(202).json({ ok: true });

  try {
    const subscription = await fetchMercadoPagoSubscription(subscriptionId);
    const reference = String(subscription.external_reference || '');
    const [, userId] = reference.split(':');
    if (userId) await syncUserSubscription({ userId, subscription });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
