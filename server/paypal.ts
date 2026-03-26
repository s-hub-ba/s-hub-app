import { Router } from 'express';
import { db } from './firebase.js';

const router = Router();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_BASE_URL = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const AGENCY_PLAN_PRICES: Record<string, number> = {
  starter: 29,
  professional: 59,
  enterprise: 149,
};

const AGENCY_PLAN_IDS: Record<string, string> = {
  starter: process.env.PAYPAL_PLAN_STARTER || '',
  professional: process.env.PAYPAL_PLAN_PROFESSIONAL || '',
  enterprise: process.env.PAYPAL_PLAN_ENTERPRISE || '',
};

function hasPaypalCredentials() {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

async function getPayPalAccessToken(): Promise<string> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to authenticate with PayPal: ${message}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `PayPal request failed for ${path}`);
  }

  return response.json();
}

async function requireAgencyBillingAccess(userId: string, agencyId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }

  const data = userDoc.data() || {};
  const role = data.role;
  const resolvedAgencyId = data.agency_id || data.agency_profile_id || (userId === agencyId ? agencyId : null);
  if (!['agency', 'agency_admin'].includes(role) || resolvedAgencyId !== agencyId) {
    throw new Error('Only an agency owner or admin can change billing.');
  }
}

async function requireNannyBillingAccess(userId: string, nannyId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'nanny' || userId !== nannyId) {
    throw new Error('Only the nanny can manage premium and credits.');
  }
}

async function upsertAgencySubscriptionRecord(agencyId: string, planCode: string, priceAtPurchase: number, extras: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const renewal = new Date();
  renewal.setMonth(renewal.getMonth() + 1);

  const snapshot = await db.collection('agency_subscriptions')
    .where('agency_id', '==', agencyId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.set({
      agency_id: agencyId,
      plan_code: planCode,
      status: 'active',
      renewal_date: renewal.toISOString(),
      price_at_purchase: priceAtPurchase,
      updated_at: now,
      ...extras,
    }, { merge: true });
  } else {
    await db.collection('agency_subscriptions').add({
      agency_id: agencyId,
      plan_code: planCode,
      status: 'active',
      start_date: now,
      renewal_date: renewal.toISOString(),
      price_at_purchase: priceAtPurchase,
      created_at: now,
      updated_at: now,
      ...extras,
    });
  }

  await db.collection('agency_profiles').doc(agencyId).set({
    plan_tier: planCode,
    updated_at: now,
  }, { merge: true });
}

async function extendNannyPremium(nannyId: string, months: number, metadata: Record<string, unknown> = {}) {
  const profileRef = db.collection('nanny_profiles').doc(nannyId);
  const profileSnap = await profileRef.get();
  const currentUntil = profileSnap.exists ? String(profileSnap.data()?.premium_until || '') : '';
  const baseDate = currentUntil && new Date(currentUntil).getTime() > Date.now() ? new Date(currentUntil) : new Date();
  baseDate.setMonth(baseDate.getMonth() + months);

  await profileRef.set({
    premium_until: baseDate.toISOString(),
    updated_at: new Date().toISOString(),
    ...metadata,
  }, { merge: true });

  return baseDate.toISOString();
}

async function addNannyCredits(nannyId: string, credits: number, metadata: Record<string, unknown> = {}) {
  const walletRef = db.collection('nanny_credit_wallets').doc(nannyId);
  const walletSnap = await walletRef.get();
  const currentBalance = walletSnap.exists ? Number(walletSnap.data()?.balance_credits || 0) : 0;
  const currentUsed = walletSnap.exists ? Number(walletSnap.data()?.lifetime_used_credits || 0) : 0;
  const now = new Date().toISOString();

  await walletRef.set({
    nanny_id: nannyId,
    balance_credits: currentBalance + credits,
    lifetime_used_credits: currentUsed,
    last_credit_refresh_at: now,
    updated_at: now,
    created_at: walletSnap.exists ? walletSnap.data()?.created_at || now : now,
    ...metadata,
  }, { merge: true });

  await db.collection('nanny_credit_ledger').add({
    nanny_id: nannyId,
    delta_credits: credits,
    reason: metadata.reason || 'PayPal credit purchase',
    created_at: now,
    ...metadata,
  });
}

