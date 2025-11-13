import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchAvailabilityMonthForMaster,
  addAvailabilityBlock,
  deleteAvailabilityBlock,
  fetchMasterRequests,
  respondToBooking
} from '../api/booking.js';
import client from '../api/client.js';
import FancySelect from '../components/FancySelect.jsx';
import { getUser as getStoredUser, subscribeAuthChange } from '../lib/auth.js';

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const statusLabels = {
  awaiting_master: 'In attesa',
  confirmed: 'Confermato',
  rejected: 'Rifiutato'
};

const formatCurrency = cents => (cents / 100).toFixed(2);

const formatDateLabel = (year, month) => {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

const timeToMinutes = value => {
  if (!/^\d{2}:\d{2}$/.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const toTimeOptions = range => {
  const options = [];
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return options;
  for (let pointer = start; pointer < end; pointer += 30) {
    options.push(minutesToTime(pointer));
  }
  return options;
};

const buildEndOptions = (ranges, startValue) => {
  if (!/^\d{2}:\d{2}$/.test(startValue)) return [];
  const startMinutes = timeToMinutes(startValue);
  const options = [];
  ranges.forEach(range => {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);
    if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd)) return;
    if (startMinutes < rangeStart || startMinutes >= rangeEnd) return;
    for (let pointer = Math.max(startMinutes + 30, rangeStart + 30); pointer <= rangeEnd; pointer += 30) {
      options.push(minutesToTime(pointer));
    }
  });
  return Array.from(new Set(options)).sort();
};

const buildCalendar = (year, month, days) => {
  const result = [];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const paddingStart = (firstDay + 6) % 7; // convert Sunday=0 to 6
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid = [];

  for (let i = 0; i < paddingStart; i += 1) grid.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid.push(days.find(item => item.date === key) || { date: key, availableRanges: [] });
  }

  while (grid.length % 7 !== 0) grid.push(null);

  for (let index = 0; index < grid.length; index += 7) {
    result.push(grid.slice(index, index + 7));
  }
  return result;
};

const initialBlockForm = { start: '09:00', end: '12:00' };

