import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBookingHistory, requestReschedule, respondToReschedule } from '../api/dashboard.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

const statusLabels = {
  awaiting_master: 'In attesa',
  confirmed: 'Confermata',
  rejected: 'Rifiutata',
  cancelled: 'Annullata',
  completed: 'Completata',
  reschedule_requested: 'Riprogrammazione richiesta',
  reschedule_accepted: 'Riprogrammazione accettata'
};

const channelLabels = {
  chat: 'Chat',
  voice: 'Chiamata',
  chat_voice: 'Chat + Chiamata'
};

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
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

  const loadBookings = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (filter !== 'all') params.status = filter;
      
      const response = await getBookingHistory(params);
      setBookings(response.bookings);
      setPagination(response.pagination);
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
    loadBookings();
  }, [filter]);

  const handleReschedule = (booking) => {
    setRescheduleModal(booking);
    setRescheduleForm({
      newDate: '',
      newStart: booking.start,
      newEnd: booking.end,
      reason: ''
    });
  };

  const submitReschedule = async () => {
    try {
      await requestReschedule(rescheduleModal.id, rescheduleForm);
      toast.success('Richiesta di riprogrammazione inviata');
      setRescheduleModal(null);
      loadBookings(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella richiesta');
    }
  };

  const handleRescheduleResponse = (booking, action) => {
    setConfirmModal({
      title: action === 'accept' ? 'Accetta riprogrammazione' : 'Rifiuta riprogrammazione',
      message: action === 'accept' 
        ? `Confermi di accettare la riprogrammazione per il ${booking.reschedule_request.new_date}?`
        : 'Confermi di rifiutare la richiesta di riprogrammazione?',
      onConfirm: () => respondReschedule(booking.id, action)
    });
  };

  const respondReschedule = async (bookingId, action) => {
    try {
      await respondToReschedule(bookingId, action);
      toast.success(action === 'accept' ? 'Riprogrammazione accettata' : 'Riprogrammazione rifiutata');
      setConfirmModal(null);
      loadBookings(pagination.page);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Errore nella risposta');
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

  const canReschedule = (booking) => {
    return ['confirmed', 'awaiting_master', 'reschedule_requested'].includes(booking.status) && 
           new Date(booking.date) > new Date();
  };

  const canRespondToReschedule = (booking) => {
    return booking.status === 'reschedule_requested' &&
           booking.reschedule_request?.requested_by === 'master';
  };

  const isPendingMyReschedule = (booking) => {
    return booking.status === 'reschedule_requested' &&
           booking.reschedule_request?.requested_by === 'customer';
  };

  if (loading && bookings.length === 0) {
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
        <h1>Le tue prenotazioni</h1>
        <p className="muted">Gestisci le tue sessioni passate e future</p>
      </div>

      <div className="dashboard__filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tutte le prenotazioni</option>
          <option value="awaiting_master">In attesa</option>
          <option value="confirmed">Confermate</option>
          <option value="reschedule_requested">Riprogrammazione richiesta</option>
          <option value="completed">Completate</option>
          <option value="cancelled">Annullate</option>
        </select>
      </div>

      <div className="dashboard__bookings">
        {bookings.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna prenotazione trovata</p>
            <button className="btn primary" onClick={() => navigate('/catalog')}>
              Prenota una sessione
            </button>
          </div>
        ) : (
          bookings.map(booking => (
            <div key={booking.id} className="booking-card">
              <div className="booking-card__header">
                <div className="booking-master">
                  {booking.master.avatar && (
                    <img src={booking.master.avatar} alt={booking.master.name} />
                  )}
                  <div>
                    <h3>{booking.master.name}</h3>
                    <span className={`status status--${booking.status}`}>
                      {statusLabels[booking.status]}
                    </span>
                  </div>
                </div>
                <div className="booking-amount">
                  €{formatAmount(booking.amount_cents)}
                </div>
              </div>

              <div className="booking-card__details">
                <div className="booking-info">
                  <p><strong>Data:</strong> {formatDate(booking.date)}</p>
                  <p><strong>Orario:</strong> {booking.start} - {booking.end}</p>
                  <p><strong>Tipo:</strong> {channelLabels[booking.channel]}</p>
                  <p><strong>Durata:</strong> {booking.duration_minutes} minuti</p>
                </div>

                {booking.reschedule_request && (
                  <div className="reschedule-info">
                    <h4>
                      {booking.reschedule_request.requested_by === 'customer' 
                        ? 'La tua richiesta di riprogrammazione' 
                        : 'Richiesta di riprogrammazione dal Esperti'}
                    </h4>
                    <p><strong>Nuova data:</strong> {formatDate(booking.reschedule_request.new_date)}</p>
                    <p><strong>Nuovo orario:</strong> {booking.reschedule_request.new_start_time} - {booking.reschedule_request.new_end_time}</p>
                    {booking.reschedule_request.reason && (
                      <p><strong>Motivo:</strong> {booking.reschedule_request.reason}</p>
                    )}
                    <p><strong>Stato:</strong> {booking.reschedule_request.requested_by === 'customer' ? 'In attesa di risposta' : 'In attesa della tua risposta'}</p>
                  </div>
                )}

                {booking.reschedule_history && booking.reschedule_history.length > 0 && (
                  <div style={{ background: 'rgba(152, 165, 199, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--muted)' }}>Cronologia riprogrammazioni</h4>
                    {booking.reschedule_history.slice(-2).map((history, index) => (
                      <div key={index} style={{ fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--muted)' }}>
                        {history.requested_by === 'customer' ? 'Tu' : 'Master'} ha richiesto {history.new_date} {history.new_start_time}-{history.new_end_time} - 
                        <span style={{ color: history.response === 'accepted' ? '#3dd8b6' : '#ff7b7b', fontWeight: '500' }}>
                          {history.response === 'accepted' ? 'Accettata' : 'Rifiutata'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {booking.notes && (
                  <div className="booking-notes">
                    <p><strong>Note:</strong> {booking.notes}</p>
                  </div>
                )}
              </div>

              <div className="booking-card__actions">
                {canReschedule(booking) && !isPendingMyReschedule(booking) && (
                  <button 
                    className="btn outline" 
                    onClick={() => handleReschedule(booking)}
                  >
                    {booking.status === 'reschedule_requested' ? 'Nuova riprogrammazione' : 'Riprogramma'}
                  </button>
                )}
                
                {isPendingMyReschedule(booking) && (
                  <span className="btn outline" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                    In attesa di risposta
                  </span>
                )}
                
                {canRespondToReschedule(booking) && (
                  <>
                    <button 
                      className="btn primary" 
                      onClick={() => handleRescheduleResponse(booking, 'accept')}
                    >
                      Accetta riprogrammazione
                    </button>
                    <button 
                      className="btn outline" 
                      onClick={() => handleRescheduleResponse(booking, 'reject')}
                    >
                      Rifiuta e proponi alternativa
                    </button>
                  </>
                )}

                {booking.status === 'confirmed' && booking.channel !== 'chat' && (
                  <button 
                    className="btn primary"
                    onClick={() => navigate(`/voice/${booking.id}`)}
                  >
                    Avvia chiamata
                  </button>
                )}

                {booking.status === 'confirmed' && booking.channel !== 'voice' && (
                  <button 
                    className="btn primary"
                    onClick={() => navigate(`/chat/${booking.id}`)}
                  >
                    Apri chat
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
              onClick={() => loadBookings(page)}
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
              <h2>Riprogramma sessione</h2>
              <button onClick={() => setRescheduleModal(null)}>×</button>
            </div>
            <div className="modal__body">
              <p>Sessione attuale: {formatDate(rescheduleModal.date)} dalle {rescheduleModal.start} alle {rescheduleModal.end}</p>
              
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