function parseCustomId(customId: string | undefined) {
  const parts = String(customId || '').split('|');
  return {
    type: parts[0],
    subjectId: parts[1],
    detail: parts[2],
    userId: parts[3],
  };
}

router.post('/agency-plan/checkout', async (req, res) => {
  try {
    const { agencyId, userId, planCode, returnUrl, cancelUrl } = req.body || {};
    if (!agencyId || !userId || !planCode || !returnUrl || !cancelUrl) {
      return res.status(400).json({ error: 'agencyId, userId, planCode, returnUrl, and cancelUrl are required.' });
    }

    await requireAgencyBillingAccess(String(userId), String(agencyId));
    const price = AGENCY_PLAN_PRICES[String(planCode)];
    if (!price) {
      return res.status(400).json({ error: 'Unknown plan code.' });
    }

    if (!hasPaypalCredentials() || !AGENCY_PLAN_IDS[String(planCode)]) {
      await upsertAgencySubscriptionRecord(String(agencyId), String(planCode), price, {
        billing_provider: 'manual_dev_fallback',
      });
      return res.json({ simulatedApplied: true });
    }

    const subscription = await paypalRequest('/v1/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: AGENCY_PLAN_IDS[String(planCode)],
        custom_id: `agency_plan|${agencyId}|${planCode}|${userId}`,
        application_context: {
          brand_name: 'Shift Me Up',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const approveLink = Array.isArray(subscription.links)
      ? subscription.links.find((link: any) => link.rel === 'approve')?.href
      : null;

    return res.json({ subscriptionId: subscription.id, approvalUrl: approveLink });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to start agency checkout.' });
  }
});

router.post('/agency-plan/activate', async (req, res) => {
  try {
    const { agencyId, userId, planCode, subscriptionId } = req.body || {};
    if (!agencyId || !userId || !planCode) {
      return res.status(400).json({ error: 'agencyId, userId, and planCode are required.' });
    }

    await requireAgencyBillingAccess(String(userId), String(agencyId));
    const price = AGENCY_PLAN_PRICES[String(planCode)];
    if (!price) {
      return res.status(400).json({ error: 'Unknown plan code.' });
    }

    if (!hasPaypalCredentials() || !subscriptionId) {
      await upsertAgencySubscriptionRecord(String(agencyId), String(planCode), price, {
        billing_provider: 'manual_dev_fallback',
      });
      return res.json({ success: true, simulatedApplied: true });
    }

    const subscription = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, { method: 'GET' });
    await upsertAgencySubscriptionRecord(String(agencyId), String(planCode), price, {
      billing_provider: 'paypal',
      paypal_subscription_id: subscription.id,
      paypal_subscription_status: subscription.status,
    });

    return res.json({ success: true, status: subscription.status });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to activate agency plan.' });
  }
});

router.post('/nanny/premium/checkout', async (req, res) => {
  try {
    const { nannyId, userId, months = 1, returnUrl, cancelUrl } = req.body || {};
    if (!nannyId || !userId || !returnUrl || !cancelUrl) {
      return res.status(400).json({ error: 'nannyId, userId, returnUrl, and cancelUrl are required.' });
    }

    await requireNannyBillingAccess(String(userId), String(nannyId));
    const normalizedMonths = Math.max(1, Math.min(12, Number(months) || 1));
    const total = normalizedMonths * 19;

    if (!hasPaypalCredentials()) {
      const premiumUntil = await extendNannyPremium(String(nannyId), normalizedMonths, { billing_provider: 'manual_dev_fallback' });
      return res.json({ simulatedApplied: true, premiumUntil });
    }

    const order = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: `nanny_premium|${nannyId}|${normalizedMonths}|${userId}`,
          amount: {
            currency_code: 'USD',
            value: total.toFixed(2),
          },
          description: `${normalizedMonths} month premium access`,
        }],
        application_context: {
          brand_name: 'Shift Me Up',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const approveLink = Array.isArray(order.links)
      ? order.links.find((link: any) => link.rel === 'approve')?.href
      : null;

    return res.json({ orderId: order.id, approvalUrl: approveLink });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to start premium checkout.' });
  }
});

