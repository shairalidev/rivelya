import Stripe from 'stripe';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

export const payments = {
  async createCheckoutSession({ provider, amount_cents, user }) {
    if (provider !== 'stripe') {
      // PayPal stub
      return { provider, status: 'todo' };
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/wallet/success`,
      cancel_url: `${process.env.FRONTEND_URL}/wallet/cancel`,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Credit Top-up' },
          unit_amount: amount_cents
        },
        quantity: 1
      }],
      metadata: { user_id: String(user._id) }
    });
    return { provider: 'stripe', id: session.id, url: session.url };
  },

  async handleStripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const amount = session.amount_total;
        // credit wallet
        const wallet = await Wallet.findOne({ owner_id: userId });
        wallet.balance_cents += amount;
        await wallet.save();
        await Transaction.create({ wallet_id: wallet._id, type: 'topup', amount, meta: { stripe_session: session.id } });
      }
      res.json({ received: true });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
};
