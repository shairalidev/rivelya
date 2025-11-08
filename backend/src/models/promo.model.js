import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true },
  rule_json: { type: Object, required: true },
  active_window: {
    start: Date,
    end: Date
  },
  redemptions: { type: Number, default: 0 }
}, { timestamps: true });

export const Promo = mongoose.model('Promo', promoSchema);
