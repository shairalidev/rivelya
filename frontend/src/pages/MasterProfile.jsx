import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/it.js';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import client from '../api/client.js';
import FancySelect from '../components/FancySelect.jsx';
import { buildDailySchedule, resolveTimezoneLabel } from '../utils/schedule.js';
import { resolveAvailabilityStatus } from '../utils/availability.js';
import { createBooking, fetchMasterMonthAvailability } from '../api/booking.js';
import { getToken } from '../lib/auth.js';

const ChatGlyph = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-5.2a1 1 0 00-.7.3L10 21v-3H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
    <path d="M8 10h8" />
    <path d="M8 13h5" />
  </svg>
);

const VoiceGlyph = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6.5 3h3.2a2 2 0 011.9 1.4l1 3.3a2 2 0 01-.7 2.1l-1.5 1.1a10.5 10.5 0 005.2 5.2l1.1-1.5a2 2 0 012.1-.7l3.3 1a2 2 0 011.4 1.9v3.2a2 2 0 01-2 2A17.8 17.8 0 013 6.5a2 2 0 012-2Z" />
    <path d="M15 4.5a6.5 6.5 0 016.5 6.5" />
    <path d="M15 8a3 3 0 013 3" />
  </svg>
);

const serviceMeta = {
  chat: { label: 'Solo chat', channel: 'chat', Icon: ChatGlyph },
  chatVoice: { label: 'Chat e voce', channel: 'chat_voice', Icon: VoiceGlyph }
};

const serviceOrder = ['chat', 'chatVoice'];

const channelRateLabels = { chat: 'solo chat', chat_voice: 'chat e voce' };

const hasService = (services, service) => {
  if (!services) return service === 'chat';
  if (service === 'chat') return services.chat !== false;
  if (service === 'chatVoice') return Boolean(services.chatVoice ?? services.chat_voice ?? services.phone);
  return false;
};

dayjs.locale('it');