router.post('/nanny/credits/checkout', async (req, res) => {
  try {
    const { nannyId, userId, credits = 5, returnUrl, cancelUrl } = req.body || {};
    if (!nannyId || !userId || !returnUrl || !cancelUrl) {
      return res.status(400).json({ error: 'nannyId, userId, returnUrl, and cancelUrl are required.' });
    }

    await requireNannyBillingAccess(String(userId), String(nannyId));
    const normalizedCredits = Math.max(5, Math.min(50, Number(credits) || 5));
    const total = normalizedCredits * 2;

    if (!hasPaypalCredentials()) {
      await addNannyCredits(String(nannyId), normalizedCredits, {
        billing_provider: 'manual_dev_fallback',
        reason: 'Development credit purchase fallback',
      });
      return res.json({ simulatedApplied: true, credits: normalizedCredits });
    }

    const order = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: `nanny_credits|${nannyId}|${normalizedCredits}|${userId}`,
          amount: {
            currency_code: 'USD',
            value: total.toFixed(2),
          },
          description: `${normalizedCredits} development credits`,
        }],
        application_context: {
          brand_name: 'Shift Me Up',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const approveLink = Array.isArray(order.links)
      ? order.links.find((link: any) => link.rel === 'approve')?.href
      : null;

    return res.json({ orderId: order.id, approvalUrl: approveLink });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to start credits checkout.' });
  }
});

router.post('/nanny/order/capture', async (req, res) => {
  try {
    const { orderId, nannyId, userId } = req.body || {};
    if (!orderId || !nannyId || !userId) {
      return res.status(400).json({ error: 'orderId, nannyId, and userId are required.' });
    }

    await requireNannyBillingAccess(String(userId), String(nannyId));

    if (!hasPaypalCredentials()) {
      return res.json({ success: true, simulatedApplied: true });
    }

    const capture = await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST' });
    const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
      || capture.purchase_units?.[0]?.custom_id;
    const parsed = parseCustomId(customId);

    if (parsed.subjectId !== String(nannyId) || parsed.userId !== String(userId)) {
      return res.status(403).json({ error: 'Checkout does not belong to this nanny.' });
    }

    if (parsed.type === 'nanny_premium') {
      const premiumUntil = await extendNannyPremium(String(nannyId), Number(parsed.detail || 1), {
        billing_provider: 'paypal',
        paypal_order_id: orderId,
      });
      return res.json({ success: true, premiumUntil });
    }

    if (parsed.type === 'nanny_credits') {
      await addNannyCredits(String(nannyId), Number(parsed.detail || 5), {
        billing_provider: 'paypal',
        paypal_order_id: orderId,
        reason: 'PayPal development credit purchase',
      });
      return res.json({ success: true, credits: Number(parsed.detail || 5) });
    }

    return res.status(400).json({ error: 'Unknown nanny purchase type.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to capture PayPal order.' });
  }
});

router.post('/webhook', async (req, res) => {
  const event = req.body;
  console.log(`[PayPal Webhook] Received event: ${event?.event_type || 'unknown'}`);

  try {
    if (hasPaypalCredentials() && PAYPAL_WEBHOOK_ID && event?.event_type?.startsWith('BILLING.SUBSCRIPTION.')) {
      const resource = event.resource || {};
      const parsed = parseCustomId(resource.custom_id);
      if (parsed.type === 'agency_plan' && parsed.subjectId && parsed.detail) {
        await upsertAgencySubscriptionRecord(parsed.subjectId, parsed.detail, AGENCY_PLAN_PRICES[parsed.detail] || 29, {
          billing_provider: 'paypal',
          paypal_subscription_id: resource.id,
          paypal_subscription_status: resource.status || event.event_type,
        });
      }
    }
  } catch (error) {
    console.error('[PayPal Webhook] processing error:', error);
  }

  res.sendStatus(200);
});

export default router;
