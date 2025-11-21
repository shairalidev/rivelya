import { User } from '../models/user.model.js';

class PresenceService {
  constructor() {
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.socketUsers = new Map(); // socketId -> userId
  }

  async setUserOnline(userId, socketId) {
    try {
      const userIdStr = String(userId);
      
      // Track socket mapping
      if (!this.userSockets.has(userIdStr)) {
        this.userSockets.set(userIdStr, new Set());
      }
      this.userSockets.get(userIdStr).add(socketId);
      this.socketUsers.set(socketId, userIdStr);

      // Update database - always set online when new connection
      await User.findByIdAndUpdate(userId, {
        is_online: true,
        last_seen: new Date(),
        $addToSet: { socket_ids: socketId }
      });

      console.info('[presence] User online', { 
        userId: userIdStr, 
        socketId, 
        totalConnections: this.userSockets.get(userIdStr).size 
      });
      return true;
    } catch (error) {
      console.error('[presence] Error setting user online', { userId, socketId, error: error.message });
      return false;
    }
  }

  async setUserOffline(userId, socketId) {
    try {
      const userIdStr = String(userId);
      
      // Remove socket mapping
      if (this.userSockets.has(userIdStr)) {
        this.userSockets.get(userIdStr).delete(socketId);
        if (this.userSockets.get(userIdStr).size === 0) {
          this.userSockets.delete(userIdStr);
        }
      }
      this.socketUsers.delete(socketId);

      // Update database - only set offline if no other sockets
      const remainingSockets = this.userSockets.get(userIdStr)?.size || 0;
      const isOnline = remainingSockets > 0;
      
      await User.findByIdAndUpdate(userId, {
        is_online: isOnline,
        last_seen: new Date(),
        $pull: { socket_ids: socketId }
      });

      console.info('[presence] User connection removed', { 
        userId: userIdStr, 
        socketId, 
        remainingSockets, 
        isOnline 
      });
      return isOnline;
    } catch (error) {
      console.error('[presence] Error setting user offline', { userId, socketId, error: error.message });
      return false;
    }
  }

  async handleSocketDisconnect(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      await this.setUserOffline(userId, socketId);
    }
  }

  isUserOnline(userId) {
    return this.userSockets.has(String(userId)) && this.userSockets.get(String(userId)).size > 0;
  }

  getUserSocketCount(userId) {
    return this.userSockets.get(String(userId))?.size || 0;
  }

  // Cleanup stale connections periodically
  async cleanupStaleConnections() {
    try {
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      
      await User.updateMany(
        { 
          is_online: true,
          last_seen: { $lt: staleThreshold }
        },
        { 
          is_online: false,
          socket_ids: []
        }
      );

      console.info('[presence] Cleaned up stale connections');
    } catch (error) {
      console.error('[presence] Error cleaning up stale connections', { error: error.message });
    }
  }
}

export const presenceService = new PresenceService();

// Cleanup stale connections every 2 minutes
setInterval(() => {
  presenceService.cleanupStaleConnections();
}, 2 * 60 * 1000);