import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  balance_cents: { type: Number, default: 0 },
  currency: { type: String, default: 'EUR' },
  promo_flags: { type: Object, default: {} }
}, { timestamps: true });

export const Wallet = mongoose.model('Wallet', walletSchema);
