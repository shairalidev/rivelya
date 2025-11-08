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

export default router;
