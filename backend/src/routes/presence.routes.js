import { Router } from 'express';
import { User } from '../models/user.model.js';
import { Master } from '../models/master.model.js';
import { presenceService } from '../services/presence.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /presence/stats - Get online users statistics (admin only)
router.get('/stats', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const [totalOnline, onlineMasters, onlineConsumers] = await Promise.all([
      User.countDocuments({ is_online: true }),
      User.aggregate([
        {
          $match: {
            is_online: true,
            roles: 'master'
          }
        },
        {
          $lookup: {
            from: 'masters',
            localField: '_id',
            foreignField: 'user_id',
            as: 'master_profile'
          }
        },
        {
          $match: {
            'master_profile.is_accepting_requests': { $ne: false }
          }
        },
        {
          $count: 'count'
        }
      ]),
      User.countDocuments({ 
        is_online: true,
        roles: 'consumer'
      })
    ]);

    res.json({
      total_online: totalOnline,
      online_masters: onlineMasters[0]?.count || 0,
      online_consumers: onlineConsumers,
      last_updated: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// GET /presence/debug - Debug presence status
router.get('/debug', async (req, res, next) => {
  try {
    const allUsers = await User.find({ is_online: true }).select('_id email roles is_online last_seen socket_ids').lean();
    const memoryStatus = {
      userSockets: Array.from(presenceService.userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size,
        sockets: Array.from(sockets)
      })),
      socketUsers: Array.from(presenceService.socketUsers.entries())
    };
    
    res.json({
      database: allUsers,
      memory: memoryStatus,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// GET /presence/online-masters - Get list of online masters
router.get('/online-masters', async (req, res, next) => {
  try {
    const onlineMasters = await User.aggregate([
      {
        $match: {
          is_online: true,
          roles: 'master'
        }
      },
      {
        $lookup: {
          from: 'masters',
          localField: '_id',
          foreignField: 'user_id',
          as: 'master_profile'
        }
      },
      {
        $unwind: '$master_profile'
      },
      {
        $match: {
          'master_profile.is_accepting_requests': { $ne: false },
          'master_profile.availability': 'online'
        }
      },
      {
        $project: {
          _id: '$master_profile._id',
          user_id: '$_id',
          display_name: '$master_profile.display_name',
          avatar_url: '$master_profile.media.avatar_url',
          categories: '$master_profile.categories',
          last_seen: '$last_seen',
          is_online: '$is_online'
        }
      }
    ]);

    res.json(onlineMasters);
  } catch (error) {
    next(error);
  }
});

export default router;