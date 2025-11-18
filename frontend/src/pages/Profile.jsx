import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchProfile, updateProfile, uploadAvatar, removeAvatar } from '../api/profile.js';
import FancySelect from '../components/FancySelect.jsx';
import { getToken, notifyAuthChange, setUser as storeUser } from '../lib/auth.js';

const initialForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  phone: '',
  locale: 'it-IT',
  bio: '',
  location: ''
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
          location: profile.location || ''
        });
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
          <div className="account-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
