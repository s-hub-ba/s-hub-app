import { Router } from 'express';

const router = Router();

// Stub: Create a PayPal Subscription
router.post('/create-subscription', async (req, res) => {
  try {
    const { planId, agencyId } = req.body;
    
    // In a real app, you would call the PayPal REST API here:
    // POST https://api-m.sandbox.paypal.com/v1/billing/subscriptions
    
    console.log(`[PayPal] Creating subscription for Agency ${agencyId} with Plan ${planId}`);
    
    res.json({ 
      id: `sub_stub_${Date.now()}`, 
      status: 'APPROVAL_PENDING',
      links: [
        { href: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-123', rel: 'approve' }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Stub: PayPal Webhook Handler
router.post('/webhook', (req, res) => {
  const event = req.body;
  
  // In a real app, verify the webhook signature using PayPal SDK
  console.log(`[PayPal Webhook] Received event: ${event.event_type}`);

  switch (event.event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      console.log('Subscription activated:', event.resource.id);
      // Update agency subscription_tier in Supabase
      break;
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      console.log('Subscription cancelled:', event.resource.id);
      // Downgrade agency to free/inactive tier in Supabase
      break;
    case 'PAYMENT.SALE.COMPLETED':
      console.log('Payment completed for subscription:', event.resource.billing_agreement_id);
      // Record payment in billing history
      break;
    default:
      console.log('Unhandled event type:', event.event_type);
  }

  // Always return 200 OK to acknowledge receipt
  res.sendStatus(200);
});

export default router;
