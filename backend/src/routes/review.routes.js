import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Review } from '../models/review.model.js';
import { Session } from '../models/session.model.js';
import { Booking } from '../models/booking.model.js';
import { Master } from '../models/master.model.js';
import { syncMasterReviewKPIs } from '../utils/review-sync.js';
import { getPublicDisplayName } from '../utils/privacy.js';
import mongoose from 'mongoose';

const router = Router();

// Create a review
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { session_id, rating, text } = req.body;
    
    // Try to find as a Session first
    let sess = await Session.findById(session_id).populate('master_id', 'user_id');
    let reviewerType, revieweeId, actualSessionId = session_id;
    
    if (sess) {
      // Handle voice session
      if (sess.status !== 'ended') {
        return res.status(400).json({ message: 'Session not found or not ended' });
      }
      
      const isClient = String(sess.user_id) === String(req.user._id);
      
      if (isClient) {
        reviewerType = 'client';
        revieweeId = sess.master_id.user_id;
      } else {
        return res.status(403).json({ message: 'Only clients can leave reviews' });
      }
    } else {
      // Try to find as a ChatThread
      const { ChatThread } = await import('../models/chat-thread.model.js');
      const thread = await ChatThread.findById(session_id);
      
      if (!thread || thread.status !== 'expired') {
        return res.status(400).json({ message: 'Session not found or not ended' });
      }
      
      const isClient = String(thread.customer_id) === String(req.user._id);
      
      if (isClient) {
        reviewerType = 'client';
        revieweeId = thread.master_user_id;
      } else {
        return res.status(403).json({ message: 'Only clients can leave reviews' });
      }
      
      // Use thread ID as session ID for chat reviews
      actualSessionId = thread._id;
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ session_id: actualSessionId, reviewer_id: req.user._id });
    if (existingReview) {
      return res.status(400).json({ message: 'Review already submitted for this session' });
    }

    const review = await Review.create({
      session_id: actualSessionId,
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

// Get reviews for a user (as reviewee)
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, reviewer_type } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

    const filter = { reviewee_id: userId };
    if (reviewer_type) filter.reviewer_type = reviewer_type;

    const reviews = await Review.find(filter)
      .populate('reviewer_id', 'display_name avatar_url')
      .populate('session_id', 'channel createdAt')
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

// Check if user can review a session
router.get('/session/:sessionId/can-review', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Try to find as a Session first
    let sess = await Session.findById(sessionId).populate('master_id', 'user_id');
    let canReview = false;
    
    if (sess) {
      // Handle voice session
      if (sess.status !== 'ended') {
        return res.json({ canReview: false, reason: 'Session not found or not ended' });
      }
      
      const isClient = String(sess.user_id) === String(req.user._id);
      
      if (!isClient) {
        return res.json({ canReview: false, reason: 'Only clients can leave reviews' });
      }
      
      canReview = true;
    } else {
      // Try to find as a ChatThread
      const { ChatThread } = await import('../models/chat-thread.model.js');
      const thread = await ChatThread.findById(sessionId);
      
      if (!thread || thread.status !== 'expired') {
        return res.json({ canReview: false, reason: 'Session not found or not ended' });
      }
      
      const isClient = String(thread.customer_id) === String(req.user._id);
      
      if (!isClient) {
        return res.json({ canReview: false, reason: 'Only clients can leave reviews' });
      }
      
      canReview = true;
    }

    if (canReview) {
      const existingReview = await Review.findOne({ session_id: sessionId, reviewer_id: req.user._id });
      if (existingReview) {
        return res.json({ canReview: false, reason: 'Already reviewed' });
      }
    }

    res.json({ canReview });
  } catch (e) { next(e); }
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
    
    console.log('Created booking review:', review); // Debug log
    
    // Update master KPIs if this is a client reviewing a master
    if (reviewerType === 'client') {
      console.log('Syncing KPIs for master:', revieweeId); // Debug log
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