export default function MasterProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [master, setMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [booking, setBooking] = useState({ date: '', start: '', end: '', channel: 'chat', notes: '' });
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    client.get(`/catalog/${id}`)
      .then(res => {
        setMaster(res.data);
      })
      .catch(() => {
        setMaster(null);
        setError('Master non trovato o non disponibile.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const ensureAuth = () => {
    if (!getToken()) {
      toast.error('Effettua il login per avviare una sessione.');
      return false;
    }
    return true;
  };

  const timeToMinutes = value => {
    if (!/^\d{2}:\d{2}$/.test(value)) return Number.NaN;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

  const formatDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const rangeToStarts = ranges =>
    ranges
      .flatMap(range => {
        const start = timeToMinutes(range.start);
        const end = timeToMinutes(range.end);
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];
        const options = [];
        for (let pointer = start; pointer < end; pointer += 30) {
          options.push(minutesToTime(pointer));
        }
        return options;
      })
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();

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

  const loadAvailability = async masterId => {
    if (!masterId) return;
    try {
      setAvailabilityLoading(true);
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const months = [
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        { year: next.getFullYear(), month: next.getMonth() + 1 }
      ];
      const responses = await Promise.all(
        months.map(params => fetchMasterMonthAvailability(masterId, params).catch(() => null))
      );
      const map = {};
      responses.filter(Boolean).forEach(result => {
        result.days.forEach(day => {
          map[day.date] = day;
        });
      });
      setAvailability(map);
    } catch (err) {
      console.warn('availability error', err);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    if (master?._id) {
      setAvailability({});
      setBooking(prev => ({ ...prev, date: '', start: '', end: '' }));
      loadAvailability(master._id);
    }
  }, [master?._id]);

  const startSession = async channel => {
    if (!master || !ensureAuth()) return;
    const serviceKey = channel === 'chat_voice' ? 'chatVoice' : 'chat';
    const serviceAvailable = hasService(master.services, serviceKey);
    if (!serviceAvailable) {
      toast.error('Questo canale non è disponibile al momento.');
      return;
    }
    if (channel === 'chat_voice') {
      try {
        await client.post('/session/chat-voice', { master_id: master._id });
        toast.success('Ti chiameremo per avviare la sessione vocale.');
      } catch (error) {
        const message = error?.response?.data?.message || 'Impossibile avviare la sessione in questo momento.';
        toast.error(message);
      }
      return;
    }
    try {
      const res = await client.post('/session/chat', { master_id: master._id });
      toast.success('Chat avviata. Ti reindirizziamo alla stanza.');
      if (res.data.ws_url) {
        window.open(res.data.ws_url, '_blank', 'noopener');
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Impossibile avviare la sessione in questo momento.';
      toast.error(message);
    }
  };

  const availableServices = useMemo(
    () =>
      master
        ? serviceOrder.filter(service => hasService(master.services, service))
        : ['chat'],
    [master?.services]
  );

  const channelOptions = useMemo(
    () =>
      availableServices.map(service => ({
        value: serviceMeta[service]?.channel || service,
        label: serviceMeta[service]?.label || service
      })),
    [availableServices]
  );

  const availableChannels = useMemo(
    () => (channelOptions.length > 0 ? channelOptions.map(option => option.value) : ['chat']),
    [channelOptions]
  );

  useEffect(() => {
    if (availableChannels.length === 0) {
      setBooking(prev => ({ ...prev, channel: '' }));
      return;
    }
    setBooking(prev =>
      availableChannels.includes(prev.channel)
        ? prev
        : { ...prev, channel: availableChannels[0] }
    );
  }, [availableChannels]);

  const availableDays = useMemo(
    () =>
      Object.values(availability)
        .filter(day => day.availableRanges?.length > 0 && !day.fullDayBlocked)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [availability]
  );

  const availableDateSet = useMemo(() => new Set(availableDays.map(day => day.date)), [availableDays]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const selectedDateObject = useMemo(() => {
    if (!booking.date) return undefined;
    const [year, month, day] = booking.date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [booking.date]);

  const disabledDays = useMemo(
    () => [
      date => date < today,
      date => !availableDateSet.has(formatDateKey(date))
    ],
    [today, availableDateSet]
  );

  const modifiers = useMemo(
    () => ({ available: date => availableDateSet.has(formatDateKey(date)) }),
    [availableDateSet]
  );

  useEffect(() => {
    if (availableDays.length > 0 && !booking.date) {
      const first = availableDays[0];
      const startOptions = rangeToStarts(first.availableRanges);
      const start = startOptions[0] || '09:00';
      const endOptions = buildEndOptions(first.availableRanges, start);
      setBooking(prev => ({
        ...prev,
        date: first.date,
        start,
        end: endOptions[0] || minutesToTime(timeToMinutes(start) + 30)
      }));
    }
  }, [availableDays]);

  const selectedDay = booking.date ? availability[booking.date] : null;
  const startOptions = selectedDay ? rangeToStarts(selectedDay.availableRanges || []) : [];
  const endOptions = selectedDay ? buildEndOptions(selectedDay.availableRanges || [], booking.start) : [];

  const startSelectOptions = useMemo(() => startOptions.map(value => ({ value, label: value })), [startOptions]);
  const endSelectOptions = useMemo(() => endOptions.map(value => ({ value, label: value })), [endOptions]);

  const durationMinutes = useMemo(() => {
    if (!booking.start || !booking.end) return 0;
    const startValue = timeToMinutes(booking.start);
    const endValue = timeToMinutes(booking.end);
    if (Number.isNaN(startValue) || Number.isNaN(endValue) || endValue <= startValue) return 0;
    return endValue - startValue;
  }, [booking.start, booking.end]);

  const activeRateCents = useMemo(() => {
    if (!master) return null;
    let value;
    if (booking.channel === 'chat_voice') value = master.rate_chat_voice_cpm;
    else value = master.rate_chat_cpm;
    return typeof value === 'number' ? value : null;
  }, [master, booking.channel]);

  const estimatedCost = useMemo(() => {
    if (!durationMinutes || activeRateCents == null) return null;
    return (durationMinutes * activeRateCents) / 100;
  }, [durationMinutes, activeRateCents]);

  const selectedDateLabel = useMemo(
    () => (selectedDateObject ? dayjs(selectedDateObject).format('dddd DD MMMM') : 'Seleziona un giorno'),
    [selectedDateObject]
  );

  useEffect(() => {
    if (!booking.date) return;
    const day = availability[booking.date];
    if (!day || day.availableRanges?.length === 0) {
      setBooking(prev => ({ ...prev, date: '', start: '', end: '' }));
      return;
    }
    const starts = rangeToStarts(day.availableRanges || []);
    if (!starts.includes(booking.start)) {
      const nextStart = starts[0] || '';
      const nextEnd = buildEndOptions(day.availableRanges || [], nextStart)[0] || '';
      if (nextStart !== booking.start || nextEnd !== booking.end) {
        setBooking(prev => ({ ...prev, start: nextStart, end: nextEnd }));
      }
      return;
    }
    const ends = buildEndOptions(day.availableRanges || [], booking.start);
    if (!ends.includes(booking.end)) {
      const nextEnd = ends[0] || '';
      if (nextEnd !== booking.end) {
        setBooking(prev => ({ ...prev, end: nextEnd }));
      }
    }
  }, [availability, booking.date, booking.start, booking.end]);

  const updateBooking = evt => {
    const { name, value } = evt.target;
    setBooking(prev => {
      if (name === 'start') {
        const nextEndOptions = selectedDay ? buildEndOptions(selectedDay.availableRanges || [], value) : [];
        return {
          ...prev,
          start: value,
          end: nextEndOptions[0] || prev.end || minutesToTime(timeToMinutes(value) + 30)
        };
      }
      if (name === 'date') {
        const nextDay = availability[value];
        const startOptionsForDay = nextDay ? rangeToStarts(nextDay.availableRanges || []) : [];
        const nextStart = startOptionsForDay[0] || '';
        const nextEnd = nextDay ? buildEndOptions(nextDay.availableRanges || [], nextStart)[0] || nextStart : '';
        return {
          ...prev,
          date: value,
          start: nextStart,
          end: nextEnd
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleDaySelect = day => {
    if (!day) return;
    const key = formatDateKey(day);
    if (!availableDateSet.has(key)) return;
    updateBooking({ target: { name: 'date', value: key } });
  };

  const submitBooking = async () => {
    if (!master || !ensureAuth()) return;
    if (!booking.date || !booking.start || !booking.end || !booking.channel) {
      toast.error('Seleziona data, orario e canale.');
      return;
    }
    try {
      setBookingLoading(true);
      await createBooking({
        masterId: master._id,
        channel: booking.channel,
        date: booking.date,
        start: booking.start,
        end: booking.end,
        notes: booking.notes
      });
      toast.success('Richiesta inviata al master. Ti avviseremo quando verrà confermata.');
      setBooking({ date: booking.date, start: booking.start, end: booking.end, channel: booking.channel, notes: '' });
      loadAvailability(master._id);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 402) {
        toast.error('Saldo insufficiente. Ricarica il wallet per completare la prenotazione.');
        navigate('/wallet');
      } else {
        const message = err?.response?.data?.message || 'Impossibile completare la prenotazione.';
        toast.error(message);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="container profile">
        <div className="profile-card skeleton" />
      </section>
    );
  }

  if (error || !master) {
    return (
      <section className="container profile">
        <div className="alert">{error || 'Master non disponibile.'}</div>
      </section>
    );
  }

  const ratingValue = master.kpis?.avg_rating;
  const rating = typeof ratingValue === 'number' ? ratingValue.toFixed(1) : '—';
  const dailySchedule = buildDailySchedule(master.working_hours);
  const hasSchedule = dailySchedule.some(day => day.slots.length > 0);
  const timezoneLabel = resolveTimezoneLabel(master.working_hours);
  const { status: availabilityStatus, label: availabilityLabel } = resolveAvailabilityStatus(master.availability);

  return (
    <section className="container profile">
      <div className="profile-card">
        <div className="profile-avatar">
          <img src={master.media?.avatar_url || 'https://placehold.co/320'} alt={master.display_name || 'Master Rivelya'} />
          <span className={`status-badge ${availabilityStatus}`}>{availabilityLabel}</span>
        </div>
        <div className="profile-content">
          <span className="badge-soft">Master {master.categories?.[0] || 'Rivelya'}</span>
          <h1>{master.display_name || 'Master Rivelya'}</h1>
          <p className="muted">{master.headline || 'Professionista certificato del network Rivelya.'}</p>
          <div className="profile-rating">
            <span className="rating-large">★ {rating}</span>
            <span className="muted">{master.kpis?.review_count || 0} recensioni · {master.experience_years || '5'} anni di esperienza</span>
          </div>
          <p>{master.bio || 'Questo master è disponibile per consulenze su richiesta con un approccio empatico e orientato ai risultati.'}</p>
          <div className="tag-list">
            {(master.specialties || master.categories || []).slice(0, 4).map(spec => (
              <span key={spec} className="tag">{spec}</span>
            ))}
            {(master.languages || []).map(lang => (
              <span key={lang} className="tag ghost">{lang}</span>
            ))}
          </div>
          <div className="service-icon-row" role="list" aria-label="Servizi disponibili">
            {serviceOrder.map(service => {
              const meta = serviceMeta[service];
              if (!meta) return null;
              const enabled = hasService(master.services, service);
              const { Icon } = meta;
              return (
                <span
                  key={service}
                  className={`service-chip${enabled ? ' active' : ''}`}
                  title={enabled ? meta.label : `${meta.label} non disponibile`}
                  role="listitem"
                >
                  <Icon aria-hidden="true" />
                </span>
              );
            })}
          </div>
          <div className="profile-stats">
            <div>
              <span className="stat-value">{master.kpis?.lifetime_calls || 0}</span>
              <span className="stat-label">Chiamate</span>
            </div>
            <div>
              <span className="stat-value">{master.kpis?.lifetime_chats || 0}</span>
              <span className="stat-label">Chat</span>
            </div>
            <div>
              <span className="stat-value">{master.kpis?.review_count || 0}</span>
              <span className="stat-label">Recensioni</span>
            </div>
          </div>
        </div>
      </div>
      <div className="profile-actions">
        {hasService(master.services, 'chat') && (
          <div className="rate-card">
            <p>Tariffa chat</p>
            <h3>{(master.rate_chat_cpm / 100).toFixed(2)} € / min</h3>
            <p className="muted">Risposte asincrone e follow-up via report dedicato.</p>
            <button className="btn outline" onClick={() => startSession('chat')}>
              Apri chat
            </button>
          </div>
        )}
        {hasService(master.services, 'chatVoice') && (
          <div className="rate-card emphasis">
            <p>Tariffa chat e voce</p>
            <h3>{(master.rate_chat_voice_cpm / 100).toFixed(2)} € / min</h3>
            <p className="muted">Chiamata vocale accompagnata da supporto in chat.</p>
            <button className="btn outline" onClick={() => startSession('chat_voice')}>
              Richiedi chat e voce
            </button>
          </div>
        )}
      </div>
      <div className="booking-card">
        <div className="booking-head">
          <h2>Prenota una consulenza</h2>
          <p className="muted">
            Seleziona giorno e orario tra le disponibilità reali del master. Il credito verrà prenotato e confermato al momento
            dell&apos;accettazione.
          </p>
        </div>
        {availabilityLoading && <div className="booking-skeleton" aria-hidden="true" />}
        {!availabilityLoading && availableDays.length === 0 && (
          <p className="muted">Questo master non ha ancora pubblicato disponibilità per le prossime settimane.</p>
        )}
        {!availabilityLoading && availableDays.length > 0 && (
          <div className="booking-form">
            <div className="booking-calendar">
              <p className="calendar-title">Scegli una data</p>
              <DayPicker
                mode="single"
                selected={selectedDateObject}
                onSelect={handleDaySelect}
                disabled={disabledDays}
                modifiers={modifiers}
                modifiersClassNames={{ available: 'calendar-available' }}
                weekStartsOn={1}
                fromDate={today}
                numberOfMonths={2}
                showOutsideDays
                captionLayout="buttons"
              />
              <p className="calendar-selection">{selectedDateLabel}</p>
            </div>
            <div className="booking-fields">
              <div className="booking-time-grid">
                <label className="input-label">
                  Inizio
                  <FancySelect
                    name="start"
                    value={booking.start}
                    options={startSelectOptions}
                    onChange={updateBooking}
                    placeholder="Seleziona"
                    isDisabled={startSelectOptions.length === 0}
                  />
                </label>
                <label className="input-label">
                  Fine
                  <FancySelect
                    name="end"
                    value={booking.end}
                    options={endSelectOptions}
                    onChange={updateBooking}
                    placeholder="Seleziona"
                    isDisabled={endSelectOptions.length === 0}
                  />
                </label>
              </div>
              <label className="input-label">
                Canale preferito
                <FancySelect
                  name="channel"
                  value={booking.channel}
                  options={channelOptions}
                  onChange={updateBooking}
                  isDisabled={channelOptions.length === 0}
                />
              </label>
              <div className="booking-summary">
                <div>
                  <span className="summary-label">Durata selezionata</span>
                  <strong>{durationMinutes ? `${durationMinutes} min` : '—'}</strong>
                </div>
                <div>
                  <span className="summary-label">
                    Tariffa {channelRateLabels[booking.channel] || 'selezionata'}
                  </span>
                  <strong>
                    {activeRateCents != null ? `${(activeRateCents / 100).toFixed(2)} € / min` : '—'}
                  </strong>
                </div>
                <div>
                  <span className="summary-label">Totale stimato</span>
                  <strong>{estimatedCost != null ? `${estimatedCost.toFixed(2)} €` : '—'}</strong>
                </div>
              </div>
              <p className="booking-summary-note">
                L&apos;importo viene prenotato dal tuo wallet e addebitato solo dopo la conferma del master.
              </p>
              <label className="input-label">
                Note per il master (opzionale)
                <textarea
                  name="notes"
                  rows="3"
                  value={booking.notes}
                  onChange={updateBooking}
                  placeholder="Inserisci eventuali preferenze o contesto della sessione"
                />
              </label>
              <button
                type="button"
                className="btn primary"
                onClick={submitBooking}
                disabled={bookingLoading || !booking.date || !booking.start || !booking.end || !booking.channel}
              >
                {bookingLoading ? 'Prenotazione in corso…' : 'Conferma prenotazione'}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="schedule-card">
        <div className="schedule-header">
          <h2>Disponibilità settimanale</h2>
          <span className="micro muted">{timezoneLabel}</span>
        </div>
        {hasSchedule ? (
          <ul className="schedule-grid">
            {dailySchedule.map(day => (
              <li key={day.day}>
                <span className="day-label">{day.label}</span>
                {day.slots.length > 0 ? (
                  <div className="day-slots">
                    {day.slots.map((slot, idx) => (
                      <span key={`${day.day}-${idx}`}>{slot.start} - {slot.end}</span>
                    ))}
                  </div>
                ) : (
                  <span className="day-slots off">—</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Gli orari di questo master sono disponibili su richiesta. Scrivici per fissare un appuntamento.</p>
        )}
        {master.working_hours?.notes && (
          <p className="micro muted">Note: {master.working_hours.notes}</p>
        )}
      </div>
    </section>
  );
}
