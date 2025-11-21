import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewer_type: { type: String, enum: ['client', 'master'], required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, maxlength: 1000 },
  flagged: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index to prevent duplicate reviews for same session and reviewer
reviewSchema.index({ session_id: 1, reviewer_id: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
