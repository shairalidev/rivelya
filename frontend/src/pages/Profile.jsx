import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchProfile, updateProfile, uploadAvatar, removeAvatar } from '../api/profile.js';
import FancySelect from '../components/FancySelect.jsx';
import { getToken, notifyAuthChange, setUser as storeUser } from '../lib/auth.js';
import client from '../api/client.js';
import { getAscendantSign, getZodiacSign } from '../utils/astrology.js';

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

  birthPlace: '',
  birthProvince: '',
  birthCountry: '',
  address: '',
  zipCode: '',
  city: '',
  province: '',
  country: '',
  iban: '',
  taxRegime: 'forfettario',
  horoscopeBirthDate: '',
  horoscopeBirthTime: ''
};

const localeOptions = [
  { value: 'it-IT', label: 'Italiano' },
  { value: 'en-GB', label: 'English' },
  { value: 'es-ES', label: 'Espanol' }
];

export default function Profile() {
  const [form, setForm] = useState(initialForm);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
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

          birthPlace: profile.birthPlace || '',
          birthProvince: profile.birthProvince || '',
          birthCountry: profile.birthCountry || '',
          address: profile.address || '',
          zipCode: profile.zipCode || '',
          city: profile.city || '',
          province: profile.province || '',
          country: profile.country || '',
          iban: profile.iban || '',
          taxRegime: profile.taxRegime || 'forfettario',
          horoscopeBirthDate: profile.horoscopeBirthDate ? new Date(profile.horoscopeBirthDate).toISOString().split('T')[0] : '',
          horoscopeBirthTime: profile.horoscopeBirthTime || ''
        });
        // Load user reviews only for masters
        loadReviews(profile.user_id);
      })
      .catch(err => {
        if (err?.response?.status === 401) {
          toast.error("La sessione e' scaduta. Accedi nuovamente.");
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
      // Reviews for a master are written by clients, request reviewer_type=client
      const response = await client.get(`/reviews/user/${userId}?reviewer_type=client`);
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
      toast.error('L immagine deve essere inferiore a 5MB.');
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
      toast.error('Impossibile rimuovere l immagine.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const birthLocation = [form.birthPlace, form.birthProvince, form.birthCountry].filter(Boolean).join(', ');
  const zodiacSign = getZodiacSign(form.horoscopeBirthDate);
  const ascendantSign = getAscendantSign(form.horoscopeBirthDate, form.horoscopeBirthTime, birthLocation);
  const isMaster = Boolean(user?.roles?.includes('master'));

  if (loading) {
    return (
      <section className="container account-profile">
        <div className="account-profile__header">
          <p className="eyebrow">Profilo</p>
          <h1>Gestione profilo</h1>
          <p className="muted">Carichiamo le tue informazioni...</p>
        </div>
        <div className="account-profile__skeleton" />
      </section>
    );
  }

  return (
    <section className="container account-profile">
      <div className="account-profile__header">
        <p className="eyebrow">Profilo</p>
        <h1>La tua identita su Rivelya</h1>
        <p className="muted">Gestisci i tuoi dati personali e fiscali. Le informazioni pubbliche (foto, nome e biografia) si modificano dall'Area Master.</p>
      </div>
      <div className="account-profile__grid account-profile__grid--stacked">
        <div className="account-card account-card--compact">
          <div className="account-avatar">
            <div className="account-avatar-preview">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar utente" />
              ) : (
                <span>{(user?.displayName || user?.email || 'RV').slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            {isMaster ? (
              <p className="micro muted">La foto profilo pubblica si aggiorna solo dall'Area Master.</p>
            ) : (
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
                {avatarLoading && <p className="muted">Aggiornamento in corso...</p>}
                <p className="micro muted">Questa immagine sara visibile pubblicamente.</p>
              </div>
            )}
          </div>
          <div className="account-meta">
            <p className="account-meta-name">{user?.displayName || 'Profilo Rivelya'}</p>
            <div className="public-summary">
              <div className="public-summary__row">
                <span>Segno zodiacale</span>
                <strong>{zodiacSign ? `${zodiacSign.icon} ${zodiacSign.name}` : 'Inserisci la data di nascita'}</strong>
              </div>
              <div className="public-summary__row">
                <span>Ascendente</span>
                <strong>{ascendantSign ? `${ascendantSign.icon} ${ascendantSign.name}` : 'Aggiungi ora e luogo di nascita'}</strong>
              </div>
              <div className="public-summary__row">
                <span>Data di nascita</span>
                <strong>{form.horoscopeBirthDate ? new Date(form.horoscopeBirthDate).toLocaleDateString('it-IT') : 'Non indicata'}</strong>
              </div>
              <div className="public-summary__row">
                <span>Ora di nascita</span>
                <strong>{form.horoscopeBirthTime || 'Non indicata'}</strong>
              </div>
              <div className="public-summary__row">
                <span>Luogo di nascita</span>
                <strong>{birthLocation || 'Non indicato'}</strong>
              </div>
              {!isMaster && (
                <>
                  <div className="public-summary__row">
                    <span>Descrizione pubblica</span>
                    <strong>{form.bio ? 'Presente' : 'Non ancora inserita'}</strong>
                  </div>
                  <div className="public-summary__row">
                    <span>Lingua</span>
                    <strong>{localeOptions.find(option => option.value === form.locale)?.label || 'Non impostata'}</strong>
                  </div>
                </>
              )}
            </div>
            <p className="muted">{user?.email}</p>
            <span className={`account-status${user?.isEmailVerified ? ' success' : ''}`}>
              {user?.isEmailVerified ? 'Email verificata' : 'Email non verificata'}
            </span>
          </div>
        </div>
        <form className="account-card" onSubmit={submit}>
          {isMaster ? (
            <div className="account-section">
              <h2>Informazioni pubbliche</h2>
              <p className="muted">Foto, nome pubblico e biografia si gestiscono esclusivamente dall'Area Master.</p>
            </div>
          ) : (
            <div className="account-section">
              <h2>Profilo pubblico</h2>
              <p className="muted">Informazioni visibili agli esperti: foto profilo, descrizione e lingua.</p>
              <div className="account-form-grid">
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
              <label className="input-label">
                Descrizione pubblica (opzionale)
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={updateField}
                  rows={5}
                  placeholder="Presentati in poche righe"
                />
              </label>
              <div className="account-form-grid">
                <label className="input-label">
                  Lingua
                  <FancySelect name="locale" value={form.locale} options={localeOptions} onChange={updateField} />
                </label>
              </div>
            </div>
          )}
          <div className="account-section">
            <h2>Dettagli personali (non pubblici)</h2>
            <p className="muted">Usati internamente per documenti, ricevute e verifica identita.</p>
            <div className="account-form-grid">
              <label className="input-label">
                Nome
                <input name="firstName" value={form.firstName} onChange={updateField} placeholder="Nome" />
              </label>
              <label className="input-label">
                Cognome
                <input name="lastName" value={form.lastName} onChange={updateField} placeholder="Cognome" />
              </label>
              <label className="input-label">
                Data di nascita
                <input
                  type="date"
                  name="horoscopeBirthDate"
                  value={form.horoscopeBirthDate}
                  onChange={updateField}
                />
              </label>
              <label className="input-label">
                Ora di nascita
                <input
                  type="time"
                  name="horoscopeBirthTime"
                  value={form.horoscopeBirthTime}
                  onChange={updateField}
                  placeholder="Se non ricordi, lascia vuoto"
                />
              </label>
              <label className="input-label">
                Luogo di nascita
                <input
                  name="birthPlace"
                  value={form.birthPlace}
                  onChange={updateField}
                  placeholder="Roma"
                />
              </label>
              <label className="input-label">
                Provincia di nascita
                <input
                  name="birthProvince"
                  value={form.birthProvince}
                  onChange={updateField}
                  placeholder="RM"
                />
              </label>
              <label className="input-label">
                Paese di nascita
                <input
                  name="birthCountry"
                  value={form.birthCountry}
                  onChange={updateField}
                  placeholder="Italia"
                />
              </label>
              <label className="input-label" data-span="2">
                Indirizzo di residenza
                <input
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  placeholder="Via Roma 123"
                />
              </label>
              <label className="input-label">
                CAP
                <input
                  name="zipCode"
                  value={form.zipCode}
                  onChange={updateField}
                  placeholder="00100"
                />
              </label>
              <label className="input-label">
                Citta
                <input
                  name="city"
                  value={form.city}
                  onChange={updateField}
                  placeholder="Roma"
                />
              </label>
              <label className="input-label">
                Provincia
                <input
                  name="province"
                  value={form.province}
                  onChange={updateField}
                  placeholder="RM"
                />
              </label>
              <label className="input-label">
                Paese
                <input
                  name="country"
                  value={form.country}
                  onChange={updateField}
                  placeholder="Italia"
                />
              </label>
            </div>
          </div>
          <div className="account-section">
            <h2>Dettagli di contatto</h2>
            <p className="muted">Non pubblici: aggiornali per supporto e fatturazione.</p>
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
                Localita di riferimento
                <input
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  placeholder="Milano, Italia"
                />
              </label>
            </div>
          </div>
          {user?.roles?.includes('master') && (
            <div className="account-section">
              <h2>Dati esperti</h2>
              <p className="muted">Informazioni fiscali dedicate alla tua attivita professionale.</p>
              <div className="account-form-grid">
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
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
