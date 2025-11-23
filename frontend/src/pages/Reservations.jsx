import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';
import { requestReschedule, respondToReschedule, requestStartNow, respondStartNow } from '../api/dashboard.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import ReviewModal from '../components/ReviewModal.jsx';
import useSocket from '../hooks/useSocket.js';
import useNetworkStatus from '../hooks/useNetworkStatus.js';

const statusLabels = {
  awaiting_master: 'In attesa Esperti',
  ready_to_start: 'Pronta per iniziare',
  active: 'Sessione in corso',
  completed: 'Completata',
  rejected: 'Rifiutata',
  cancelled: 'Annullata',
  reschedule_requested: 'Riprogrammazione richiesta'
};

const channelLabels = {
  chat: 'Chat',
  voice: 'Chiamata',
  chat_voice: 'Chat + Chiamata'
};

const canRejectBeforeStart = (reservation) => {
  if (reservation.user_role !== 'master') return false;
  return !['active', 'completed', 'rejected', 'cancelled'].includes(reservation.status);
};

const isSessionStarted = (reservation) => {
  return reservation.actual_started_at || reservation.status === 'active';
};

const isSessionCompleted = (reservation) => {
  return ['completed', 'cancelled', 'rejected'].includes(reservation.status);
};

const canShowActions = (reservation) => {
  return !isSessionStarted(reservation) && !isSessionCompleted(reservation);
};

