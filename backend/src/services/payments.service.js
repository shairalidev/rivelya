import Stripe from 'stripe';
import braintree from 'braintree';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { User } from '../models/user.model.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

const badRequest = message => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

let braintreeGateway;
function getBraintreeGateway() {
  if (braintreeGateway) return braintreeGateway;
  const { BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY, BRAINTREE_ENVIRONMENT } = process.env;
  const missing = [];
  if (!BRAINTREE_MERCHANT_ID) missing.push('BRAINTREE_MERCHANT_ID');
  if (!BRAINTREE_PUBLIC_KEY) missing.push('BRAINTREE_PUBLIC_KEY');
  if (!BRAINTREE_PRIVATE_KEY) missing.push('BRAINTREE_PRIVATE_KEY');
  if (missing.length) {
    const err = badRequest(`Braintree non configurato: manca ${missing.join(', ')}`);
    throw err;
  }
  const environment = (BRAINTREE_ENVIRONMENT || 'Sandbox').toLowerCase() === 'production'
    ? braintree.Environment.Production
    : braintree.Environment.Sandbox;
  braintreeGateway = new braintree.BraintreeGateway({
    environment,
    merchantId: BRAINTREE_MERCHANT_ID,
    publicKey: BRAINTREE_PUBLIC_KEY,
    privateKey: BRAINTREE_PRIVATE_KEY
  });
  return braintreeGateway;
}

async function ensureBraintreeCustomer(userId) {
  const gateway = getBraintreeGateway();
  if (!gateway) throw badRequest('Braintree non configurato');

  const user = await User.findById(userId);
  if (!user) throw badRequest('Utente non trovato');

  if (user.braintree_customer_id) return user.braintree_customer_id;

  const result = await gateway.customer.create({
    firstName: user.first_name || undefined,
    lastName: user.last_name || undefined,
    email: user.email,
    id: String(user._id)
  });

  if (!result.success) {
    throw badRequest('Impossibile creare il profilo di pagamento, riprova più tardi.');
  }

  user.braintree_customer_id = result.customer.id;
  await user.save();
  return user.braintree_customer_id;
}

export const payments = {
  async createCheckoutSession({ provider, amount_cents, user }) {
    if (provider === 'stripe') {
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
    }

    if (provider === 'braintree') {
      throw new Error('Per Braintree usa /wallet/braintree endpoints.');
    }

    return { provider, status: 'todo' };
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
  },

  async generateBraintreeClientToken(userId) {
    const gateway = getBraintreeGateway();
    if (!gateway) throw badRequest('Braintree non configurato.');
    const customerId = await ensureBraintreeCustomer(userId);
    const tokenResult = await gateway.clientToken.generate({ customerId });
    if (!tokenResult?.clientToken) throw badRequest('Impossibile generare il token di pagamento.');
    return tokenResult.clientToken;
  },

  async processBraintreeTopup({ amount_cents, paymentMethodNonce, userId }) {
    const gateway = getBraintreeGateway();
    if (!gateway) throw badRequest('Braintree non configurato.');
    const cents = Number(amount_cents);
    if (!cents || cents <= 0) throw badRequest('Importo non valido.');

    const customerId = await ensureBraintreeCustomer(userId);
    const amount = (cents / 100).toFixed(2);
    const saleResult = await gateway.transaction.sale({
      amount,
      paymentMethodNonce,
      customerId,
      options: { submitForSettlement: true }
    });

    if (!saleResult.success) {
      const deepErrors = typeof saleResult?.errors?.deepErrors === 'function'
        ? saleResult.errors.deepErrors()
        : [];
      const detail = deepErrors.map(err => `${err.code}: ${err.message}`).join(' | ');
      const processorText = saleResult?.transaction?.processorResponseText;
      const message = detail || processorText || saleResult.message || 'Pagamento non riuscito.';
      // Log minimal context to help debugging without sensitive payloads
      // eslint-disable-next-line no-console
      console.error('Braintree sale error', {
        message: saleResult.message,
        processorResponseText: processorText,
        errors: detail || null
      });
      throw badRequest(message);
    }

    const txn = saleResult.transaction;
    const wallet = await Wallet.findOne({ owner_id: userId });
    if (!wallet) throw badRequest('Wallet non disponibile.');

    wallet.balance_cents += cents;
    await wallet.save();

    const ledgerEntry = await Transaction.create({
      wallet_id: wallet._id,
      type: 'topup',
      amount: cents,
      meta: {
        provider: 'braintree',
        transaction_id: txn.id,
        status: txn.status,
        payment_instrument_type: txn.paymentInstrumentType,
        last_4: txn.creditCard?.last4 || txn.paypal?.payerId,
        currency: txn.currencyIsoCode
      }
    });

    return { wallet, transaction: ledgerEntry };
  }
};
