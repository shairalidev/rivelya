import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { fetchProfile, updateProfile, uploadAvatar, removeAvatar } from '../api/profile.js';
import FancySelect from '../components/FancySelect.jsx';
import { getToken, notifyAuthChange, setUser as storeUser } from '../lib/auth.js';
import client from '../api/client.js';

const initialForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  phone: '',
  locale: 'it-IT',
  bio: '',
  location: '',
  taxCode: '',
  vatNumber: '',
  birthDate: '',
  birthPlace: '',
  address: '',
  iban: '',
  taxRegime: 'forfettario'
};

const localeOptions = [
  { value: 'it-IT', label: 'Italiano' },
  { value: 'en-GB', label: 'English' },
  { value: 'es-ES', label: 'Español' }
];

export default function Profile() {
  const [form, setForm] = useState(initialForm);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchProfile()
      .then(profile => {
        if (!mounted) return;
        setUser(profile);
        setForm({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          displayName: profile.displayName || '',
          phone: profile.phone || '',
          locale: profile.locale || 'it-IT',
          bio: profile.bio || '',
          location: profile.location || '',
          taxCode: profile.taxCode || '',
          vatNumber: profile.vatNumber || '',
          birthDate: profile.birthDate ? new Date(profile.birthDate).toISOString().split('T')[0] : '',
          birthPlace: profile.birthPlace || '',
          address: profile.address || '',
          iban: profile.iban || '',
          taxRegime: profile.taxRegime || 'forfettario'
        });
        // Load user reviews
        loadReviews(profile._id);
      })
      .catch(err => {
        if (err?.response?.status === 401) {
          toast.error('La sessione è scaduta. Accedi nuovamente.');
          navigate('/login', { replace: true });
          return;
        }
        toast.error('Impossibile caricare il profilo.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const loadReviews = async (userId) => {
    try {
      setReviewsLoading(true);
      const response = await client.get(`/review/user/${userId}?reviewer_type=master`);
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const syncUser = updated => {
    setUser(updated);
    const storedToken = getToken();
    if (storedToken) {
      storeUser(updated);
      notifyAuthChange();
    }
  };

  const updateField = evt => {
    const { name, value } = evt.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async evt => {
    evt.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      const updated = await updateProfile(form);
      syncUser(updated);
      toast.success('Profilo aggiornato con successo.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Aggiornamento non riuscito.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async evt => {
    const file = evt.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Carica un file immagine.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'immagine deve essere inferiore a 5MB.');
      return;
    }
    try {
      setAvatarLoading(true);
      const updated = await uploadAvatar(file);
      syncUser(updated);
      toast.success('Foto profilo aggiornata.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Caricamento non riuscito.';
      toast.error(message);
    } finally {
      setAvatarLoading(false);
      evt.target.value = '';
    }
  };

  const deleteAvatar = async () => {
    if (!user?.avatarUrl) return;
    try {
      setAvatarLoading(true);
      const updated = await removeAvatar();
      syncUser(updated);
      toast.success('Foto profilo rimossa.');
    } catch (error) {
      toast.error('Impossibile rimuovere l\'immagine.');
    } finally {
      setAvatarLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="container account-profile">
        <div className="account-profile__header">
          <p className="eyebrow">Profilo</p>
          <h1>Gestione profilo</h1>
          <p className="muted">Carichiamo le tue informazioni…</p>
        </div>
        <div className="account-profile__skeleton" />
      </section>
    );
  }

  return (
    <section className="container account-profile">
      <div className="account-profile__header">
        <p className="eyebrow">Profilo</p>
        <h1>La tua identità su Rivelya</h1>
        <p className="muted">Aggiorna i dati personali, i contatti e la biografia visibile ai Esperti.</p>
      </div>
      <div className="account-profile__grid">
        <div className="account-card account-card--compact">
          <div className="account-avatar">
            <div className="account-avatar-preview">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar utente" />
              ) : (
                <span>{(user?.displayName || user?.email || 'RV').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="account-avatar-actions">
              <label className="btn outline">
                Cambia immagine
                <input type="file" accept="image/*" onChange={changeAvatar} disabled={avatarLoading} hidden />
              </label>
              {user?.avatarUrl && (
                <button type="button" className="btn ghost" onClick={deleteAvatar} disabled={avatarLoading}>
                  Rimuovi
                </button>
              )}
              {avatarLoading && <p className="muted">Aggiornamento in corso…</p>}
            </div>
          </div>
          <div className="account-meta">
            <p className="account-meta-name">{user?.displayName || 'Profilo Rivelya'}</p>
            <p className="muted">{user?.email}</p>
            <span className={`account-status${user?.isEmailVerified ? ' success' : ''}`}>
              {user?.isEmailVerified ? 'Email verificata' : 'Email non verificata'}
            </span>
          </div>
        </div>
        <form className="account-card" onSubmit={submit}>
          <div className="account-section">
            <h2>Dati personali</h2>
            <p className="muted">Personalizza come gli altri vedono il tuo profilo.</p>
            <div className="account-form-grid">
              <label className="input-label">
                Nome
                <input name="firstName" value={form.firstName} onChange={updateField} placeholder="Nome" />
              </label>
              <label className="input-label">
                Cognome
                <input name="lastName" value={form.lastName} onChange={updateField} placeholder="Cognome" />
              </label>
              <label className="input-label" data-span="2">
                Nome pubblico
                <input
                  name="displayName"
                  value={form.displayName}
                  onChange={updateField}
                  placeholder="Come apparirai agli altri"
                />
              </label>
            </div>
          </div>
          <div className="account-section">
            <h2>Contatti</h2>
            <p className="muted">Mantieni aggiornati i canali di contatto per comunicazioni di servizio.</p>
            <div className="account-form-grid">
              <label className="input-label">
                Email
                <input value={user?.email || ''} disabled />
              </label>
              <label className="input-label">
                Telefono
                <input
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  placeholder="+39 3XX XXX XXXX"
                />
              </label>
              <label className="input-label">
                Paese / Città
                <input
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  placeholder="Milano, Italia"
                />
              </label>
              <label className="input-label">
                Lingua
                <FancySelect name="locale" value={form.locale} options={localeOptions} onChange={updateField} />
              </label>
            </div>
          </div>
          <div className="account-section">
            <h2>Biografia</h2>
            <p className="muted">Racconta chi sei e quali servizi ti interessano.</p>
            <label className="input-label">
              Descrizione
              <textarea
                name="bio"
                value={form.bio}
                onChange={updateField}
                rows={5}
                placeholder="Presentati in poche righe"
              />
            </label>
          </div>
          {user?.roles?.includes('master') && (
            <div className="account-section">
              <h2>Dati esperti</h2>
              <p className="muted">Informazioni fiscali e personali per l'attività di consulenza.</p>
              <div className="account-form-grid">
                <label className="input-label">
                  Codice fiscale
                  <input
                    name="taxCode"
                    value={form.taxCode}
                    onChange={updateField}
                    placeholder="RSSMRA80A01H501U"
                    maxLength="16"
                  />
                </label>
                <label className="input-label">
                  Partita IVA
                  <input
                    name="vatNumber"
                    value={form.vatNumber}
                    onChange={updateField}
                    placeholder="12345678901"
                    maxLength="11"
                  />
                </label>
                <label className="input-label">
                  Data di nascita
                  <input
                    type="date"
                    name="birthDate"
                    value={form.birthDate}
                    onChange={updateField}
                  />
                </label>
                <label className="input-label">
                  Luogo di nascita
                  <input
                    name="birthPlace"
                    value={form.birthPlace}
                    onChange={updateField}
                    placeholder="Roma (RM)"
                  />
                </label>
                <label className="input-label" data-span="2">
                  Indirizzo
                  <input
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    placeholder="Via Roma 123, 00100 Roma (RM)"
                  />
                </label>
                <label className="input-label">
                  IBAN
                  <input
                    name="iban"
                    value={form.iban}
                    onChange={updateField}
                    placeholder="IT60 X054 2811 1010 0000 0123 456"
                    maxLength="34"
                  />
                </label>
                <label className="input-label">
                  Regime fiscale
                  <FancySelect
                    name="taxRegime"
                    value={form.taxRegime}
                    options={[
                      { value: 'forfettario', label: 'Forfettario' },
                      { value: 'ordinario', label: 'Ordinario' },
                      { value: 'ritenuta_acconto', label: 'Ritenuta d\'acconto' }
                    ]}
                    onChange={updateField}
                  />
                </label>
              </div>
            </div>
          )}
          <div className="account-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Reviews Section */}
      <div className="account-card">
        <div className="account-section">
          <h2>Le tue recensioni</h2>
          <p className="muted">Recensioni ricevute dai master dopo le sessioni.</p>
          
          {reviewsLoading ? (
            <div className="skeleton-list">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-item" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="empty-state">
              <p>Non hai ancora ricevuto recensioni.</p>
              <p className="micro">Le recensioni appariranno qui dopo aver completato delle sessioni.</p>
            </div>
          ) : (
            <div className="reviews-list">
              {reviews.map(review => (
                <div key={review._id} className="review-item">
                  <div className="review-header">
                    <div className="review-rating">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`star ${star <= review.rating ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="review-date">
                      {dayjs(review.createdAt).format('DD MMM YYYY')}
                    </span>
                  </div>
                  {review.text && (
                    <p className="review-text">{review.text}</p>
                  )}
                  <div className="review-meta">
                    <span className="review-channel">
                      Sessione {review.session_id?.channel || 'chat'}
                    </span>
                    <span className="review-author">
                      da {review.reviewer_id?.display_name || 'Master'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
