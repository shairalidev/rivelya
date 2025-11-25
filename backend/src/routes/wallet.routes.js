import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { Master } from '../models/master.model.js';
import { Session } from '../models/session.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
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

router.post('/braintree/token', requireAuth, async (req, res, next) => {
  try {
    const clientToken = await payments.generateBraintreeClientToken(req.user._id);
    res.json({ clientToken });
  } catch (error) {
    next(error);
  }
});

router.post('/braintree/checkout', requireAuth, async (req, res, next) => {
  try {
    const { amount_cents: amountCents, payment_method_nonce: nonce } = req.body;
    if (!nonce) return res.status(400).json({ message: 'Metodo di pagamento non valido.' });
    const { wallet, transaction } = await payments.processBraintreeTopup({
      amount_cents: amountCents,
      paymentMethodNonce: nonce,
      userId: req.user._id
    });
    res.status(201).json({
      balance_cents: wallet.balance_cents,
      currency: wallet.currency,
      transaction
    });
  } catch (error) {
    next(error);
  }
});

router.get('/master/monthly-stats', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const master = await Master.findOne({ user_id: req.user._id }).select('_id');
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    const now = new Date();
    const parsedMonth = Number.parseInt(req.query.month, 10);
    const parsedYear = Number.parseInt(req.query.year, 10);
    const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getUTCMonth() + 1;
    const year = Number.isInteger(parsedYear) ? parsedYear : now.getUTCFullYear();

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));

    // Get voice sessions (voice and chat_voice)
    const voiceAggregates = await Session.aggregate([
      {
        $match: {
          master_id: master._id,
          status: 'ended',
          start_ts: { $gte: periodStart, $lt: periodEnd }
        }
      },
      {
        $group: {
          _id: '$channel',
          sessions: { $sum: 1 },
          durationSeconds: { $sum: { $ifNull: ['$duration_s', 0] } },
          totalCost: { $sum: { $ifNull: ['$cost_cents', 0] } }
        }
      }
    ]);

    // Get chat sessions from ChatThread
    const chatAggregates = await ChatThread.aggregate([
      {
        $match: {
          master_id: master._id,
          status: 'expired',
          createdAt: { $gte: periodStart, $lt: periodEnd }
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking_id',
          foreignField: '_id',
          as: 'booking'
        }
      },
      {
        $unwind: { path: '$booking', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          totalCost: { $sum: { $ifNull: ['$booking.amount_cents', 0] } }
        }
      }
    ]);

    const channels = ['chat', 'voice', 'chat_voice'];
    const stats = channels.reduce((acc, channel) => {
      acc[channel] = { count: 0, minutes: 0, earnings_cents: 0 };
      return acc;
    }, {});

    // Process voice sessions
    voiceAggregates.forEach(entry => {
      const channel = entry._id;
      if (!channel || !stats[channel]) return;
      const minutes = Math.round((entry.durationSeconds || 0) / 60);
      const earnings = Math.round((entry.totalCost || 0) * 0.3);
      stats[channel] = {
        count: entry.sessions || 0,
        minutes,
        earnings_cents: earnings
      };
    });

    // Process chat sessions
    if (chatAggregates.length > 0) {
      const chatData = chatAggregates[0];
      const earnings = Math.round((chatData.totalCost || 0) * 0.3);
      stats.chat = {
        count: chatData.sessions || 0,
        minutes: 0, // Chat sessions don't have duration tracking
        earnings_cents: earnings
      };
    }

    const totals = Object.values(stats).reduce((acc, value) => {
      acc.count += value.count;
      acc.minutes += value.minutes;
      acc.earnings_cents += value.earnings_cents;
      return acc;
    }, { count: 0, minutes: 0, earnings_cents: 0 });

    res.json({ year, month, stats, totals });
  } catch (error) {
    next(error);
  }
});

router.get('/master/recent-earnings', requireAuth, requireRole('master'), async (req, res, next) => {
  try {
    const master = await Master.findOne({ user_id: req.user._id }).select('_id');
    if (!master) return res.status(404).json({ message: 'Profilo master non trovato.' });

    // Get recent transactions related to this master
    const transactions = await Transaction.find({
      $or: [
        { 'meta.master_id': master._id },
        { 'meta.session_master_id': master._id }
      ],
      type: { $in: ['session_payment', 'master_earning', 'session_hold'] }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    res.json({ transactions });
  } catch (error) {
    next(error);
  }
});

export default router;
