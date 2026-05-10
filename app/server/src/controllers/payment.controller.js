import Stripe from 'stripe';
import prisma from '../config/prisma.js';

// Read Stripe key lazily (at call time) to avoid ES module hoisting issue
// where process.env is not yet populated at module evaluation time.
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('your_stripe')) {
    throw new Error('STRIPE_SECRET_KEY is not configured in .env');
  }
  return new Stripe(key);
};

/**
 * Verifies that a Stripe PaymentIntent exists and has status 'succeeded'.
 * Returns the PaymentIntent on success, throws on failure.
 */
export const verifyPaymentIntent = async (paymentIntentId) => {
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    throw new Error('Invalid payment intent ID');
  }
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') {
    throw new Error(`Payment not completed (status: ${pi.status})`);
  }
  return pi;
};

export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, orderId, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency: process.env.STRIPE_CURRENCY || 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: orderId || '',
        userId: req.user?.id || 'guest',
        paymentMethod: paymentMethod || 'stripe',
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Create payment intent error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to create payment intent' });
  }
};

export const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      if (paymentIntent.metadata.orderId) {
        await prisma.order.update({
          where: { id: paymentIntent.metadata.orderId },
          data: { stripePayId: paymentIntent.id, status: 'PROCESSING' },
        }).catch(console.error);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      console.log('Payment failed:', event.data.object.id);
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};

export const getPaymentStatus = async (req, res) => {
  try {
    const stripe = getStripe();
    const { paymentIntentId } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    res.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    console.error('Get payment status error:', error.message);
    res.status(500).json({ message: 'Failed to get payment status' });
  }
};