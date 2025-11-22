import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewer_type: { type: String, enum: ['client'], required: true }, // Only clients can leave reviews
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, maxlength: 1000 },
  flagged: { type: Boolean, default: false },
  reply: {
    text: { type: String, maxlength: 500 },
    createdAt: { type: Date },
    updatedAt: { type: Date }
  }
}, { timestamps: true });

// Compound index to prevent duplicate reviews for same session and reviewer
// Only applies when a session_id exists to avoid collisions with booking-only reviews
reviewSchema.index(
  { session_id: 1, reviewer_id: 1 },
  {
    name: 'session_reviewer_unique',
    unique: true,
    partialFilterExpression: { session_id: { $exists: true, $ne: null } }
  }
);

// Compound index to prevent duplicate reviews for same booking and reviewer
// Only applies when a booking_id exists to avoid collisions with session-only reviews
reviewSchema.index(
  { booking_id: 1, reviewer_id: 1 },
  {
    name: 'booking_reviewer_unique',
    unique: true,
    partialFilterExpression: { booking_id: { $exists: true, $ne: null } }
  }
);

reviewSchema.on('init', (model) => {
  model
    .syncIndexes()
    .catch((error) => console.error('Failed to sync Review indexes', error));
});

export const Review = mongoose.model('Review', reviewSchema);
