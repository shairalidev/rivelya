import { Review } from '../models/review.model.js';
import { Master } from '../models/master.model.js';

/**
 * Sync master KPIs with actual review data
 * This should be called whenever reviews are created, updated, or deleted
 */
export async function syncMasterReviewKPIs(masterUserId) {
  try {
    // Calculate real-time review statistics
    const reviewStats = await Review.aggregate([
      {
        $match: {
          reviewee_id: masterUserId,
          reviewer_type: 'client'
        }
      },
      {
        $group: {
          _id: null,
          avg_rating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = reviewStats.length > 0 ? {
      avg_rating: Math.round(reviewStats[0].avg_rating * 10) / 10,
      review_count: reviewStats[0].count
    } : {
      avg_rating: 0,
      review_count: 0
    };

    // Update master KPIs
    await Master.findOneAndUpdate(
      { user_id: masterUserId },
      {
        'kpis.avg_rating': stats.avg_rating,
        'kpis.review_count': stats.review_count
      }
    );

    return stats;
  } catch (error) {
    console.error('Error syncing master review KPIs:', error);
    throw error;
  }
}

/**
 * Sync all masters' review KPIs
 * Useful for data migration or periodic cleanup
 */
export async function syncAllMasterReviewKPIs() {
  try {
    const masters = await Master.find({}, 'user_id').lean();
    
    for (const master of masters) {
      if (master.user_id) {
        await syncMasterReviewKPIs(master.user_id);
      }
    }
    
    console.log(`Synced review KPIs for ${masters.length} masters`);
  } catch (error) {
    console.error('Error syncing all master review KPIs:', error);
    throw error;
  }
}