export default function Reservations() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newStart: '',
    newEnd: '',
    reason: ''
  });
  const [rescheduleResponseModal, setRescheduleResponseModal] = useState(null);
  const [rescheduleResponseForm, setRescheduleResponseForm] = useState({ note: '' });
  const [rescheduleResponseLoading, setRescheduleResponseLoading] = useState(false);
  const [responseModal, setResponseModal] = useState(null);
  const [responseForm, setResponseForm] = useState({ note: '' });
  const [responseLoading, setResponseLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [incomingStartNow, setIncomingStartNow] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const reservationsSnapshot = useRef(new Map());
  const navigate = useNavigate();
  const socket = useSocket();
  const { isOnline } = useNetworkStatus();
  
  // Simple state management for now
  const [reservations, setReservations] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const myRole = useCallback(
    (reservation) => (reservation.user_role === 'customer' ? 'customer' : 'master'),
    []
  );

  const notifyIncomingUpdates = (nextReservations) => {
    const nextSnapshot = new Map();

    nextReservations.forEach((reservation) => {
      const previous = reservationsSnapshot.current.get(reservation.id) || {};
      const myCurrentRole = myRole(reservation);

      const rescheduleStatus = reservation.reschedule_request?.status || reservation.status;
      const rescheduleSignature = reservation.reschedule_request
        ? `${reservation.reschedule_request.requested_by}-${rescheduleStatus}-${reservation.reschedule_request.new_date}-${reservation.reschedule_request.new_start_time}-${reservation.reschedule_request.new_end_time}`
        : null;

      const startNowSignature = reservation.start_now_request
        ? `${reservation.start_now_request.requested_by}-${reservation.start_now_request.status}`
        : null;

      if (
        reservation.status === 'reschedule_requested' &&
        reservation.reschedule_request?.requested_by !== myCurrentRole &&
        rescheduleSignature !== previous.rescheduleSignature
      ) {
        toast(`Nuova richiesta di riprogrammazione per ${reservation.reservation_id}`);
      }

      if (
        reservation.start_now_request?.status === 'pending' &&
        reservation.start_now_request.requested_by !== myCurrentRole &&
        startNowSignature !== previous.startNowSignature
      ) {
        toast(`Richiesta di avvio immediato per ${reservation.reservation_id}`);
      }

      nextSnapshot.set(reservation.id, { rescheduleSignature, startNowSignature });
    });

    reservationsSnapshot.current = nextSnapshot;
  };

  const checkActiveBookingsStatus = useCallback(async (reservations) => {
    const activeBookings = reservations.filter(r => r.status === 'active');
    if (activeBookings.length === 0) return;

    try {
      await Promise.all(
        activeBookings.map(booking => 
          client.post(`/bookings/${booking.id}/check-session-status`)
        )
      );
    } catch (error) {
      // Silent fail - status will be updated on next refresh
    }
  }, []);

  const loadReservations = useCallback(async (page = 1, { showLoader = true } = {}) => {
    if (isUpdating && !showLoader) return;
    
    try {
      setIsUpdating(true);
      if (showLoader) setLoading(true);
      const params = { page, limit: 10 };
      if (filter !== 'all') params.status = filter;

      const { data } = await client.get('/bookings/reservations', { params });
      notifyIncomingUpdates(data.reservations);
      setReservations(data.reservations);
      setPagination(data.pagination);
      setLastUpdate(Date.now());
      
      // Check status of active bookings
      await checkActiveBookingsStatus(data.reservations);
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate('/login');
        return;
      }
      toast.error('Errore nel caricamento delle prenotazioni');
    } finally {
      setIsUpdating(false);
      if (showLoader) setLoading(false);
    }
  }, [filter, navigate, checkActiveBookingsStatus, isUpdating]);

  useEffect(() => {
    loadReservations(1, { showLoader: true });
  }, [filter]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isUpdating) {
        loadReservations(pagination.page, { showLoader: false });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pagination.page, isUpdating]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleStartNowSocket = (payload) => {
      if (payload?.action === 'request') {
        toast(`Richiesta di avvio immediato per ${payload.reservationId}`);
        setIncomingStartNow(payload);
      }

      if (payload?.action === 'response') {
        if (payload.status === 'accepted') {
          toast.success('Avvio immediato accettato: la sessione parte ora');
          if (payload.sessionUrl) {
            navigate(payload.sessionUrl);
          }
        } else if (payload.status === 'rejected') {
          toast.error('Richiesta di avvio immediato rifiutata');
        }
      }

      loadReservations(pagination.page, { showLoader: false });
    };

    const handleSessionStatus = (payload) => {
      if (payload?.status === 'expired' || payload?.status === 'ended') {
        // Session ended, refresh reservations to show updated status
        loadReservations(pagination.page, { showLoader: false });
      }
    };

    const handleSessionStarted = (payload) => {
      if (!payload) return;

      const message = payload.autoStarted 
        ? `La sessione ${payload.reservationId || ''} è iniziata automaticamente`
        : `Sessione ${payload.reservationId || ''} avviata`;
      
      toast.success(message);
      setConfirmModal({
        title: payload.autoStarted ? 'Sessione iniziata automaticamente' : 'Sessione attiva',
        message: payload.reservationId
          ? `La sessione ${payload.reservationId} è stata avviata. Vuoi aprirla ora?`
          : 'Una delle tue sessioni è stata avviata. Vuoi aprirla ora?',
        confirmText: 'Apri sessione',
        cancelText: 'Chiudi',
        onConfirm: () => {
          if (payload.sessionUrl) {
            navigate(payload.sessionUrl);
          }
          setConfirmModal(null);
        },
        onClose: () => setConfirmModal(null)
      });

      loadReservations(pagination.page, { showLoader: false });
    };

    const handleUpcomingSession = (payload) => {
      if (!payload) return;
      
      toast(`🔔 La tua sessione ${payload.reservationId} inizierà tra 10 minuti!`, {
        duration: 8000,
        style: {
          background: 'rgba(255, 159, 67, 0.9)',
          color: '#040612'
        }
      });
    };

    const handleReviewPrompt = (payload) => {
      if (!payload?.bookingId || payload?.partnerType !== 'master') return;

      toast('La tua sessione è terminata. Lascia una recensione?');
      setReviewModal({
        bookingId: payload.bookingId,
        partnerName: payload.partnerName,
        partnerType: payload.partnerType
      });

      loadReservations(pagination.page, { showLoader: false });
    };

    const handleSessionCompleted = (payload) => {
      if (!payload?.bookingId) return;
      loadReservations(pagination.page, { showLoader: false });
    };

    socket.on('booking:start_now', handleStartNowSocket);
    socket.on('session:status', handleSessionStatus);
    socket.on('booking:session_started', handleSessionStarted);
    socket.on('session:upcoming', handleUpcomingSession);
    socket.on('session:review:prompt', handleReviewPrompt);
    socket.on('session:completed', handleSessionCompleted);

    return () => {
      socket.off('booking:start_now', handleStartNowSocket);
      socket.off('session:status', handleSessionStatus);
      socket.off('booking:session_started', handleSessionStarted);
      socket.off('session:upcoming', handleUpcomingSession);
      socket.off('session:review:prompt', handleReviewPrompt);
      socket.off('session:completed', handleSessionCompleted);
    };
  }, [loadReservations, navigate, pagination.page, socket]);

  const handleReschedule = (reservation) => {
    setRescheduleModal(reservation);
    const calculatedEnd = calculateEndTime(reservation.start, reservation.duration_minutes);
    setRescheduleForm({
      newDate: reservation.date,
      newStart: reservation.start,
      newEnd: calculatedEnd,
      reason: ''
    });
  };

  const calculateEndTime = (startTime, durationMinutes) => {
    if (!startTime || !durationMinutes) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (newStartTime) => {
    const newEndTime = calculateEndTime(newStartTime, rescheduleModal?.duration_minutes);
    setRescheduleForm(prev => ({ 
      ...prev, 
      newStart: newStartTime,
      newEnd: newEndTime
    }));
  };

  const submitReschedule = async () => {
    try {
      await requestReschedule(rescheduleModal.id, rescheduleForm);
      toast.success('Richiesta di riprogrammazione inviata');
      setRescheduleModal(null);
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella richiesta');
    }
  };

  const handleRescheduleResponse = (reservation, action) => {
    setRescheduleResponseModal({ reservation, action });
    setRescheduleResponseForm({ note: '' });
  };

  const handleStartNowRequest = (reservation) => {
    setConfirmModal({
      title: 'Richiedi avvio immediato',
      message: `Vuoi chiedere di iniziare subito la sessione ${reservation.reservation_id}?`,
      onConfirm: () => sendStartNow(reservation.id)
    });
  };

  const handleStartNowResponse = (reservation, action) => {
    const reservationId = reservation.id;
    setConfirmModal({
      title: action === 'accept' ? 'Accetta avvio immediato' : 'Rifiuta avvio immediato',
      message: action === 'accept'
        ? 'Confermi di avviare subito la sessione?'
        : 'Vuoi rifiutare la richiesta di avvio immediato?',
      onConfirm: () => respondStartNowAction(reservationId, action)
    });
  };

  const respondReschedule = async (reservationId, action, note) => {
    try {
      setRescheduleResponseLoading(true);
      await respondToReschedule(reservationId, { action, note });
      toast.success(action === 'accept' ? 'Riprogrammazione accettata' : 'Riprogrammazione rifiutata');
      setRescheduleResponseModal(null);
      setRescheduleResponseForm({ note: '' });
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
    } finally {
      setRescheduleResponseLoading(false);
    }
  };

  const sendStartNow = async (reservationId) => {
    try {
      await requestStartNow(reservationId);
      toast.success('Richiesta di avvio immediato inviata');
      setConfirmModal(null);
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella richiesta');
    }
  };

  const respondStartNowAction = useCallback(async (reservationId, action) => {
    try {
      const { data } = await respondStartNow(reservationId, action);
      const successMessage =
        action === 'accept'
          ? 'Avvio immediato accettato: la sessione verrà avviata ora'
          : 'Avvio immediato rifiutato';

      toast.success(data?.message || successMessage);
      setConfirmModal(null);

      if (action === 'accept') {
        if (data?.session_url) {
          navigate(data.session_url);
        }
        loadReservations(pagination.page, { showLoader: false });
      } else {
        loadReservations(pagination.page, { showLoader: false });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
    }
  }, [loadReservations, navigate, pagination.page]);

  useEffect(() => {
    if (!incomingStartNow) return;
    const reservation = reservations.find((item) => item.id === incomingStartNow.bookingId);
    if (!reservation) return;

    const myCurrentRole = myRole(reservation);
    if (incomingStartNow.requestedBy === myCurrentRole) {
      setIncomingStartNow(null);
      return;
    }

    setConfirmModal({
      title: 'Avvio immediato richiesto',
      message: `${incomingStartNow.requestedBy === 'customer' ? 'Il cliente' : 'L\'esperto'} vuole iniziare subito la sessione ${reservation.reservation_id}.`,
      confirmText: 'Accetta e avvia ora',
      cancelText: 'Decidi dopo',
      secondaryText: 'Rifiuta richiesta',
      onConfirm: () => respondStartNowAction(reservation.id, 'accept'),
      onSecondary: () => respondStartNowAction(reservation.id, 'reject')
    });

    setIncomingStartNow(null);
  }, [incomingStartNow, myRole, reservations, respondStartNowAction]);

  const handleStartSession = (reservation) => {
    setConfirmModal({
      title: 'Avvia sessione',
      message: `Vuoi avviare la sessione ${reservation.reservation_id} ora?`,
      onConfirm: () => startSession(reservation.id)
    });
  };

  const handleBookingResponse = async (reservationId, payload) => {
    setResponseLoading(true);
    try {
      const { data } = await client.post(`/bookings/${reservationId}/respond`, payload);
      toast.success(payload.action === 'accept' ? 'Prenotazione accettata' : 'Prenotazione rifiutata');
      setResponseModal(null);
      loadReservations(pagination.page);
      setResponseForm({ note: '' });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
    } finally {
      setResponseLoading(false);
    }
  };

  const startSession = async (reservationId, options = {}) => {
    const { silentReload = false } = options;

    try {
      const { data } = await client.post(`/bookings/${reservationId}/start`);
      toast.success(data.message);
      setConfirmModal(null);
      if (data.session_url) {
        navigate(data.session_url);
      }
      loadReservations(pagination.page, { showLoader: !silentReload });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nell\'avvio della sessione');
    }
  };

  const openResponseModal = (reservation, action) => {
    setResponseModal({ reservation, action });
    setResponseForm({ note: '' });
  };

  const submitResponseModal = () => {
    if (!responseModal) return;
    handleBookingResponse(responseModal.reservation.id, {
      action: responseModal.action,
      note: responseForm.note
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr) => timeStr || '-';

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const canReschedule = (reservation) => {
    const sessionStart = reservation.start
      ? new Date(`${reservation.date}T${reservation.start}:00`)
      : new Date(reservation.date);
    const isFutureSession = !Number.isNaN(sessionStart.getTime()) && sessionStart > new Date();
    const validStatus = ['awaiting_master', 'confirmed', 'ready_to_start', 'reschedule_requested'].includes(reservation.status);
    const isCustomer = reservation.user_role === 'customer';
    const sessionNotStarted = !isSessionStarted(reservation) && !reservation.actual_started_at;
    const sessionNotCompleted = !isSessionCompleted(reservation);

    // Only customers can initiate reschedule requests
    return validStatus && isCustomer && sessionNotStarted && sessionNotCompleted && isFutureSession;
  };

  const startNowStatusLabel = (request) => {
    if (!request) return '';

    switch (request.status) {
      case 'pending':
        return 'In attesa di risposta';
      case 'accepted':
        return 'Accettata - puoi avviare subito la sessione';
      case 'rejected':
        return 'Rifiutata';
      default:
        return request.status;
    }
  };

  const canRespondToReschedule = (reservation) => {
    return reservation.status === 'reschedule_requested'
      && reservation.user_role === 'master'
      && reservation.reschedule_request?.requested_by === 'customer';
  };

  const canRespondToStartNow = (reservation) => {
    return reservation.start_now_request?.status === 'pending'
      && reservation.user_role === 'master'
      && reservation.start_now_request?.requested_by === 'customer';
  };

  const canStartSession = (reservation) => {
    const startNowAccepted = reservation.start_now_request?.status === 'accepted';

    if (['completed', 'cancelled', 'rejected'].includes(reservation.status)) return false;
    if (reservation.status === 'active') return true;
    if (!reservation.can_start && !startNowAccepted) return false;
    if (startNowAccepted) return true;
    if (reservation.status !== 'ready_to_start') return false;

    const now = new Date();
    const sessionDateTime = new Date(`${reservation.date}T${reservation.start}:00`);
    const timeDiff = (now - sessionDateTime) / (1000 * 60); // Positive if past scheduled time

    // Only allow manual start if:
    // 1. Session is more than 5 minutes past scheduled time (auto-start failed), OR
    // 2. Session is within 2 minutes of scheduled time
    return (timeDiff > 5) || (timeDiff >= -2 && timeDiff <= 2);
  };

  const hasIncomingStartNow = (reservation) => {
    return reservation.start_now_request?.status === 'pending'
      && reservation.start_now_request.requested_by !== myRole(reservation);
  };

  const hasOutgoingStartNow = (reservation) => {
    return reservation.start_now_request?.status === 'pending'
      && reservation.start_now_request.requested_by === myRole(reservation);
  };

  const canRequestStartNow = (reservation) => {
    if (reservation.status !== 'ready_to_start' || !reservation.can_start) return false;
    if (reservation.status === 'active') return false;
    // Only customers can initiate start now requests
    if (reservation.user_role !== 'customer') return false;
    return !hasIncomingStartNow(reservation) && !hasOutgoingStartNow(reservation);
  };

  const isPendingMyReschedule = (reservation) => {
    return reservation.status === 'reschedule_requested'
      && reservation.reschedule_request?.requested_by === 'customer'
      && reservation.user_role === 'customer';
  };

  const canReview = (reservation) => {
    return reservation.status === 'completed' && reservation.user_role === 'customer' && !hasReviewed(reservation);
  };

  const hasReviewed = (reservation) => {
    return reservation.has_reviewed || false;
  };

  const handleReview = (reservation) => {
    const partnerName = reservation.user_role === 'master'
      ? reservation.customer.name
      : reservation.master.name;
    
    setReviewModal({
      bookingId: reservation.id,
      partnerName,
      partnerType: reservation.user_role === 'master' ? 'client' : 'master'
    });
  };

  const handleReviewSubmitted = () => {
    setReviewModal(null);
    setReservations(prev => prev.map(reservation => (
      reservation.id === reviewModal?.bookingId
        ? { ...reservation, has_reviewed: true }
        : reservation
    )));
  };

  if (loading && reservations.length === 0) {
    return (
      <section className="container dashboard">
        <div className="dashboard__header">
          <h1>Le tue prenotazioni</h1>
          <p className="muted">Caricamento in corso...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="container dashboard">
      <div className="dashboard__header">
        <h1>Gestione Prenotazioni</h1>
        <p className="muted">Gestisci tutte le tue prenotazioni come Cliente e Esperti</p>
      </div>

      <div className="dashboard__filters">
        <select 
          value={filter} 
          onChange={(e) => {
            setFilter(e.target.value);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          disabled={isUpdating}
        >
          <option value="all">Tutte le prenotazioni</option>
          <option value="awaiting_master">In attesa Esperti</option>
          <option value="ready_to_start">Pronte per iniziare</option>
          <option value="reschedule_requested">Riprogrammazione richiesta</option>
          <option value="active">In corso</option>
          <option value="completed">Completate</option>
          <option value="rejected">Rifiutate</option>
          <option value="cancelled">Annullate</option>
        </select>
        
        {/* Real-time status indicator */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          fontSize: '0.8rem', 
          color: 'var(--muted)',
          marginLeft: 'auto'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: !isOnline ? '#ff6b6b' : isUpdating ? '#ff9f43' : '#3dd8b6',
            animation: isUpdating ? 'pulse 1s infinite' : 'none'
          }} />
          {!isOnline ? 'Offline' : isUpdating ? 'Aggiornamento...' : 'Sincronizzato'}
          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
            {isOnline ? new Date(lastUpdate).toLocaleTimeString('it-IT', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            }) : 'Nessuna connessione'}
          </span>
        </div>
      </div>

      <div className={`dashboard__bookings ${loading ? 'loading' : ''}`}>
        {reservations.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna prenotazione trovata</p>
            <button className="btn primary" onClick={() => navigate('/catalog')}>
              Prenota una sessione
            </button>
          </div>
        ) : (
          [...reservations].sort((a, b) => {
            // Priority sorting: open requests first
            const aHasOpenRequest = (
              (a.status === 'awaiting_master' && a.user_role === 'master') ||
              (a.status === 'reschedule_requested' && a.user_role === 'master' && a.reschedule_request?.requested_by === 'customer') ||
              (a.start_now_request?.status === 'pending' && a.user_role === 'master' && a.start_now_request?.requested_by === 'customer')
            );
            const bHasOpenRequest = (
              (b.status === 'awaiting_master' && b.user_role === 'master') ||
              (b.status === 'reschedule_requested' && b.user_role === 'master' && b.reschedule_request?.requested_by === 'customer') ||
              (b.start_now_request?.status === 'pending' && b.user_role === 'master' && b.start_now_request?.requested_by === 'customer')
            );
            
            if (aHasOpenRequest && !bHasOpenRequest) return -1;
            if (!aHasOpenRequest && bHasOpenRequest) return 1;
            
            // Secondary sort by date (newest first)
            return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
          }).map(reservation => {
            const latestReschedule = reservation.reschedule_history?.[reservation.reschedule_history.length - 1];

            return (
              <div key={reservation.id} className="booking-card">
              <div className="booking-card__header">
                <div className="booking-master">
                  <div>
                    <h3>
                      {reservation.user_role === 'master' 
                        ? `Cliente: ${reservation.customer.name}` 
                        : `Esperti: ${reservation.master.name}`}
                    </h3>
                    <p className="micro muted">ID: {reservation.reservation_id}</p>
                    <span className={`status status--${reservation.status}`}>
                      {statusLabels[reservation.status]}
                    </span>
                    {reservation.user_role === 'master' && (
                      <span className="badge-soft" style={{ marginLeft: '0.5rem' }}>
                        Come Esperti
                      </span>
                    )}
                  </div>
                </div>
                <div className="booking-amount">
                  €{formatAmount(reservation.amount_cents)}
                </div>
              </div>

              <div className="booking-card__details">
                <div className="booking-info">
                  <p><strong>Data:</strong> {formatDate(reservation.date)}</p>
                  <p><strong>Orario programmato:</strong></p>
                  <p style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>{reservation.start} - {reservation.end}</p>
                  {reservation.actual_started_at && (
                    <>
                      <p><strong>Avviata alle:</strong></p>
                      <p style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>{new Date(reservation.actual_started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                    </>
                  )}
                  <p><strong>Tipo:</strong> {channelLabels[reservation.channel]}</p>
                  <p><strong>Durata:</strong> {reservation.duration_minutes} minuti</p>
                </div>

                {reservation.reschedule_request && reservation.status === 'reschedule_requested' && (
                  <div className="reschedule-info">
                    <h4>
                      {reservation.reschedule_request.requested_by === reservation.user_role
                        ? 'La tua richiesta di riprogrammazione'
                        : `Richiesta di riprogrammazione da ${reservation.reschedule_request.requested_by === 'customer' ? 'Cliente' : 'Esperti'}`}
                    </h4>
                    <p><strong>Nuova data:</strong> {formatDate(reservation.reschedule_request.new_date)}</p>
                    <p><strong>Nuovo orario:</strong> {formatTime(reservation.reschedule_request.new_start_time)} - {formatTime(reservation.reschedule_request.new_end_time)}</p>
                    {reservation.reschedule_request.reason && (
                      <p><strong>Nota cliente:</strong> {reservation.reschedule_request.reason}</p>
                    )}
                  </div>
                )}

                {latestReschedule && latestReschedule.response && !reservation.reschedule_request && (
                  <div className="reschedule-info">
                    <h4>Ultima riprogrammazione</h4>
                    <p><strong>Richiesta da:</strong> {latestReschedule.requested_by === 'customer' ? 'Cliente' : 'Esperti'}</p>
                    <p><strong>Nuova data:</strong> {formatDate(latestReschedule.new_date)}</p>
                    <p><strong>Nuovo orario:</strong> {formatTime(latestReschedule.new_start_time)} - {formatTime(latestReschedule.new_end_time)}</p>
                    {latestReschedule.reason && (
                      <p><strong>Nota cliente:</strong> {latestReschedule.reason}</p>
                    )}
                    <p><strong>Esito:</strong> {latestReschedule.response === 'accepted' ? 'Accettata' : latestReschedule.response === 'rejected' ? 'Rifiutata' : 'Sostituita'}</p>
                    {latestReschedule.response_note && (
                      <p><strong>Nota del master:</strong> {latestReschedule.response_note}</p>
                    )}
                  </div>
                )}

                {reservation.start_now_request && reservation.start_now_request.status === 'pending' && (
                  <div className="reschedule-info">
                    <h4>Avvio immediato</h4>
                    <p>
                      Richiesto da {reservation.start_now_request.requested_by === 'customer' ? 'Cliente' : 'Esperti'}
                    </p>
                    <p><strong>Stato:</strong> {startNowStatusLabel(reservation.start_now_request)}</p>
                  </div>
                )}

                {reservation.start_now_request && reservation.start_now_request.status === 'accepted' && reservation.status === 'ready_to_start' && (
                  <div className="reschedule-info">
                    <h4>Avvio immediato approvato</h4>
                    <p className="micro muted">Puoi avviare la sessione senza attendere l'orario programmato.</p>
                  </div>
                )}

                {reservation.notes && (
                  <div className="booking-notes">
                    <p><strong>Note:</strong> {reservation.notes}</p>
                  </div>
                )}

                {reservation.master_response?.note && (
                  <div className="booking-notes">
                    <p><strong>Nota esperti:</strong> {reservation.master_response.note}</p>
                    {reservation.master_response.proposed_time && (
                      <p><strong>Proposta alternativa:</strong> {reservation.master_response.proposed_time}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="booking-card__actions">
                {/* Show session running status */}
                {reservation.status === 'active' && (
                  <>
                    <div className="session-status">
                      <span className="status status--active">Sessione in corso</span>
                      {reservation.actual_started_at && (
                        <span className="micro muted" style={{ marginLeft: '0.5rem' }}>
                          Iniziata alle {new Date(reservation.actual_started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <button 
                      className="btn primary"
                      onClick={async () => {
                        try {
                          // Direct URL generation based on channel type
                          let sessionUrl;
                          if (reservation.channel === 'voice') {
                            sessionUrl = `/voice/${reservation.id}`;
                          } else {
                            // For chat channels, try to get the thread ID from backend
                            try {
                              const { data } = await client.get(`/bookings/${reservation.id}/session-url`);
                              sessionUrl = data.session_url;
                            } catch {
                              // Fallback to booking ID if thread lookup fails
                              sessionUrl = `/chat/${reservation.id}`;
                            }
                          }
                          navigate(sessionUrl);
                        } catch (error) {
                          toast.error('Impossibile accedere alla sessione');
                        }
                      }}
                    >
                      Unisciti alla sessione
                    </button>
                  </>
                )}

                {/* Show completed status */}
                {isSessionCompleted(reservation) && (
                  <>
                    <div className="session-status">
                      <span className={`status status--${reservation.status}`}>
                        {statusLabels[reservation.status]}
                      </span>
                      {reservation.actual_started_at && (
                        <span className="micro muted" style={{ marginLeft: '0.5rem' }}>
                          Iniziata alle {new Date(reservation.actual_started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    
                    {/* Review button for completed sessions */}
                    {canReview(reservation) && (
                      <button
                        className={`btn ${hasReviewed(reservation) ? 'outline' : 'primary'}`}
                        onClick={() => handleReview(reservation)}
                        disabled={hasReviewed(reservation)}
                        style={{
                          opacity: hasReviewed(reservation) ? 0.6 : 1,
                          cursor: hasReviewed(reservation) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {hasReviewed(reservation) ? '✓ Recensione inviata' : '⭐ Aggiungi recensione'}
                      </button>
                    )}
                  </>
                )}

                {/* Show action buttons only if session hasn't started and isn't completed */}
                {canShowActions(reservation) && !isSessionStarted(reservation) && (
                  <>
                    {canStartSession(reservation) && (
                      <button
                        className="btn primary"
                        onClick={() => handleStartSession(reservation)}
                      >
                        Avvia Sessione
                      </button>
                    )}

                    {canRespondToStartNow(reservation) && (
                      <div style={{ 
                        backgroundColor: 'rgba(255, 159, 67, 0.15)', 
                        border: '1px solid rgba(255, 159, 67, 0.4)', 
                        borderRadius: 'var(--radius-sm)', 
                        padding: '0.75rem', 
                        marginBottom: '0.75rem',
                        borderLeft: '3px solid #ff9f43',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}>
                        <div>
                          <strong style={{ color: '#ff9f43', fontSize: '0.85rem' }}>🔔 Richiesta di avvio immediato</strong>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Il cliente vuole iniziare subito
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            className="btn small primary"
                            onClick={() => handleStartNowResponse(reservation, 'accept')}
                          >
                            Accetta
                          </button>
                          <button
                            className="btn small outline"
                            onClick={() => handleStartNowResponse(reservation, 'reject')}
                          >
                            Rifiuta
                          </button>
                        </div>
                      </div>
                    )}

                    {hasOutgoingStartNow(reservation) && (
                      <span className="btn outline" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        In attesa di conferma avvio
                      </span>
                    )}

                    {canRequestStartNow(reservation) && (
                      <button
                        className="btn outline"
                        onClick={() => handleStartNowRequest(reservation)}
                      >
                        Richiedi avvio immediato
                      </button>
                    )}

                    {reservation.status === 'awaiting_master' && reservation.user_role === 'master' && (
                      <>
                        <button
                          className="btn primary"
                          onClick={() => openResponseModal(reservation, 'accept')}
                        >
                          Accetta prenotazione
                        </button>
                        <button
                          className="btn outline"
                          onClick={() => openResponseModal(reservation, 'reject')}
                        >
                          Rifiuta prenotazione
                        </button>
                      </>
                    )}

                    {canRespondToReschedule(reservation) && (
                      <>
                        <button 
                          className="btn primary" 
                          onClick={() => handleRescheduleResponse(reservation, 'accept')}
                        >
                          Accetta riprogrammazione
                        </button>
                        <button 
                          className="btn outline" 
                          onClick={() => handleRescheduleResponse(reservation, 'reject')}
                        >
                          Rifiuta riprogrammazione
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* Client reschedule button - show for all valid client bookings */}
                {canReschedule(reservation) && (
                  <button
                    className="btn outline"
                    onClick={() => handleReschedule(reservation)}
                  >
                    {reservation.reschedule_request ? 'Modifica riprogrammazione' : 'Riprogramma'}
                  </button>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="btn outline"
            onClick={() => loadReservations(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            ‹ Precedente
          </button>
          <span className="pagination-info">
            Pagina {pagination.page} di {pagination.pages}
          </span>
          <button
            className="btn outline"
            onClick={() => loadReservations(pagination.page + 1)}
            disabled={pagination.page === pagination.pages || isUpdating}
          >
            Successiva ›
          </button>
        </div>
      )}

      {rescheduleModal && (
        <div className="modal-backdrop" onClick={() => setRescheduleModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🔄 Riprogramma {rescheduleModal.reservation_id}</h3>
              <button className="modal-close" onClick={() => setRescheduleModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div style={{ 
                padding: '1rem 1.2rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(109, 91, 255, 0.12)', 
                border: '1px solid rgba(109, 91, 255, 0.3)',
                marginBottom: '1.5rem'
              }}>
                <strong style={{ color: 'var(--brand)' }}>📅 Orario attuale:</strong>
                <br />
                <span style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
                  {formatDate(rescheduleModal.date)} dalle {rescheduleModal.start} alle {rescheduleModal.end}
                </span>
              </div>
              
              <div className="modal-section">
                <div className="time-grid">
                  <label className="input-label">
                    <span style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      Nuova data
                    </span>
                    <input
                      type="date"
                      value={rescheduleForm.newDate}
                      onChange={(e) => setRescheduleForm(prev => ({ ...prev, newDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(4, 6, 18, 0.8)',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s ease',
                        colorScheme: 'dark'
                      }}
                    />
                  </label>
                  
                  <label className="input-label">
                    <span style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      Ora inizio
                    </span>
                    <input
                      type="time"
                      value={rescheduleForm.newStart}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(4, 6, 18, 0.8)',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s ease',
                        colorScheme: 'dark'
                      }}
                    />
                  </label>
                </div>
                
                <label className="input-label" style={{ marginTop: '1rem' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    Ora fine (calcolata automaticamente)
                  </span>
                  <input
                    type="time"
                    value={rescheduleForm.newEnd}
                    readOnly
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.95rem',
                      cursor: 'not-allowed',
                      opacity: 0.7,
                      colorScheme: 'dark'
                    }}
                  />
                </label>
                
                <label className="input-label" style={{ marginTop: '1.2rem' }}>
                  <span style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    💬 Motivo della riprogrammazione *
                  </span>
                  <textarea
                    value={rescheduleForm.reason}
                    onChange={(e) => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Spiega il motivo della riprogrammazione e proponi un orario alternativo..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(4, 6, 18, 0.8)',
                      color: 'var(--text)',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '100px',
                      transition: 'all 0.2s ease',
                      lineHeight: '1.5'
                    }}
                  />
                </label>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn outline" onClick={() => setRescheduleModal(null)}>
                Annulla
              </button>
              <button 
                className="btn primary"
                onClick={submitReschedule}
                disabled={!rescheduleForm.newDate || !rescheduleForm.newStart || !rescheduleForm.newEnd || !rescheduleForm.reason.trim()}
              >
                ✨ Invia richiesta
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleResponseModal && (
        <div className="modal-backdrop" onClick={() => !rescheduleResponseLoading && setRescheduleResponseModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{rescheduleResponseModal.action === 'accept' ? '✅ Accetta riprogrammazione' : '❌ Rifiuta riprogrammazione'}</h3>
              <button className="modal-close" onClick={() => !rescheduleResponseLoading && setRescheduleResponseModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div style={{ 
                padding: '1rem 1.2rem', 
                borderRadius: 'var(--radius-md)', 
                background: rescheduleResponseModal.action === 'accept' ? 'rgba(61, 216, 182, 0.08)' : 'rgba(255, 123, 123, 0.08)', 
                border: rescheduleResponseModal.action === 'accept' ? '1px solid rgba(61, 216, 182, 0.2)' : '1px solid rgba(255, 123, 123, 0.2)',
                marginBottom: '1.2rem',
                fontSize: '0.9rem'
              }}>
                {rescheduleResponseModal.action === 'accept'
                  ? 'Conferma la nuova data proposta dal cliente e aggiungi un breve messaggio.'
                  : 'Spiega il motivo del rifiuto e proponi eventualmente un orario alternativo nella nota.'}
              </div>

              <div style={{ 
                padding: '1rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(19, 209, 255, 0.08)', 
                border: '1px solid rgba(19, 209, 255, 0.2)',
                marginBottom: '1.2rem'
              }}>
                <strong style={{ color: 'var(--accent)' }}>📅 Nuovo orario proposto:</strong>
                <br />
                {formatDate(rescheduleResponseModal.reservation.reschedule_request.new_date)} dalle {formatTime(rescheduleResponseModal.reservation.reschedule_request.new_start_time)} alle {formatTime(rescheduleResponseModal.reservation.reschedule_request.new_end_time)}
              </div>

              <label className="input-label">
                <span style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  💬 Nota per il cliente
                </span>
                <textarea
                  value={rescheduleResponseForm.note}
                  onChange={(e) => setRescheduleResponseForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Scrivi un breve messaggio per il cliente..."
                  rows={4}
                  disabled={rescheduleResponseLoading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(4, 6, 18, 0.8)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '100px',
                    transition: 'all 0.2s ease',
                    lineHeight: '1.5',
                    opacity: rescheduleResponseLoading ? 0.6 : 1
                  }}
                />
              </label>
            </div>
            
            <div className="modal-actions">
              <button className="btn outline" onClick={() => setRescheduleResponseModal(null)} disabled={rescheduleResponseLoading}>
                Annulla
              </button>
              <button
                className="btn primary"
                onClick={() => respondReschedule(rescheduleResponseModal.reservation.id, rescheduleResponseModal.action, rescheduleResponseForm.note)}
                disabled={rescheduleResponseLoading || (rescheduleResponseModal.action === 'reject' && !rescheduleResponseForm.note.trim())}
              >
                {rescheduleResponseLoading ? '⏳ Invio in corso...' : '✨ Invia risposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {responseModal && (
        <div className="modal-backdrop" onClick={() => !responseLoading && setResponseModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{responseModal.action === 'accept' ? '✅ Accetta prenotazione' : '❌ Rifiuta prenotazione'}</h3>
              <button className="modal-close" onClick={() => !responseLoading && setResponseModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div style={{ 
                padding: '1rem 1.2rem', 
                borderRadius: 'var(--radius-md)', 
                background: responseModal.action === 'accept' ? 'rgba(61, 216, 182, 0.08)' : 'rgba(255, 123, 123, 0.08)', 
                border: responseModal.action === 'accept' ? '1px solid rgba(61, 216, 182, 0.2)' : '1px solid rgba(255, 123, 123, 0.2)',
                marginBottom: '1.2rem',
                fontSize: '0.9rem'
              }}>
                {responseModal.action === 'accept'
                  ? 'Puoi aggiungere una nota per il cliente quando accetti la prenotazione.'
                  : 'Spiega il motivo del rifiuto. Sarà il cliente a riprogrammare.'}
              </div>

              <label className="input-label">
                <span style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  💬 Nota per il cliente
                </span>
                <textarea
                  value={responseForm.note}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder={responseModal.action === 'accept'
                    ? 'Aggiungi informazioni utili per la sessione...'
                    : 'Motiva il rifiuto e fornisci indicazioni per riprogrammare...'}
                  rows={4}
                  disabled={responseLoading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(4, 6, 18, 0.8)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '100px',
                    transition: 'all 0.2s ease',
                    lineHeight: '1.5',
                    opacity: responseLoading ? 0.6 : 1
                  }}
                />
              </label>
            </div>
            
            <div className="modal-actions">
              <button className="btn outline" onClick={() => setResponseModal(null)} disabled={responseLoading}>
                Annulla
              </button>
              <button
                className="btn primary"
                onClick={submitResponseModal}
                disabled={responseLoading || (responseModal.action === 'reject' && !responseForm.note.trim())}
              >
                {responseLoading ? '⏳ Invio in corso...' : '✨ Invia risposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen={!!confirmModal}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onSecondary={confirmModal.onSecondary}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          secondaryText={confirmModal.secondaryText}
          type={confirmModal.type}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {reviewModal && (
        <ReviewModal
          isOpen={!!reviewModal}
          onClose={() => setReviewModal(null)}
          bookingId={reviewModal.bookingId}
          partnerName={reviewModal.partnerName}
          partnerType={reviewModal.partnerType}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </section>
  );
}