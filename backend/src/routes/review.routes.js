import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Review } from '../models/review.model.js';
import { Booking } from '../models/booking.model.js';
import { syncMasterReviewKPIs } from '../utils/review-sync.js';
import mongoose from 'mongoose';

const router = Router();

// Session-based reviews are deprecated/disabled
router.post('/', requireAuth, (req, res) => {
  return res.status(410).json({ message: 'Session reviews are disabled. Please submit a booking review.' });
});

// Get reviews for a user (as reviewee)
// Get reviews for a master (as reviewee)
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

    // Always filter: master receives reviews ONLY from clients
    const filter = {
      reviewee_id: userId,
      reviewer_type: 'client'
    };

    const reviews = await Review.find(filter)
      .populate('reviewer_id', 'display_name avatar_url')
      .populate('booking_id', 'channel createdAt')
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip((parsedPage - 1) * parsedLimit);

    const total = await Review.countDocuments(filter);

    res.json({
      reviews,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (e) { next(e); }
});


// Session review checks are disabled
router.get('/session/:sessionId/can-review', requireAuth, (req, res) => {
  return res.status(410).json({ canReview: false, reason: 'Session reviews are disabled. Please review the booking.' });
});

// Create a review for a booking
router.post('/booking', requireAuth, async (req, res, next) => {
  try {
    const { booking_id, rating, text } = req.body;
    
    const booking = await Booking.findById(booking_id)
      .populate('master_id', 'user_id')
      .populate('customer_id', '_id');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed to review' });
    }
    
    const isClient = String(booking.customer_id._id) === String(req.user._id);
    
    if (!isClient) {
      return res.status(403).json({ message: 'Only clients can leave reviews' });
    }
    
    const reviewerType = 'client';
    const revieweeId = booking.master_id.user_id;
    
    // Check if review already exists
    const existingReview = await Review.findOne({ booking_id, reviewer_id: req.user._id });
    if (existingReview) {
      return res.status(400).json({ message: 'Review already submitted for this booking' });
    }
    
    const review = await Review.create({
      booking_id,
      reviewer_id: req.user._id,
      reviewee_id: revieweeId,
      reviewer_type: reviewerType,
      rating,
      text
    });
    
    // Update master KPIs if this is a client reviewing a master
    if (reviewerType === 'client') {
      await syncMasterReviewKPIs(revieweeId);
    }
    
    res.json(review);
  } catch (e) { next(e); }
});

// Check if user can review a booking
router.get('/booking/:bookingId/can-review', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate('master_id', 'user_id')
      .populate('customer_id', '_id');
    
    if (!booking) {
      return res.json({ canReview: false, reason: 'Booking not found' });
    }
    
    if (booking.status !== 'completed') {
      return res.json({ canReview: false, reason: 'Booking not completed' });
    }
    
    const isClient = String(booking.customer_id._id) === String(req.user._id);
    
    if (!isClient) {
      return res.json({ canReview: false, reason: 'Only clients can leave reviews' });
    }
    
    const existingReview = await Review.findOne({ booking_id: bookingId, reviewer_id: req.user._id });
    if (existingReview) {
      return res.json({ canReview: false, reason: 'Already reviewed', hasReviewed: true });
    }
    
    res.json({ canReview: true });
  } catch (e) { next(e); }
});

// Add reply to a review (masters only)
router.post('/:reviewId/reply', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if the current user is the master who received this review
    if (String(review.reviewee_id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the reviewed master can reply' });
    }
    
    // Update the review with the reply
    review.reply = {
      text: text.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await review.save();
    
    res.json({ message: 'Reply added successfully', review });
  } catch (e) { next(e); }
});

// Update reply to a review (masters only)
router.put('/:reviewId/reply', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if the current user is the master who received this review
    if (String(review.reviewee_id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the reviewed master can reply' });
    }
    
    if (!review.reply) {
      return res.status(404).json({ message: 'No reply found to update' });
    }
    
    // Update the reply
    review.reply.text = text.trim();
    review.reply.updatedAt = new Date();
    
    await review.save();
    
    res.json({ message: 'Reply updated successfully', review });
  } catch (e) { next(e); }
});

export default router;
