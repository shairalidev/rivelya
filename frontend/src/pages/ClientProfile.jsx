import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchClientProfile } from '../api/clients.js';
import { getAscendantSign, getZodiacSign } from '../utils/astrology.js';

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clientProfile, setClientProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const birthLocation = useMemo(
    () => [clientProfile?.birthPlace, clientProfile?.birthProvince, clientProfile?.birthCountry].filter(Boolean).join(', '),
    [clientProfile?.birthCountry, clientProfile?.birthPlace, clientProfile?.birthProvince]
  );
  const zodiacSign = getZodiacSign(clientProfile?.horoscopeBirthDate);
  const ascendantSign = getAscendantSign(clientProfile?.horoscopeBirthDate, clientProfile?.horoscopeBirthTime, birthLocation);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const clientData = await fetchClientProfile(id);
        if (!mounted) return;
        setClientProfile(clientData);
      } catch (error) {
        if (error?.response?.status === 401) {
          navigate('/login');
          return;
        }
        const message = error?.response?.data?.message || 'Impossibile caricare il profilo cliente.';
        toast.error(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <section className="container account-profile">
        <div className="account-profile__header">
          <p className="eyebrow">Cliente</p>
          <h1>Profilo cliente</h1>
          <p className="muted">Carichiamo i dettagli del profilo…</p>
        </div>
        <div className="account-profile__skeleton" />
      </section>
    );
  }

  if (!clientProfile) {
    return (
      <section className="container account-profile">
        <div className="account-profile__header">
          <h1>Profilo non trovato</h1>
          <p className="muted">Verifica di aver seguito un link valido.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="container account-profile">
      <div className="account-profile__header">
        <p className="eyebrow">Cliente</p>
        <h1>{clientProfile.displayName}</h1>
        <p className="muted">Dettagli pubblici condivisi con i Master.</p>
      </div>

      <div className="account-card account-card--profile">
        <div className="profile-identity">
          <div className="profile-avatar-large">
            {clientProfile.avatarUrl ? (
              <img src={clientProfile.avatarUrl} alt={`Avatar di ${clientProfile.displayName}`} />
            ) : (
              <span>{clientProfile.displayName.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-identity__meta">
            <p className="micro muted">Cliente</p>
            <h2>{clientProfile.displayName}</h2>
            <div className="chip-row">
              <span className="chip ghost">Lingua: {clientProfile.locale || 'non indicata'}</span>
              {zodiacSign && <span className="chip">{`${zodiacSign.icon} ${zodiacSign.name}`}</span>}
              {ascendantSign && <span className="chip soft">{`${ascendantSign.icon} ${ascendantSign.name}`}</span>}
            </div>
            <p className="micro muted">Queste informazioni sono visibili ai Master.</p>
          </div>
        </div>

        <div className="profile-layout">
          <div className="profile-layout__column">
            <div className="account-section">
              <h2>Panoramica</h2>
              <p className="muted">Informazioni essenziali fornite dal cliente.</p>
              <div className="public-details-grid public-details-grid--compact">
                <div className="public-detail">
                  <p className="micro muted">Data di nascita</p>
                  <p className="detail-value">
                    {clientProfile.horoscopeBirthDate
                      ? new Date(clientProfile.horoscopeBirthDate).toLocaleDateString('it-IT')
                      : 'Non indicata'}
                  </p>
                </div>
                <div className="public-detail">
                  <p className="micro muted">Ora di nascita</p>
                  <p className="detail-value">{clientProfile.horoscopeBirthTime || 'Non indicata'}</p>
                </div>
                <div className="public-detail">
                  <p className="micro muted">Luogo di nascita</p>
                  <p className="detail-value">{birthLocation || 'Non indicato'}</p>
                </div>
                <div className="public-detail">
                  <p className="micro muted">Lingua preferita</p>
                  <p className="detail-value">{clientProfile.locale || 'Non indicata'}</p>
                </div>
              </div>
            </div>

            <div className="account-section">
              <h2>Dettagli astrologici</h2>
              <p className="muted">Segni condivisi per creare esperienze più mirate.</p>
              <div className="public-details-grid public-details-grid--compact">
                <div className="public-detail">
                  <p className="micro muted">Segno zodiacale</p>
                  <p className="detail-value">{zodiacSign ? `${zodiacSign.icon} ${zodiacSign.name}` : 'Non disponibile'}</p>
                </div>
                <div className="public-detail">
                  <p className="micro muted">Ascendente</p>
                  <p className="detail-value">{ascendantSign ? `${ascendantSign.icon} ${ascendantSign.name}` : 'Aggiungi ora e luogo di nascita'}</p>
                </div>
                <div className="public-detail">
                  <p className="micro muted">Descrizione pubblica</p>
                  <p className="detail-value">{clientProfile.bio ? 'Presente' : 'Non inserita'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-layout__column profile-layout__column--secondary">
            <div className="account-section profile-description-panel">
              <h2>Descrizione pubblica</h2>
              <p className="muted">Riassunto personale condiviso con i Master.</p>
              <div className="public-description-box profile-description-box">
                {clientProfile.bio ? (
                  <p>{clientProfile.bio}</p>
                ) : (
                  <p className="muted">Il cliente non ha ancora aggiunto una descrizione pubblica.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
