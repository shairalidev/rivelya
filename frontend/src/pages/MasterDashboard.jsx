import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchAvailabilityMonthForMaster,
  addAvailabilityBlock,
  deleteAvailabilityBlock
} from '../api/booking.js';
import client from '../api/client.js';
import FancySelect from '../components/FancySelect.jsx';
import { getUser as getStoredUser, subscribeAuthChange } from '../lib/auth.js';
import { fetchMasterProfile, updateMasterProfile } from '../api/master.js';
import useSocket from '../hooks/useSocket.js';
import { DAY_ORDER, DAY_LABELS } from '../utils/schedule.js';
import ReviewsList from '../components/ReviewsList.jsx';

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
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

let slotIdCounter = 0;
const createSlotId = () => {
  slotIdCounter += 1;
  return `slot-${slotIdCounter}`;
};

const bookingStatusLabels = {
  awaiting_master: 'In attesa',
  confirmed: 'Confermata',
  ready_to_start: 'Inizio a breve',
  reschedule_requested: 'Riprogrammazione',
  reschedule_accepted: 'Riprogrammazione',
  active: 'In corso',
  cancelled: 'Annullata',
  completed: 'Completata',
  rejected: 'Rifiutata'
};

const bookingChannelLabels = {
  chat: 'Chat',
  voice: 'Chiamata',
  chat_voice: 'Chat + Chiamata'
};

const mapWorkingHoursToForm = workingHours => {
  const source = workingHours && typeof workingHours === 'object' ? workingHours : {};
  const slots = Array.isArray(source.slots) ? source.slots : [];
  return {
    timezone: source.timezone || 'Europe/Rome',
    slots: slots.map(slot => ({
      key: createSlotId(),
      day: slot.day,
      start: slot.start,
      end: slot.end
    }))
  };
};

