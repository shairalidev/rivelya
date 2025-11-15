import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchMasterProfile, updateMasterProfile } from '../api/master.js';
import useSocket from '../hooks/useSocket.js';

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const statusLabels = {
  awaiting_master: 'In attesa',
  confirmed: 'Confermato',
  rejected: 'Rifiutato'
};
const channelLabels = {
  chat: 'Chat',
  voice: 'Voce',
  chat_voice: 'Chat e Voce'
};

const formatCurrency = c => (c / 100).toFixed(2);

const formatCentsInput = value => {
  if (typeof value !== 'number') return '';
  return (value / 100).toFixed(2);
};

const parseEuroInput = value => {
  if (!value) return 0;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
};

const parseListInput = value =>
  value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

const initialProfileForm = {
  displayName: '',
  headline: '',
  bio: '',
  avatarUrl: '',
  introVideoUrl: '',
  languages: '',
  specialties: '',
  categories: '',
  experienceYears: '',
  rateChat: '',
  rateVoice: '',
  rateChatVoice: '',
  services: { chat: true, voice: false, chatVoice: false },
  acceptingRequests: true
};

const formatDateLabel = (year, month) => {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

const timeToMinutes = v => {
  if (!/^\d{2}:\d{2}$/.test(v)) return Number.NaN;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = val =>
  `${String(Math.floor(val / 60)).padStart(2, '0')}:${String(val % 60).padStart(2, '0')}`;

const toTimeOptions = range => {
  const arr = [];
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return arr;
  for (let p = start; p < end; p += 30) arr.push(minutesToTime(p));
  return arr;
};

const buildEndOptions = (ranges, startVal) => {
  if (!/^\d{2}:\d{2}$/.test(startVal)) return [];
  const startMin = timeToMinutes(startVal);
  const set = new Set();
  ranges.forEach(r => {
    const rs = timeToMinutes(r.start);
    const re = timeToMinutes(r.end);
    if (startMin < rs || startMin >= re) return;
    for (let p = Math.max(startMin + 30, rs + 30); p <= re; p += 30) {
      set.add(minutesToTime(p));
    }
  });
  return [...set].sort();
};

const buildCalendar = (year, month, days) => {
  const result = [];
  const first = new Date(year, month - 1, 1).getDay();
  const padStart = (first + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid = [];

  for (let i = 0; i < padStart; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    grid.push(days.find(item => item.date === key) || { date: key, availableRanges: [] });
  }
  while (grid.length % 7 !== 0) grid.push(null);

  for (let i = 0; i < grid.length; i += 7) {
    result.push(grid.slice(i, i + 7));
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

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(initialProfileForm);

  const masterId = user?.masterId;

  const buildProfileForm = useCallback(data => ({
    displayName: data?.displayName || '',
    headline: data?.headline || '',
    bio: data?.bio || '',
    avatarUrl: data?.media?.avatarUrl || '',
    introVideoUrl: data?.media?.introVideoUrl || '',
    languages: (data?.languages || []).join(', '),
    specialties: (data?.specialties || []).join(', '),
    categories: (data?.categories || []).join(', '),
    experienceYears:
      data?.experienceYears != null && !Number.isNaN(data.experienceYears)
        ? String(data.experienceYears)
        : '',
    rateChat: formatCentsInput(data?.rateChatCpm ?? 0),
    rateVoice: formatCentsInput(data?.rateVoiceCpm ?? 0),
    rateChatVoice: formatCentsInput(data?.rateChatVoiceCpm ?? 0),
    services: {
      chat: data?.services?.chat !== false,
      voice: data?.services?.voice ?? false,
      chatVoice: data?.services?.chatVoice ?? false
    },
    acceptingRequests: data?.isAcceptingRequests !== false
  }), []);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setProfileError('');
      const data = await fetchMasterProfile();
      setProfile(data);
      setProfileForm(buildProfileForm(data));
    } catch (err) {
      const msg = err?.response?.data?.message || 'Errore durante il caricamento profilo.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  }, [buildProfileForm]);

  const startSelectOptions = useMemo(() => {
    if (!modalDay) return [];
    const set = new Set();
    (modalDay.availableRanges || []).forEach(r => {
      toTimeOptions(r).forEach(v => set.add(v));
    });
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [modalDay]);

  const endSelectOptions = useMemo(
    () =>
      modalDay
        ? buildEndOptions(modalDay.availableRanges || [], blockForm.start).map(v => ({ value: v, label: v }))
        : [],
    [modalDay, blockForm.start]
  );

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    const unsub = subscribeAuthChange(sync);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      toast.error('Accedi come master.');
      navigate('/login?returnTo=/master/dashboard');
      return;
    }
    if (!user.roles?.includes('master')) {
      toast.error('Accesso negato.');
      navigate('/');
    }
  }, [user, navigate]);

  const loadMonth = async params => {
    try {
      setLoadingMonth(true);
      const data = await fetchAvailabilityMonthForMaster(params);
      setMonthData(data);
    } catch {
      toast.error('Errore caricamento calendario.');
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadRequests = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingRequests(true);
      const data = await fetchMasterRequests();
      setRequests(data);
    } catch {
      toast.error('Impossibile caricare richieste.');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (user?.roles?.includes('master')) loadProfile();
  }, [user?.roles, loadProfile]);

  useEffect(() => {
    if (user?.roles?.includes('master')) loadMonth(monthCursor);
  }, [user?.roles, monthCursor.year, monthCursor.month]);

  useEffect(() => {
    if (user?.roles?.includes('master')) loadRequests();
  }, [user?.roles, loadRequests]);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const reload = () => loadRequests(true);
    socket.on('notification:new', reload);
    socket.on('booking:updated', reload);
    socket.on('booking:request', reload);
    return () => {
      socket.off('notification:new', reload);
      socket.off('booking:updated', reload);
      socket.off('booking:request', reload);
    };
  }, [socket, loadRequests]);

  const calendar = useMemo(() => {
    if (!monthData) return [];
    return buildCalendar(monthData.year, monthData.month, monthData.days);
  }, [monthData]);

  const openDayModal = day => {
    if (!day) return;
    const first = day.availableRanges?.[0];
    if (first) {
      const start = first.start;
      const endOpts = buildEndOptions([first], first.start);
      setBlockForm({
        start,
        end: endOpts[0] || first.end || minutesToTime(timeToMinutes(start) + 30)
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
      toast.success(fullDay ? 'Giornata bloccata.' : 'Fascia bloccata.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Errore aggiornamento disponibilità.';
      toast.error(msg);
    }
  };

  const handleRemoveBlock = async blockId => {
    try {
      const updated = await deleteAvailabilityBlock(blockId, {
        year: monthData.year,
        month: monthData.month
      });
      setMonthData(updated);
      if (modalDay) {
        const refreshed = updated.days.find(d => d.date === modalDay.date);
        if (refreshed) setModalDay(refreshed);
      }
      toast.success('Restrizione rimossa.');
    } catch {
      toast.error('Errore rimozione blocco.');
    }
  };

  const updateBlockForm = e => {
    const { name, value } = e.target;
    setBlockForm(prev => ({ ...prev, [name]: value }));
  };

  const changeMonth = dir => {
    setMonthData(null);
    setModalDay(null);
    setMonthCursor(prev => {
      const base = new Date(prev.year, prev.month - 1 + dir, 1);
      return { year: base.getFullYear(), month: base.getMonth() + 1 };
    });
  };

  const updateProfileField = e => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleService = s => {
    setProfileForm(prev => ({
      ...prev,
      services: { ...prev.services, [s]: !prev.services[s] }
    }));
  };

  const toggleAcceptingRequests = () => {
    setProfileForm(prev => ({
      ...prev,
      acceptingRequests: !prev.acceptingRequests
    }));
  };

  const saveProfile = async () => {
    try {
      setProfileSaving(true);

      const payload = {
        displayName: profileForm.displayName.trim(),
        headline: profileForm.headline.trim(),
        bio: profileForm.bio.trim(),
        avatarUrl: profileForm.avatarUrl.trim() || null,
        introVideoUrl: profileForm.introVideoUrl.trim() || null,
        experienceYears: profileForm.experienceYears ? Number(profileForm.experienceYears) : 0,
        languages: parseListInput(profileForm.languages),
        specialties: parseListInput(profileForm.specialties),
        categories: parseListInput(profileForm.categories),
        acceptingRequests: profileForm.acceptingRequests,
        services: {
          chat: profileForm.services.chat,
          voice: profileForm.services.voice,
          chatVoice: profileForm.services.chatVoice
        },
        rates: {
          chat: parseEuroInput(profileForm.rateChat),
          voice: parseEuroInput(profileForm.rateVoice),
          chatVoice: parseEuroInput(profileForm.rateChatVoice)
        }
      };

      if (Number.isNaN(payload.experienceYears) || payload.experienceYears < 0) {
        payload.experienceYears = 0;
      }

      const updated = await updateMasterProfile(payload);
      setProfile(updated);
      setProfileForm(buildProfileForm(updated));
      toast.success('Profilo aggiornato.');
    } catch (err) {
      toast.error('Errore aggiornamento profilo.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRespond = async (bookingId, action) => {
    try {
      const updated = await respondToBooking(bookingId, action);
      setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      toast.success(action === 'accept' ? 'Richiesta accettata.' : 'Richiesta rifiutata.');
      loadMonth(monthCursor);
    } catch {
      toast.error('Errore nella risposta.');
    }
  };

  const startCommunication = () => {
    navigate('/chat');
  };

  const startVoiceCall = async (bookingId) => {
    try {
      const res = await client.post(`/bookings/${bookingId}/start-voice`);
      if (res.data.redirect_url) {
        navigate(res.data.redirect_url);
      }
    } catch (error) {
      toast.error('Impossibile avviare la chiamata vocale.');
    }
  };

  return (
    <section className="container master-dashboard">

      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Pannello Consulente</p>
          <h1>Profilo, calendario e richieste</h1>
          <p className="muted">
            Aggiorna i tuoi dati e gestisci le richieste in arrivo con un flusso operativo chiaro e strutturato.
          </p>
        </div>

        <div className="month-controls">
          <button type="button" className="btn ghost" onClick={() => changeMonth(-1)}>←</button>
          <p>{formatDateLabel(monthCursor.year, monthCursor.month)}</p>
          <button type="button" className="btn ghost" onClick={() => changeMonth(1)}>→</button>
        </div>
      </div>

      {/* PROFILE BLOCK FULL WIDTH */}
      <div className="profile-settings-card" style={{ width: '100%' }}>
        <div className="profile-settings-head">
          <h2>Profilo pubblico</h2>
          <p className="muted">Personalizza le informazioni mostrate ai clienti.</p>
        </div>

        {profileLoading ? (
          <div className="profile-settings-skeleton" />
        ) : profileError ? (
          <div className="alert small">{profileError}</div>
        ) : (
          <div className="profile-settings-grid">
            {/* LEFT COLUMN */}
            <div className="profile-settings-column">
              <div className="profile-avatar-card profile-section media">
                <span className="section-title">Foto profilo</span>
                <div className="avatar-preview">
                  <img
                    src={
                      profileForm.avatarUrl ||
                      user?.avatarUrl ||
                      'https://placehold.co/300x300'
                    }
                    alt="Avatar"
                  />
                </div>
              </div>

              <div className="profile-section media">
                <span className="section-title">Media &amp; link</span>
                <label className="input-label">
                  URL foto profilo
                  <input
                    type="url"
                    name="avatarUrl"
                    value={profileForm.avatarUrl}
                    onChange={updateProfileField}
                    placeholder="https://"
                  />
                </label>

                </div>

              <div className={`visibility-toggle${profileForm.acceptingRequests ? ' active' : ''}`}>
                <div className="visibility-header">
                  <p className="micro muted">Visibilità profilo</p>
                  <span className="visibility-status">
                    {profileForm.acceptingRequests ? 'Visibile nel catalogo' : 'Nascosto dal catalogo'}
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileForm.acceptingRequests}
                    onChange={toggleAcceptingRequests}
                  />
                  <span className="slider" />
                </label>
                <p className="micro muted">
                  Disattiva per prendere una pausa: i clienti non potranno inviarti nuove richieste finché non riattiverai il
                  profilo.
                </p>
              </div>

              <div className="profile-section services">
                <span className="section-title">Servizi attivi</span>
                <div className="service-toggle-group">
                  <label className={`service-toggle${profileForm.services.chat ? ' active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={profileForm.services.chat}
                      onChange={() => toggleService('chat')}
                    />
                    <span>Solo Chat</span>
                  </label>

                  <label className={`service-toggle${profileForm.services.voice ? ' active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={profileForm.services.voice}
                      onChange={() => toggleService('voice')}
                    />
                    <span>Solo Voce</span>
                  </label>

                  <label className={`service-toggle${profileForm.services.chatVoice ? ' active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={profileForm.services.chatVoice}
                      onChange={() => toggleService('chatVoice')}
                    />
                    <span>Chat e Voce</span>
                  </label>
                </div>
              </div>

              <div className="profile-section">
                <div className={`visibility-toggle${profileForm.acceptingRequests ? ' active' : ''}`}>
                  <div className="visibility-header">
                    <p className="micro muted">Visibilità profilo</p>
                    <span className="visibility-status">
                      {profileForm.acceptingRequests ? 'Visibile nel catalogo' : 'Nascosto dal catalogo'}
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={profileForm.acceptingRequests}
                      onChange={toggleAcceptingRequests}
                    />
                    <span className="slider" />
                  </label>
                  <p className="micro muted">
                    Disattiva per prendere una pausa: i clienti non potranno inviarti nuove richieste finché non riattiverai il
                    profilo.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="profile-settings-column">
              <div className="profile-section">
                <span className="section-title">Informazioni principali</span>
                <div className="field-grid">
                  <label className="input-label">
                    Nome pubblico
                    <input
                      type="text"
                      name="displayName"
                      value={profileForm.displayName}
                      onChange={updateProfileField}
                    />
                  </label>

                  <label className="input-label">
                    Headline
                    <input
                      type="text"
                      name="headline"
                      value={profileForm.headline}
                      onChange={updateProfileField}
                    />
                  </label>
                </div>

                <label className="input-label">
                  Biografia
                  <textarea
                    rows="4"
                    name="bio"
                    value={profileForm.bio}
                    onChange={updateProfileField}
                  />
                </label>
              </div>

              <div className="profile-section">
                <span className="section-title">Competenze</span>
                <label className="input-label">
                  Lingue (separa con virgola)
                  <input
                    type="text"
                    name="languages"
                    value={profileForm.languages}
                    onChange={updateProfileField}
                    placeholder="Italiano, Inglese"
                  />
                </label>

                <label className="input-label">
                  Specializzazioni (separa con virgola)
                  <input
                    type="text"
                    name="specialties"
                    value={profileForm.specialties}
                    onChange={updateProfileField}
                    placeholder="Meditazione, Coaching"
                  />
                </label>

                <label className="input-label">
                  Categorie (separa con virgola)
                  <input
                    type="text"
                    name="categories"
                    value={profileForm.categories}
                    onChange={updateProfileField}
                    placeholder="Mindfulness, Crescita personale"
                  />
                </label>

                <label className="input-label">
                  Anni di esperienza
                  <input
                    type="number"
                    min="0"
                    name="experienceYears"
                    value={profileForm.experienceYears}
                    onChange={updateProfileField}
                  />
                </label>
              </div>

              <div className="rate-grid">
                <label className="input-label">
                  Tariffa solo chat (€ al minuto)
                  <div className={`input-with-prefix${profileForm.services.chat ? '' : ' disabled'}`}>
                    <span>€</span>
                    <input
                      type="text"
                      name="rateChat"
                      value={profileForm.rateChat}
                      disabled={!profileForm.services.chat}
                      onChange={updateProfileField}
                      placeholder="0.00"
                    />
                    <span className="suffix">/min</span>
                  </div>
                </label>

                <label className="input-label">
                  Tariffa solo voce (€ al minuto)
                  <div className={`input-with-prefix${profileForm.services.voice ? '' : ' disabled'}`}>
                    <span>€</span>
                    <input
                      type="text"
                      name="rateVoice"
                      value={profileForm.rateVoice}
                      disabled={!profileForm.services.voice}
                      onChange={updateProfileField}
                      placeholder="0.00"
                    />
                    <span className="suffix">/min</span>
                  </div>
                </label>

                <label className="input-label">
                  Tariffa chat e voce (€ al minuto)
                  <div className={`input-with-prefix${profileForm.services.chatVoice ? '' : ' disabled'}`}>
                    <span>€</span>
                    <input
                      type="text"
                      name="rateChatVoice"
                      value={profileForm.rateChatVoice}
                      disabled={!profileForm.services.chatVoice}
                      onChange={updateProfileField}
                      placeholder="0.00"
                    />
                    <span className="suffix">/min</span>
                  </div>
                </label>
              </div>

              <div className="profile-section action-bar">
                <div className="profile-actions-row">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={saveProfile}
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Salvataggio' : 'Salva modifiche'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GRID: CALENDAR + REQUESTS */}
      <div className="dashboard-grid">

        {/* CALENDAR */}
        <div className="calendar-card">
          <div className="calendar-head">
            <h2>Disponibilità mensile</h2>
            <p className="muted">Blocca o gestisci le eccezioni con facilità.</p>
          </div>

          {loadingMonth ? (
            <div className="calendar-skeleton" />
          ) : !monthData ? (
            <p className="muted">Nessun dato disponibile.</p>
          ) : (
            <div className="calendar-grid">
              <div className="calendar-weekdays">
                {weekdays.map(w => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              {calendar.map((week, idx) => (
                <div className="calendar-week" key={`wk-${idx}`}>
                  {week.map((day, i) => {
                    if (!day)
                      return <button key={`e-${i}`} className="calendar-day empty" />;

                    const isBlocked = day.fullDayBlocked;
                    const hasAvail = day.availableRanges?.length > 0;
                    const label = Number(day.date.split('-')[2]);

                    return (
                      <button
                        key={day.date}
                        className={`calendar-day${isBlocked ? ' blocked' : ''}${hasAvail ? ' available' : ''}`}
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

        {/* REQUESTS CLEANED */}
        <div className="requests-card">
          <div className="requests-head">
            <h2>Richieste clienti</h2>
            <p className="muted">Gestisci le prenotazioni in arrivo.</p>
          </div>

          {loadingRequests ? (
            <div className="request-skeleton" />
          ) : requests.length === 0 ? (
            <p className="muted">Nessuna richiesta in questo periodo.</p>
          ) : (
            <ul className="requests-list">
              {requests.map(req => (
                <li key={req.id} className={`request-item status-${req.status}`}>

                  {/* LEFT INFO */}
                  <div>
                    <p className="request-date">
                      {new Date(`${req.date}T${req.start}:00`).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      · {channelLabels[req.channel] || req.channel}
                    </p>

                    <p className="muted">
                      {req.customer?.name || 'Cliente'} · {formatCurrency(req.amount_cents)} €
                    </p>

                    {req.notes && (
                      <p className="micro muted">Nota: {req.notes}</p>
                    )}
                  </div>

                  {/* CLEANED ACTIONS */}
                  <div className="request-actions">
                    {req.status === 'awaiting_master' ? (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => handleRespond(req.id, 'accept')}
                        >
                          Accetta
                        </button>

                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => handleRespond(req.id, 'reject')}
                        >
                          Rifiuta
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="status-pill">{statusLabels[req.status]}</span>

                        {req.status === 'confirmed' && req.channel === 'voice' && (
                          <button
                            type="button"
                            className="btn outline"
                            onClick={() => startVoiceCall(req.id)}
                          >
                            Avvia chiamata
                          </button>
                        )}
                        {req.status === 'confirmed' &&
                          ['chat', 'chat_voice'].includes(req.channel) &&
                          profile?.services?.chat !== false && (
                            <button
                              type="button"
                              className="btn outline"
                              onClick={startCommunication}
                            >
                              Apri chat
                            </button>
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

      {/* MODAL */}
      {modalDay && monthData && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h3>
                {new Date(`${modalDay.date}T00:00:00`).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long'
                })}
              </h3>
              <button type="button" className="btn ghost" onClick={() => setModalDay(null)}>×</button>
            </div>

            <div className="modal-body">
              {modalDay.fullDayBlocked ? (
                <p className="muted">Giorno già bloccato completamente.</p>
              ) : (
                <p className="muted">Il giorno è prenotabile dalle 08.00 alle 22.00.</p>
              )}

              {modalDay.blocks?.length > 0 && (
                <div className="modal-section">
                  <p className="micro">Restrizioni attive</p>

                  <ul className="block-list">
                    {modalDay.blocks.map(b => (
                      <li key={b.id || b._id}>
                        {b.fullDay ? 'Intera giornata' : `${b.start} - ${b.end}`}

                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => handleRemoveBlock(b.id || b._id)}
                        >
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
                    />
                  </label>

                  <label className="input-label">
                    Fine
                    <FancySelect
                      name="end"
                      value={blockForm.end}
                      options={endSelectOptions}
                      onChange={updateBlockForm}
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
