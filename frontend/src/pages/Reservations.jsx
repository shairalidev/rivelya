import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client.js';
import { requestReschedule, respondToReschedule, requestStartNow, respondStartNow } from '../api/dashboard.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

const statusLabels = {
  awaiting_master: 'In attesa Master',
  ready_to_start: 'Pronta per iniziare',
  active: 'In corso',
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

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
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
  const [confirmModal, setConfirmModal] = useState(null);
  const navigate = useNavigate();

  const loadReservations = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (filter !== 'all') params.status = filter;
      
      const { data } = await client.get('/bookings/reservations', { params });
      setReservations(data.reservations);
      setPagination(data.pagination);
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate('/login');
        return;
      }
      toast.error('Errore nel caricamento delle prenotazioni');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [filter]);

  const handleReschedule = (reservation) => {
    setRescheduleModal(reservation);
    setRescheduleForm({
      newDate: reservation.date,
      newStart: reservation.start,
      newEnd: reservation.end,
      reason: ''
    });
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
    setConfirmModal({
      title: action === 'accept' ? 'Accetta riprogrammazione' : 'Rifiuta riprogrammazione',
      message: action === 'accept'
        ? `Confermi di accettare la riprogrammazione per il ${reservation.reschedule_request.new_date}?`
        : 'Confermi di rifiutare la richiesta di riprogrammazione?',
      onConfirm: () => respondReschedule(reservation.id, action)
    });
  };

  const handleStartNowRequest = (reservation) => {
    setConfirmModal({
      title: 'Richiedi avvio immediato',
      message: `Vuoi chiedere di iniziare subito la sessione ${reservation.reservation_id}?`,
      onConfirm: () => sendStartNow(reservation.id)
    });
  };

  const handleStartNowResponse = (reservation, action) => {
    setConfirmModal({
      title: action === 'accept' ? 'Accetta avvio immediato' : 'Rifiuta avvio immediato',
      message: action === 'accept'
        ? 'Confermi di avviare subito la sessione?'
        : 'Vuoi rifiutare la richiesta di avvio immediato?',
      onConfirm: () => respondStartNowAction(reservation.id, action)
    });
  };

  const respondReschedule = async (reservationId, action) => {
    try {
      await respondToReschedule(reservationId, action);
      toast.success(action === 'accept' ? 'Riprogrammazione accettata' : 'Riprogrammazione rifiutata');
      setConfirmModal(null);
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
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

  const respondStartNowAction = async (reservationId, action) => {
    try {
      await respondStartNow(reservationId, action);
      toast.success(action === 'accept' ? 'Avvio immediato accettato' : 'Avvio immediato rifiutato');
      setConfirmModal(null);
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
    }
  };

  const handleStartSession = (reservation) => {
    setConfirmModal({
      title: 'Avvia sessione',
      message: `Vuoi avviare la sessione ${reservation.reservation_id} ora?`,
      onConfirm: () => startSession(reservation.id)
    });
  };

  const handleBookingResponse = async (reservationId, action) => {
    try {
      const { data } = await client.post(`/bookings/${reservationId}/respond`, { action });
      toast.success(action === 'accept' ? 'Prenotazione accettata' : 'Prenotazione rifiutata');
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
    }
  };

  const startSession = async (reservationId) => {
    try {
      const { data } = await client.post(`/bookings/${reservationId}/start`);
      toast.success(data.message);
      setConfirmModal(null);
      if (data.session_url) {
        navigate(data.session_url);
      }
      loadReservations(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nell\'avvio della sessione');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const canReschedule = (reservation) => {
    const futureDate = new Date(reservation.date) > new Date();
    const validStatus = ['ready_to_start', 'awaiting_master', 'reschedule_requested'].includes(reservation.status);
    return futureDate && validStatus;
  };

  const canRespondToReschedule = (reservation) => {
    return reservation.status === 'reschedule_requested' &&
           reservation.reschedule_request?.requested_by !== (reservation.user_role === 'customer' ? 'customer' : 'master');
  };

  const canStartSession = (reservation) => {
    if (reservation.status !== 'ready_to_start' || !reservation.can_start) return false;
    
    const now = new Date();
    const sessionDateTime = new Date(`${reservation.date}T${reservation.start}:00`);
    const timeDiff = Math.abs(now - sessionDateTime) / (1000 * 60);
    
    return timeDiff <= 15; // Can start 15 minutes before/after scheduled time
  };

  const myRole = reservation => (reservation.user_role === 'customer' ? 'customer' : 'master');

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
    return !hasIncomingStartNow(reservation) && !hasOutgoingStartNow(reservation);
  };

  const isPendingMyReschedule = (reservation) => {
    return reservation.status === 'reschedule_requested' &&
           reservation.reschedule_request?.requested_by === (reservation.user_role === 'customer' ? 'customer' : 'master');
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
        <p className="muted">Gestisci tutte le tue prenotazioni come cliente e master</p>
      </div>

      <div className="dashboard__filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tutte le prenotazioni</option>
          <option value="awaiting_master">In attesa Master</option>
          <option value="ready_to_start">Pronte per iniziare</option>
          <option value="reschedule_requested">Riprogrammazione richiesta</option>
          <option value="active">In corso</option>
          <option value="completed">Completate</option>
        </select>
      </div>

      <div className="dashboard__bookings">
        {reservations.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna prenotazione trovata</p>
            <button className="btn primary" onClick={() => navigate('/catalog')}>
              Prenota una sessione
            </button>
          </div>
        ) : (
          reservations.map(reservation => (
            <div key={reservation.id} className="booking-card">
              <div className="booking-card__header">
                <div className="booking-master">
                  <div>
                    <h3>
                      {reservation.user_role === 'master' 
                        ? `Cliente: ${reservation.customer.name}` 
                        : `Master: ${reservation.master.name}`}
                    </h3>
                    <p className="micro muted">ID: {reservation.reservation_id}</p>
                    <span className={`status status--${reservation.status}`}>
                      {statusLabels[reservation.status]}
                    </span>
                    {reservation.user_role === 'master' && (
                      <span className="badge-soft" style={{ marginLeft: '0.5rem' }}>
                        Come Master
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
                  <p><strong>Orario:</strong> {reservation.start} - {reservation.end}</p>
                  <p><strong>Tipo:</strong> {channelLabels[reservation.channel]}</p>
                  <p><strong>Durata:</strong> {reservation.duration_minutes} minuti</p>
                </div>

                {reservation.reschedule_request && (
                  <div className="reschedule-info">
                    <h4>
                      {reservation.reschedule_request.requested_by === reservation.user_role
                        ? 'La tua richiesta di riprogrammazione'
                        : `Richiesta di riprogrammazione da ${reservation.reschedule_request.requested_by === 'customer' ? 'Cliente' : 'Master'}`}
                    </h4>
                    <p><strong>Nuova data:</strong> {formatDate(reservation.reschedule_request.new_date)}</p>
                    <p><strong>Nuovo orario:</strong> {reservation.reschedule_request.new_start_time} - {reservation.reschedule_request.new_end_time}</p>
                    {reservation.reschedule_request.reason && (
                      <p><strong>Motivo:</strong> {reservation.reschedule_request.reason}</p>
                    )}
                  </div>
                )}

                {reservation.start_now_request && (
                  <div className="reschedule-info">
                    <h4>Avvio immediato</h4>
                    <p>
                      Richiesto da {reservation.start_now_request.requested_by === 'customer' ? 'Cliente' : 'Master'} -
                      Stato: {reservation.start_now_request.status === 'pending' ? 'In attesa' : reservation.start_now_request.status}
                    </p>
                  </div>
                )}

                {reservation.notes && (
                  <div className="booking-notes">
                    <p><strong>Note:</strong> {reservation.notes}</p>
                  </div>
                )}
              </div>

              <div className="booking-card__actions">
                {canStartSession(reservation) && (
                  <button
                    className="btn primary"
                    onClick={() => handleStartSession(reservation)}
                  >
                    Avvia Sessione
                  </button>
                )}

                {hasIncomingStartNow(reservation) && (
                  <>
                    <button
                      className="btn primary"
                      onClick={() => handleStartNowResponse(reservation, 'accept')}
                    >
                      Accetta avvio immediato
                    </button>
                    <button
                      className="btn outline"
                      onClick={() => handleStartNowResponse(reservation, 'reject')}
                    >
                      Rifiuta avvio immediato
                    </button>
                  </>
                )}

                {hasOutgoingStartNow(reservation) && (
                  <span className="btn outline" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                    In attesa di conferma avvio
                  </span>
                )}

                {canRequestStartNow(reservation) && !hasIncomingStartNow(reservation) && !hasOutgoingStartNow(reservation) && (
                  <button
                    className="btn outline"
                    onClick={() => handleStartNowRequest(reservation)}
                  >
                    Richiedi avvio immediato
                  </button>
                )}

                {canReschedule(reservation) && !isPendingMyReschedule(reservation) && (
                  <button
                    className="btn outline"
                    onClick={() => handleReschedule(reservation)}
                  >
                    {reservation.status === 'reschedule_requested' ? 'Nuova riprogrammazione' : 'Riprogramma'}
                  </button>
                )}
                
                {/* Debug info - remove after testing */}
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  Status: {reservation.status} | Future: {new Date(reservation.date) > new Date() ? 'Yes' : 'No'} | Can reschedule: {canReschedule(reservation) ? 'Yes' : 'No'}
                </div>
                
                {isPendingMyReschedule(reservation) && (
                  <span className="btn outline" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                    In attesa di risposta
                  </span>
                )}
                
                {reservation.status === 'awaiting_master' && reservation.user_role === 'master' && (
                  <>
                    <button 
                      className="btn primary" 
                      onClick={() => handleBookingResponse(reservation.id, 'accept')}
                    >
                      Accetta prenotazione
                    </button>
                    <button 
                      className="btn outline" 
                      onClick={() => handleBookingResponse(reservation.id, 'reject')}
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

                {reservation.status === 'active' && (
                  <button 
                    className="btn primary"
                    onClick={() => navigate(reservation.channel === 'voice' ? `/voice/${reservation.id}` : `/chat/${reservation.id}`)}
                  >
                    Unisciti alla sessione
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              className={`btn ${page === pagination.page ? 'primary' : 'outline'}`}
              onClick={() => loadReservations(page)}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {rescheduleModal && (
        <div className="modal-overlay" onClick={() => setRescheduleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Riprogramma {rescheduleModal.reservation_id}</h2>
              <button onClick={() => setRescheduleModal(null)}>×</button>
            </div>
            <div className="modal__body">
              <p>Orario attuale: {formatDate(rescheduleModal.date)} dalle {rescheduleModal.start} alle {rescheduleModal.end}</p>
              
              <div className="form-grid">
                <label className="input-label">
                  Nuova data
                  <input
                    type="date"
                    value={rescheduleForm.newDate}
                    onChange={(e) => setRescheduleForm(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </label>
                
                <label className="input-label">
                  Ora inizio
                  <input
                    type="time"
                    value={rescheduleForm.newStart}
                    onChange={(e) => setRescheduleForm(prev => ({ ...prev, newStart: e.target.value }))}
                  />
                </label>
                
                <label className="input-label">
                  Ora fine
                  <input
                    type="time"
                    value={rescheduleForm.newEnd}
                    onChange={(e) => setRescheduleForm(prev => ({ ...prev, newEnd: e.target.value }))}
                  />
                </label>
                
                <label className="input-label" data-span="3">
                  Motivo (opzionale)
                  <textarea
                    value={rescheduleForm.reason}
                    onChange={(e) => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Spiega il motivo della riprogrammazione"
                    rows={3}
                  />
                </label>
              </div>
            </div>
            <div className="modal__actions">
              <button className="btn outline" onClick={() => setRescheduleModal(null)}>
                Annulla
              </button>
              <button 
                className="btn primary" 
                onClick={submitReschedule}
                disabled={!rescheduleForm.newDate || !rescheduleForm.newStart || !rescheduleForm.newEnd}
              >
                Invia richiesta
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
          onClose={() => setConfirmModal(null)}
        />
      )}
    </section>
  );
}