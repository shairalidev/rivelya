import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Review } from '../models/review.model.js';
import { Session } from '../models/session.model.js';
import { Master } from '../models/master.model.js';
import { syncMasterReviewKPIs } from '../utils/review-sync.js';

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
      const isMaster = sess.master_id && String(sess.master_id.user_id) === String(req.user._id);
      
      if (isClient) {
        reviewerType = 'client';
        revieweeId = sess.master_id.user_id;
      } else if (isMaster) {
        reviewerType = 'master';
        revieweeId = sess.user_id;
      } else {
        return res.status(403).json({ message: 'Not authorized to review this session' });
      }
    } else {
      // Try to find as a ChatThread
      const { ChatThread } = await import('../models/chat-thread.model.js');
      const thread = await ChatThread.findById(session_id);
      
      if (!thread || thread.status !== 'expired') {
        return res.status(400).json({ message: 'Session not found or not ended' });
      }
      
      const isClient = String(thread.customer_id) === String(req.user._id);
      const isMaster = String(thread.master_user_id) === String(req.user._id);
      
      if (isClient) {
        reviewerType = 'client';
        revieweeId = thread.master_user_id;
      } else if (isMaster) {
        reviewerType = 'master';
        revieweeId = thread.customer_id;
      } else {
        return res.status(403).json({ message: 'Not authorized to review this session' });
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
    
    const filter = { reviewee_id: userId };
    if (reviewer_type) filter.reviewer_type = reviewer_type;
    
    const reviews = await Review.find(filter)
      .populate('reviewer_id', 'display_name avatar_url')
      .populate('session_id', 'channel createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments(filter);
    
    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
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
      const isMaster = sess.master_id && String(sess.master_id.user_id) === String(req.user._id);
      
      if (!isClient && !isMaster) {
        return res.json({ canReview: false, reason: 'Not authorized' });
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
      const isMaster = String(thread.master_user_id) === String(req.user._id);
      
      if (!isClient && !isMaster) {
        return res.json({ canReview: false, reason: 'Not authorized' });
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

export default router;
