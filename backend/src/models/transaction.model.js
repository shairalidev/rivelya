import mongoose from 'mongoose';

const txnSchema = new mongoose.Schema({
  wallet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
  type: { type: String, enum: ['topup', 'spend', 'refund', 'adjust'], required: true },
  amount: { type: Number, required: true }, // cents, positive for topup/refund/adjust+, negative for spend/adjust-
  meta: { type: Object, default: {} },
  invoice_id: { type: String }
}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', txnSchema);
