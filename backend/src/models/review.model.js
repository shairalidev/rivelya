import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, maxlength: 1000 },
  flagged: { type: Boolean, default: false }
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
