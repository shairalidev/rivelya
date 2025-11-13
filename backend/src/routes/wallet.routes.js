import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { payments } from '../services/payments.service.js';

const router = Router();

router.get('/ledger', requireAuth, async (req, res, next) => {
  try {
    const wallet = await Wallet.findById(req.user.wallet_id);
    const txns = await Transaction.find({ wallet_id: wallet._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ balance_cents: wallet.balance_cents, currency: wallet.currency, ledger: txns });
  } catch (e) { next(e); }
});

router.post('/topup', requireAuth, async (req, res, next) => {
  try {
    const { provider, amount_cents } = req.body; // provider: stripe|paypal
    const session = await payments.createCheckoutSession({ provider, amount_cents, user: req.user });
    res.json(session);
  } catch (e) { next(e); }
});

router.post('/test-topup', requireAuth, async (req, res, next) => {
  try {
    const { card_number: cardNumber, amount_cents: amountCents } = req.body;
    const normalized = String(cardNumber || '').replace(/\s|-/g, '');
    if (normalized !== '4242424242424242') {
      return res.status(400).json({ message: 'Carta di test non riconosciuta.' });
    }

    const amount = Number(amountCents);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Importo non valido.' });
    }

    const wallet = await Wallet.findById(req.user.wallet_id);
    if (!wallet) return res.status(400).json({ message: 'Wallet non disponibile.' });

    wallet.balance_cents += amount;
    await wallet.save();

    const txn = await Transaction.create({
      wallet_id: wallet._id,
      type: 'topup',
      amount,
      meta: { description: 'Ricarica test card', card: '4242 **** **** 4242' }
    });

    res.status(201).json({
      balance_cents: wallet.balance_cents,
      currency: wallet.currency,
      transaction: txn
    });
  } catch (error) {
    next(error);
  }
});

export default router;
