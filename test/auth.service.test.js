const assert = require('node:assert/strict');
const test = require('node:test');
const { publicUser } = require('../src/services/auth.service');

test('publicUser exposes safe account and subscription fields', () => {
  const user = publicUser({
    id: 'user-1',
    email: 'persona@example.com',
    name: '',
    avatar_url: null,
    plan: 'pro',
    subscription_status: 'authorized',
    subscription_id: 'sub-123',
  });

  assert.deepEqual(user, {
    id: 'user-1',
    email: 'persona@example.com',
    name: 'persona',
    avatarUrl: null,
    plan: 'pro',
    subscriptionStatus: 'authorized',
    subscriptionId: 'sub-123',
  });
});

test('publicUser defaults new accounts to free inactive plan', () => {
  const user = publicUser({
    id: 'user-2',
    email: 'nuevo@example.com',
    name: 'Nuevo',
    avatar_url: 'https://example.com/a.png',
  });

  assert.equal(user.plan, 'free');
  assert.equal(user.subscriptionStatus, 'inactive');
  assert.equal(user.subscriptionId, null);
});
