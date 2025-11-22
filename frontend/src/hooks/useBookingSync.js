import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Custom hook for managing real-time booking synchronization
 * Provides optimistic updates, conflict resolution, and smart polling
 */
export default function useBookingSync(socket, initialBookings = []) {
  const [bookings, setBookings] = useState(initialBookings);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const updateQueue = useRef(new Map());
  const conflictResolver = useRef(null);

  // Optimistic update function
  const updateBookingOptimistically = useCallback((bookingId, updates, options = {}) => {
    const { showToast = false, toastMessage = '' } = options;
    
    setBookings(prev => prev.map(booking => 
      booking.id === bookingId 
        ? { ...booking, ...updates, _optimistic: true }
        : booking
    ));

    if (showToast && toastMessage) {
      toast(toastMessage);
    }

    // Queue for server sync
    updateQueue.current.set(bookingId, {
      updates,
      timestamp: Date.now(),
      optimistic: true
    });
  }, []);

  // Server update function (removes optimistic flag)
  const updateBookingFromServer = useCallback((bookingId, updates) => {
    setBookings(prev => prev.map(booking => {
      if (booking.id === bookingId) {
        const queuedUpdate = updateQueue.current.get(bookingId);
        
        // Check for conflicts between optimistic and server updates
        if (queuedUpdate && queuedUpdate.optimistic) {
          const hasConflict = Object.keys(queuedUpdate.updates).some(key => 
            updates[key] !== undefined && 
            updates[key] !== queuedUpdate.updates[key]
          );
          
          if (hasConflict) {
            console.warn('Booking update conflict detected', {
              bookingId,
              optimistic: queuedUpdate.updates,
              server: updates
            });
            
            // Server wins in conflicts
            toast.error('Aggiornamento in conflitto risolto dal server');
          }
        }
        
        // Clear from queue
        updateQueue.current.delete(bookingId);
        
        return { 
          ...booking, 
          ...updates, 
          _optimistic: false,
          _lastServerUpdate: Date.now()
        };
      }
      return booking;
    }));
    
    setLastUpdate(Date.now());
  }, []);

  // Bulk update function for full refresh
  const updateAllBookings = useCallback((newBookings, options = {}) => {
    const { clearOptimistic = false } = options;
    
    setBookings(prev => {
      if (clearOptimistic) {
        // Clear all optimistic updates
        updateQueue.current.clear();
        return newBookings.map(booking => ({ 
          ...booking, 
          _optimistic: false,
          _lastServerUpdate: Date.now()
        }));
      }
      
      // Merge with existing optimistic updates
      return newBookings.map(newBooking => {
        const existing = prev.find(b => b.id === newBooking.id);
        const queuedUpdate = updateQueue.current.get(newBooking.id);
        
        if (existing?._optimistic && queuedUpdate) {
          // Keep optimistic updates that are newer than server data
          const serverTimestamp = new Date(newBooking.updatedAt || newBooking.createdAt).getTime();
          if (queuedUpdate.timestamp > serverTimestamp) {
            return {
              ...newBooking,
              ...queuedUpdate.updates,
              _optimistic: true
            };
          }
        }
        
        return {
          ...newBooking,
          _optimistic: false,
          _lastServerUpdate: Date.now()
        };
      });
    });
    
    setLastUpdate(Date.now());
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = (payload) => {
      if (!payload?.bookingId || !payload?.updates) return;
      
      console.log('Real-time booking update received', payload);
      
      updateBookingFromServer(payload.bookingId, payload.updates);
      
      // Show appropriate notifications
      const { status } = payload.updates;
      if (status === 'confirmed' || status === 'ready_to_start') {
        toast.success('Prenotazione confermata!');
      } else if (status === 'rejected') {
        toast.error('Prenotazione rifiutata');
      } else if (status === 'reschedule_requested') {
        toast('Nuova richiesta di riprogrammazione');
      } else if (status === 'active') {
        toast.success('Sessione avviata!');
      } else if (status === 'completed') {
        toast('Sessione completata');
      }
    };

    const handleStartNowUpdate = (payload) => {
      if (!payload?.bookingId) return;
      
      const updates = {};
      if (payload.action === 'request') {
        updates.start_now_request = {
          requested_by: payload.requestedBy,
          requested_at: payload.requestedAt,
          status: 'pending'
        };
        toast(`Richiesta di avvio immediato per ${payload.reservationId}`);
      } else if (payload.action === 'response') {
        updates.start_now_request = {
          requested_by: payload.requestedBy,
          responded_at: payload.respondedAt,
          status: payload.status
        };
        
        if (payload.status === 'accepted') {
          updates.status = 'active';
          updates.actual_started_at = new Date().toISOString();
          toast.success('Avvio immediato accettato!');
        } else {
          toast.error('Richiesta di avvio immediato rifiutata');
        }
      }
      
      updateBookingFromServer(payload.bookingId, updates);
    };

    const handleSessionStarted = (payload) => {
      if (!payload?.bookingId) return;
      
      updateBookingFromServer(payload.bookingId, {
        status: 'active',
        actual_started_at: new Date().toISOString(),
        start_now_request: undefined
      });
      
      toast.success(`Sessione ${payload.reservationId} avviata!`);
    };

    const handleSessionStatus = (payload) => {
      if (!payload?.bookingId) return;
      
      if (payload.status === 'expired' || payload.status === 'ended') {
        updateBookingFromServer(payload.bookingId, {
          status: 'completed'
        });
        toast('Sessione completata');
      }
    };

    // Register event listeners
    socket.on('booking:updated', handleBookingUpdate);
    socket.on('booking:start_now', handleStartNowUpdate);
    socket.on('booking:session_started', handleSessionStarted);
    socket.on('session:status', handleSessionStatus);

    return () => {
      socket.off('booking:updated', handleBookingUpdate);
      socket.off('booking:start_now', handleStartNowUpdate);
      socket.off('booking:session_started', handleSessionStarted);
      socket.off('session:status', handleSessionStatus);
    };
  }, [socket, updateBookingFromServer]);

  // Conflict resolution cleanup
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 30000; // 30 seconds
      
      for (const [bookingId, update] of updateQueue.current.entries()) {
        if (now - update.timestamp > staleThreshold) {
          console.warn('Removing stale optimistic update', { bookingId, age: now - update.timestamp });
          updateQueue.current.delete(bookingId);
          
          // Remove optimistic flag from booking
          setBookings(prev => prev.map(booking => 
            booking.id === bookingId 
              ? { ...booking, _optimistic: false }
              : booking
          ));
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(cleanup);
  }, []);

  return {
    bookings,
    isUpdating,
    lastUpdate,
    updateBookingOptimistically,
    updateBookingFromServer,
    updateAllBookings,
    setIsUpdating,
    hasOptimisticUpdates: updateQueue.current.size > 0,
    queueSize: updateQueue.current.size
  };
}