export default function MasterDashboard() {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const [user, setUser] = useState(() => getStoredUser());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [monthData, setMonthData] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(true);



  const [modalDay, setModalDay] = useState(null);
  const [blockForm, setBlockForm] = useState(initialBlockForm);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [workingHoursForm, setWorkingHoursForm] = useState(() => mapWorkingHoursToForm());
  const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const masterId = user?.masterId;

  const buildProfileForm = useCallback(data => ({
    displayName: data?.displayName || '',
    headline: data?.headline || '',
    bio: data?.bio || '',
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

  const buildWorkingHoursForm = useCallback(data => mapWorkingHoursToForm(data?.workingHours), []);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setProfileError('');
      const data = await fetchMasterProfile();
      setProfile(data);
      setProfileForm(buildProfileForm(data));
      setWorkingHoursForm(buildWorkingHoursForm(data));
    } catch (err) {
      const msg = err?.response?.data?.message || 'Errore durante il caricamento profilo.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  }, [buildProfileForm, buildWorkingHoursForm]);

  const loadReviews = useCallback(async () => {
    if (!user?._id) return;
    try {
      setReviewsLoading(true);
      const res = await client.get(`/reviews/user/${user._id}?reviewer_type=client&limit=20`);
      setReviews(res.data.reviews || []);
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, [user?._id]);

  const handleReplySubmit = async () => {
    if (!replyModal || !replyText.trim()) return;
    
    try {
      setReplySubmitting(true);
      const endpoint = replyModal.reply ? 'PUT' : 'POST';
      await client[endpoint.toLowerCase()](`/reviews/${replyModal._id}/reply`, {
        text: replyText.trim()
      });
      
      toast.success(replyModal.reply ? 'Risposta aggiornata' : 'Risposta inviata');
      setReplyModal(null);
      setReplyText('');
      loadReviews(); // Reload reviews to show the new reply
    } catch (err) {
      const msg = err?.response?.data?.message || 'Errore durante l\'invio della risposta';
      toast.error(msg);
    } finally {
      setReplySubmitting(false);
    }
  };

  const openReplyModal = (review) => {
    setReplyModal(review);
    setReplyText(review.reply?.text || '');
  };

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

  const modalBookings = useMemo(() => {
    if (!modalDay?.bookings) return [];
    return [...modalDay.bookings].sort((a, b) => a.start.localeCompare(b.start));
  }, [modalDay]);

  const weeklyStartOptions = useMemo(() => {
    const values = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
      values.push(minutesToTime(minutes));
    }
    return values;
  }, []);

  const weeklyEndOptions = useMemo(() => {
    const values = [];
    for (let minutes = 30; minutes <= 24 * 60; minutes += 30) {
      values.push(minutesToTime(minutes));
    }
    return values;
  }, []);

  const workingSlotsByDay = useMemo(() => {
    const grouped = DAY_ORDER.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    workingHoursForm.slots.forEach(slot => {
      if (!slot.day || !grouped[slot.day]) return;
      grouped[slot.day].push(slot);
    });
    DAY_ORDER.forEach(day => {
      grouped[day].sort((a, b) => a.start.localeCompare(b.start));
    });
    return grouped;
  }, [workingHoursForm.slots]);

  const hasCustomWeeklySlots = workingHoursForm.slots.length > 0;

  const addWorkingSlot = day => {
    setWorkingHoursForm(prev => ({
      ...prev,
      slots: [...prev.slots, { key: createSlotId(), day, start: '09:00', end: '18:00' }]
    }));
  };

  const removeWorkingSlot = slotKey => {
    setWorkingHoursForm(prev => ({
      ...prev,
      slots: prev.slots.filter(slot => slot.key !== slotKey)
    }));
  };

  const updateWorkingSlot = (slotKey, field, value) => {
    setWorkingHoursForm(prev => ({
      ...prev,
      slots: prev.slots.map(slot => (slot.key === slotKey ? { ...slot, [field]: value } : slot))
    }));
  };

  const handleWorkingHoursFieldChange = event => {
    const { name, value } = event.target;
    setWorkingHoursForm(prev => ({ ...prev, [name]: value }));
  };

  const handleResetWorkingHours = () => {
    setWorkingHoursForm(prev => ({ ...prev, slots: [] }));
  };

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



  useEffect(() => {
    if (user?.roles?.includes('master')) {
      loadProfile();
      loadReviews();
    }
  }, [user?.roles, loadProfile, loadReviews]);

  useEffect(() => {
    if (user?.roles?.includes('master')) loadMonth(monthCursor);
  }, [user?.roles, monthCursor.year, monthCursor.month]);



  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    // Socket listeners removed as requests moved to reservations page
    return () => {};
  }, [socket]);

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
      setWorkingHoursForm(buildWorkingHoursForm(updated));
      toast.success('Profilo aggiornato.');
    } catch (err) {
      toast.error('Errore aggiornamento profilo.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    try {
      setProfileSaving(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await client.post('/master/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedProfile = response.data.master;
      setProfile(updatedProfile);
      setProfileForm(buildProfileForm(updatedProfile));
      toast.success('Foto profilo aggiornata');
      
      // Force image refresh by adding timestamp
      const avatarImg = document.querySelector('.avatar-preview img');
      if (avatarImg && updatedProfile.media?.avatarUrl) {
        avatarImg.src = updatedProfile.media.avatarUrl + '?t=' + Date.now();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Errore durante il caricamento';
      toast.error(msg);
    } finally {
      setProfileSaving(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveWorkingHours = async () => {
    const sanitizedSlots = [];
    let invalid = false;

    workingHoursForm.slots.forEach(slot => {
      const dayKey = DAY_ORDER.includes(slot.day) ? slot.day : null;
      if (!dayKey) {
        invalid = true;
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) {
        invalid = true;
        return;
      }
      const startMinutes = timeToMinutes(slot.start);
      const endMinutes = timeToMinutes(slot.end);
      if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes <= startMinutes) {
        invalid = true;
        return;
      }
      sanitizedSlots.push({ day: dayKey, start: slot.start, end: slot.end });
    });

    if (invalid) {
      toast.error('Controlla gli orari inseriti.');
      return;
    }

    try {
      setWorkingHoursSaving(true);
      const payload = {
        workingHours: {
          timezone: workingHoursForm.timezone?.trim() || 'Europe/Rome',
          slots: sanitizedSlots
        }
      };
      const updated = await updateMasterProfile(payload);
      setProfile(updated);
      setProfileForm(buildProfileForm(updated));
      setWorkingHoursForm(buildWorkingHoursForm(updated));
      toast.success('Disponibilità settimanale aggiornata.');
      loadMonth(monthCursor);
    } catch (err) {
      toast.error('Errore nel salvataggio delle disponibilità.');
    } finally {
      setWorkingHoursSaving(false);
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
                      profile?.media?.avatarUrl ||
                      user?.avatarUrl ||
                      'https://placehold.co/300x300'
                    }
                    alt="Avatar"
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/300x300';
                    }}
                  />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                  ref={avatarInputRef}
                />
                <button
                  type="button"
                  className="btn outline small"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={profileSaving}
                >
                  Carica foto
                </button>
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

      {/* CALENDAR FULL WIDTH */}
      <div className="calendar-card" style={{ width: '100%' }}>
        <div className="calendar-head">
          <h2>Disponibilità mensile</h2>
          <p className="muted">Blocca o gestisci le eccezioni con facilità. Per gestire le prenotazioni vai alla <a href="/reservations" style={{ color: 'var(--accent)' }}>Gestione Prenotazioni</a>.</p>
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
                  const hasBookings = (day.bookings || []).length > 0;
                  const label = Number(day.date.split('-')[2]);

                  return (
                    <button
                      key={day.date}
                      className={`calendar-day${isBlocked ? ' blocked' : ''}${hasAvail ? ' available' : ''}${
                        hasBookings ? ' has-bookings' : ''
                      }`}
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

      <div className="profile-settings-card weekly-availability-card">
        <div className="profile-settings-head">
          <h2>Disponibilità settimanale</h2>
          <p className="muted">
            Definisci le fasce ricorrenti prenotabili dai clienti. Le eccezioni possono sempre essere gestite dal calendario
            mensile.
          </p>
        </div>

        <div className="timezone-control">
          <label className="input-label">
            Fuso orario
            <input
              type="text"
              name="timezone"
              value={workingHoursForm.timezone}
              onChange={handleWorkingHoursFieldChange}
              placeholder="Europe/Rome"
            />
          </label>
          <p className="micro muted">
            Se non imposti fasce per un giorno resterà prenotabile h24 salvo blocchi inseriti nel calendario mensile.
          </p>
        </div>

        <div className="weekly-availability-grid">
          {DAY_ORDER.map(day => {
            const slots = workingSlotsByDay[day] || [];
            const label = DAY_LABELS[day]?.full || day;
            const statusLabel = hasCustomWeeklySlots
              ? slots.length > 0
                ? 'Fasce attive'
                : 'Giorno non disponibile'
              : 'Prenotabile h24';
            return (
              <div key={day} className="weekly-day-card">
                <div className="weekly-day-head">
                  <div>
                    <h3>{label}</h3>
                    <span className="micro muted">{statusLabel}</span>
                  </div>
                  <button type="button" className="btn ghost small" onClick={() => addWorkingSlot(day)}>
                    + Fascia
                  </button>
                </div>

                {slots.length === 0 ? (
                  <p className="weekly-day-empty">
                    {hasCustomWeeklySlots ? 'Nessuna fascia impostata.' : 'Disponibile h24 di default.'}
                  </p>
                ) : (
                  <div className="weekly-slot-list">
                    {slots.map(slot => {
                      const endOptions = slot.start
                        ? weeklyEndOptions.filter(option => timeToMinutes(option) > timeToMinutes(slot.start))
                        : weeklyEndOptions;
                      return (
                        <div className="weekly-slot-row" key={slot.key}>
                          <label>
                            <span className="micro muted">Inizio</span>
                            <select
                              value={slot.start}
                              onChange={evt => updateWorkingSlot(slot.key, 'start', evt.target.value)}
                            >
                              <option value="">--</option>
                              {weeklyStartOptions.map(time => (
                                <option key={`start-${slot.key}-${time}`} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span className="micro muted">Fine</span>
                            <select
                              value={slot.end}
                              onChange={evt => updateWorkingSlot(slot.key, 'end', evt.target.value)}
                            >
                              <option value="">--</option>
                              {endOptions.map(time => (
                                <option key={`end-${slot.key}-${time}`} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button type="button" className="btn ghost small" onClick={() => removeWorkingSlot(slot.key)}>
                            Rimuovi
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="weekly-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={handleResetWorkingHours}
            disabled={workingHoursSaving}
          >
            Ripristina h24
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSaveWorkingHours}
            disabled={workingHoursSaving}
          >
            {workingHoursSaving ? 'Salvataggio' : 'Salva disponibilità'}
          </button>
        </div>
      </div>

      {/* MODAL */}
      {modalDay && monthData && (
        <div className="modal-backdrop" onClick={() => setModalDay(null)}>
          <div className="modal-card day-modal" onClick={e => e.stopPropagation()}>
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

            <div className="day-modal-body">
              <div className="day-modal-column day-modal-bookings">
                <div className="modal-section-head">
                  <p className="micro">Prenotazioni del giorno</p>
                  <span className="micro muted">
                    {modalBookings.length > 0
                      ? `${modalBookings.length} sessione${modalBookings.length > 1 ? 'i' : ''}`
                      : 'Nessuna prenotazione registrata'}
                  </span>
                </div>

                {modalBookings.length === 0 ? (
                  <p className="muted">Non sono presenti prenotazioni per questa data.</p>
                ) : (
                  <ul className="day-booking-list">
                    {modalBookings.map(booking => (
                      <li key={booking.id} className="day-booking-item">
                        <div className="day-booking-row">
                          <div className="day-booking-time">
                            <strong>{booking.start} – {booking.end}</strong>
                            <span className="micro muted">{bookingChannelLabels[booking.channel] || booking.channel}</span>
                          </div>

                          <span className={`status status--${booking.status || 'awaiting_master'}`}>
                            {bookingStatusLabels[booking.status] || booking.status || 'In attesa'}
                          </span>
                        </div>

                        <div className="day-booking-meta">
                          <span className="micro">{booking.customer?.name || 'Cliente'}</span>
                          {typeof booking.amount_cents === 'number' && (
                            <span className="micro muted">€ {formatCurrency(booking.amount_cents)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="day-modal-column day-modal-controls">
                {modalDay.fullDayBlocked ? (
                  <p className="muted">Giorno già bloccato completamente.</p>
                ) : (
                  <p className="muted">
                    Le fasce disponibili seguono la tua disponibilità settimanale oppure restano h24 se non hai impostato alcuna
                    fascia.
                  </p>
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
                            className="btn ghost small"
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
        </div>
      )}

      {/* REVIEWS SECTION */}
      <div className="profile-settings-card" style={{ width: '100%' }}>
        <div className="profile-settings-head">
          <h2>Recensioni ricevute</h2>
          <p className="muted">Gestisci le recensioni dei tuoi clienti e rispondi per migliorare la tua reputazione.</p>
        </div>

        {reviewsLoading ? (
          <div className="reviews-loading">
            <p>Caricamento recensioni...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">
            <p>Non hai ancora ricevuto recensioni dai clienti.</p>
          </div>
        ) : (
          <div className="reviews-list">
            {reviews.map(review => (
              <div key={review._id} className="review-item-enhanced">
                <div className="review-item-header">
                  <div className="review-author-section">
                    <div className="review-author-details">
                      <p className="review-author-name">
                        {review.reviewer_id?.display_name || 'Cliente Rivelya'}
                      </p>
                      <p className="review-date-text">
                        {new Date(review.createdAt).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  <div className="review-rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className={`review-star ${star <= review.rating ? 'filled' : ''}`}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                {review.text && (
                  <p className="review-content">{review.text}</p>
                )}
                {review.reply && (
                  <div className="review-reply">
                    <div className="review-reply-header">
                      <span className="review-reply-label">La tua risposta</span>
                      <span className="review-reply-date">
                        {new Date(review.reply.createdAt).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    <p className="review-reply-content">{review.reply.text}</p>
                  </div>
                )}
                <div className="review-actions">
                  <button
                    className="btn outline small"
                    onClick={() => openReplyModal(review)}
                  >
                    {review.reply ? 'Modifica risposta' : 'Rispondi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REPLY MODAL */}
      {replyModal && (
        <div className="modal-backdrop" onClick={() => setReplyModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{replyModal.reply ? 'Modifica risposta' : 'Rispondi alla recensione'}</h3>
              <button className="modal-close" onClick={() => setReplyModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="original-review">
                <div className="review-rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={`review-star ${star <= replyModal.rating ? 'filled' : ''}`}>
                      ★
                    </span>
                  ))}
                </div>
                {replyModal.text && (
                  <p className="review-content">{replyModal.text}</p>
                )}
              </div>
              
              <label className="input-label">
                La tua risposta
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Scrivi una risposta professionale e cortese..."
                  rows={4}
                  maxLength={500}
                  disabled={replySubmitting}
                />
                <div className="char-count">{replyText.length}/500 caratteri</div>
              </label>
            </div>

            <div className="modal-footer">
              <button 
                className="btn secondary" 
                onClick={() => setReplyModal(null)}
                disabled={replySubmitting}
              >
                Annulla
              </button>
              <button 
                className="btn primary" 
                onClick={handleReplySubmit}
                disabled={replySubmitting || !replyText.trim()}
              >
                {replySubmitting ? 'Invio...' : (replyModal.reply ? 'Aggiorna risposta' : 'Invia risposta')}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