export default function MasterDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [monthData, setMonthData] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [modalDay, setModalDay] = useState(null);
  const [blockForm, setBlockForm] = useState(initialBlockForm);

  const masterId = user?.masterId;

  const startSelectOptions = useMemo(() => {
    if (!modalDay) return [];
    const bucket = new Set();
    (modalDay.availableRanges || []).forEach(range => {
      toTimeOptions(range).forEach(value => bucket.add(value));
    });
    return Array.from(bucket)
      .sort()
      .map(value => ({ value, label: value }));
  }, [modalDay]);

  const endSelectOptions = useMemo(
    () =>
      modalDay
        ? buildEndOptions(modalDay.availableRanges || [], blockForm.start).map(value => ({ value, label: value }))
        : [],
    [modalDay, blockForm.start]
  );

  useEffect(() => {
    const sync = () => {
      setUser(getStoredUser());
    };
    const unsubscribe = subscribeAuthChange(sync);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      toast.error('Accedi con un account master per gestire le prenotazioni.');
      navigate('/login?returnTo=/master/dashboard');
      return;
    }
    if (!user.roles?.includes('master')) {
      toast.error('Questa sezione è riservata ai master.');
      navigate('/');
    }
  }, [user, navigate]);

  const loadMonth = async params => {
    try {
      setLoadingMonth(true);
      const data = await fetchAvailabilityMonthForMaster(params);
      setMonthData(data);
    } catch (error) {
      toast.error('Impossibile caricare il calendario.');
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const data = await fetchMasterRequests();
      setRequests(data);
    } catch (error) {
      toast.error('Impossibile recuperare le richieste dei clienti.');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (user?.roles?.includes('master')) {
      loadMonth(monthCursor);
    }
  }, [user?.roles, monthCursor.year, monthCursor.month]);

  useEffect(() => {
    if (user?.roles?.includes('master')) {
      loadRequests();
    }
  }, [user?.roles]);

  const calendar = useMemo(() => {
    if (!monthData) return [];
    return buildCalendar(monthData.year, monthData.month, monthData.days);
  }, [monthData]);

  const openDayModal = day => {
    if (!day) return;
    const firstRange = day.availableRanges?.[0];
    if (firstRange) {
      const start = firstRange.start;
      const endCandidates = buildEndOptions([firstRange], firstRange.start);
      setBlockForm({
        start,
        end: endCandidates[0] || firstRange.end || minutesToTime(timeToMinutes(start) + 30)
      });
    } else {
      setBlockForm(initialBlockForm);
    }
    setModalDay(day);
  };

  const handleAddBlock = async fullDay => {
    if (!modalDay || !monthData) return;
    try {
      const payload = {
        year: monthData.year,
        month: monthData.month,
        date: modalDay.date,
        fullDay,
        start: fullDay ? undefined : blockForm.start,
        end: fullDay ? undefined : blockForm.end
      };
      const updated = await addAvailabilityBlock(payload);
      setMonthData(updated);
      setModalDay(null);
      toast.success(fullDay ? 'Giorno bloccato interamente.' : 'Fascia oraria bloccata.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile aggiornare la disponibilità.';
      toast.error(message);
    }
  };

  const handleRemoveBlock = async blockId => {
    if (!monthData) return;
    try {
      const updated = await deleteAvailabilityBlock(blockId, { year: monthData.year, month: monthData.month });
      setMonthData(updated);
      if (modalDay) {
        const refreshed = updated.days.find(day => day.date === modalDay.date);
        if (refreshed) setModalDay(refreshed);
      }
      toast.success('Restrizione rimossa.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile rimuovere la restrizione.';
      toast.error(message);
    }
  };

  const updateBlockForm = evt => {
    const { name, value } = evt.target;
    setBlockForm(prev => ({ ...prev, [name]: value }));
  };

  const changeMonth = direction => {
    setMonthData(null);
    setModalDay(null);
    setMonthCursor(prev => {
      const base = new Date(prev.year, prev.month - 1 + direction, 1);
      return { year: base.getFullYear(), month: base.getMonth() + 1 };
    });
  };

  const handleRespond = async (bookingId, action) => {
    try {
      const updated = await respondToBooking(bookingId, action);
      setRequests(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      toast.success(action === 'accept' ? 'Richiesta accettata.' : 'Richiesta rifiutata.');
      loadMonth(monthCursor);
    } catch (error) {
      const message = error?.response?.data?.message || 'Operazione non riuscita.';
      toast.error(message);
    }
  };

  const startCommunication = async (request, channel) => {
    try {
      if (!masterId) {
        toast.error('Profilo master non configurato.');
        return;
      }
      if (!request?.customer?.id) {
        toast.error('Cliente non disponibile.');
        return;
      }
      const endpoint = channel === 'phone' ? '/session/phone' : '/session/chat';
      const res = await client.post(endpoint, { master_id: masterId });
      if (channel === 'phone') {
        toast.success('Sessione telefonica avviata.');
      } else {
        toast.success('Chat avviata.');
        if (res.data?.ws_url) {
          window.open(res.data.ws_url, '_blank', 'noopener');
        }
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile avviare la sessione.';
      toast.error(message);
    }
  };

  return (
    <section className="container master-dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Pannello master</p>
          <h1>Gestisci richieste e disponibilità</h1>
          <p className="muted">
            Approva le richieste in arrivo, organizza il calendario del mese e apri rapidamente chat o chiamate con i clienti.
          </p>
        </div>
        <div className="month-controls">
          <button type="button" className="btn ghost" onClick={() => changeMonth(-1)} aria-label="Mese precedente">
            ←
          </button>
          <p>{formatDateLabel(monthCursor.year, monthCursor.month)}</p>
          <button type="button" className="btn ghost" onClick={() => changeMonth(1)} aria-label="Mese successivo">
            →
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="calendar-card">
          <div className="calendar-head">
            <h2>Disponibilità mensile</h2>
            <p className="muted">Per impostazione predefinita tutti i giorni sono prenotabili. Blocca le eccezioni con un click.</p>
          </div>
          {loadingMonth ? (
            <div className="calendar-skeleton" aria-hidden="true" />
          ) : !monthData ? (
            <p className="muted">Calendario non disponibile per questo mese.</p>
          ) : (
            <div className="calendar-grid">
              <div className="calendar-weekdays">
                {weekdays.map(label => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              {calendar.map((week, idx) => (
                <div key={`week-${idx}`} className="calendar-week">
                  {week.map((day, index) => {
                    if (!day) return <button key={`empty-${index}`} type="button" className="calendar-day empty" aria-hidden="true" />;
                    const isBlocked = day.fullDayBlocked;
                    const hasAvailability = day.availableRanges?.length > 0;
                    const label = Number(day.date.split('-')[2]);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={`calendar-day${isBlocked ? ' blocked' : ''}${hasAvailability ? ' available' : ''}`}
                        onClick={() => openDayModal(day)}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="requests-card">
          <div className="requests-head">
            <h2>Richieste clienti</h2>
            <p className="muted">Gestisci le prenotazioni confermando o rifiutando i nuovi appuntamenti.</p>
          </div>
          {loadingRequests ? (
            <div className="request-skeleton" aria-hidden="true" />
          ) : requests.length === 0 ? (
            <p className="muted">Nessuna richiesta registrata per questo periodo.</p>
          ) : (
            <ul className="requests-list">
              {requests.map(request => (
                <li key={request.id} className={`request-item status-${request.status}`}>
                  <div>
                    <p className="request-date">
                      {new Date(`${request.date}T${request.start}:00`).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      · {request.channel === 'phone' ? 'Chiamata' : 'Chat'}
                    </p>
                    <p className="muted">
                      {request.customer?.name || 'Cliente anonimo'} · {formatCurrency(request.amount_cents)} €
                    </p>
                    {request.notes && <p className="micro muted">Nota cliente: {request.notes}</p>}
                  </div>
                  <div className="request-actions">
                    {request.status === 'awaiting_master' ? (
                      <>
                        <button type="button" className="btn primary" onClick={() => handleRespond(request.id, 'accept')}>
                          Accetta
                        </button>
                        <button type="button" className="btn ghost" onClick={() => handleRespond(request.id, 'reject')}>
                          Rifiuta
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="status-pill">{statusLabels[request.status] || request.status}</span>
                        {request.status === 'confirmed' && (
                          <div className="quick-actions">
                            <button type="button" className="btn outline" onClick={() => startCommunication(request, 'chat')}>
                              Apri chat
                            </button>
                            <button type="button" className="btn outline" onClick={() => startCommunication(request, 'phone')}>
                              Avvia chiamata
                            </button>
                            {request.customer?.email && (
                              <a className="btn ghost" href={`mailto:${request.customer.email}`}>
                                Email
                              </a>
                            )}
                            {request.customer?.phone && (
                              <a className="btn ghost" href={`tel:${request.customer.phone}`}>
                                Chiama
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalDay && monthData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-head">
              <h3>
                Configura {new Date(`${modalDay.date}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </h3>
              <button type="button" className="btn ghost" onClick={() => setModalDay(null)} aria-label="Chiudi">×</button>
            </div>
            <div className="modal-body">
              {modalDay.fullDayBlocked ? (
                <p className="muted">Giornata già bloccata completamente.</p>
              ) : (
                <p className="muted">Per impostazione predefinita il giorno è prenotabile dalle 08:00 alle 22:00.</p>
              )}

              {modalDay.blocks?.length > 0 && (
                <div className="modal-section">
                  <p className="micro">Restrizioni attive</p>
                  <ul className="block-list">
                    {modalDay.blocks.map(block => (
                      <li key={block.id || block._id}>
                        {block.fullDay ? 'Intera giornata' : `${block.start} - ${block.end}`}
                        <button type="button" className="btn ghost" onClick={() => handleRemoveBlock(block.id || block._id)}>
                          Rimuovi
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="modal-section">
                <p className="micro">Blocca fascia oraria</p>
                <div className="time-grid">
                  <label className="input-label">
                    Inizio
                    <FancySelect
                      name="start"
                      value={blockForm.start}
                      options={startSelectOptions}
                      onChange={updateBlockForm}
                      placeholder="Seleziona"
                    />
                  </label>
                  <label className="input-label">
                    Fine
                    <FancySelect
                      name="end"
                      value={blockForm.end}
                      options={endSelectOptions}
                      onChange={updateBlockForm}
                      placeholder="Seleziona"
                      isDisabled={endSelectOptions.length === 0}
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn outline" onClick={() => handleAddBlock(false)}>
                    Blocca fascia
                  </button>
                  <button type="button" className="btn ghost" onClick={() => handleAddBlock(true)}>
                    Blocca intera giornata
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
