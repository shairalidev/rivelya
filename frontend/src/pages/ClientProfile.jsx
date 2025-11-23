import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchClientProfile, fetchClientReservations } from '../api/clients.js';
import { getAscendantSign, getZodiacSign } from '../utils/astrology.js';

const statusLabels = {
  awaiting_master: 'Richiesta in attesa',
  ready_to_start: 'Pronta per iniziare',
  reschedule_requested: 'Riprogrammazione richiesta',
  active: 'Sessione in corso'
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clientProfile, setClientProfile] = useState(null);
  const [reservations, setReservations] = useState([]);
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
        const [clientData, clientReservations] = await Promise.all([
          fetchClientProfile(id),
          fetchClientReservations(id)
        ]);
        if (!mounted) return;
        setClientProfile(clientData);
        setReservations(clientReservations || []);
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

  const openRequests = useMemo(
    () => reservations
      .filter(reservation => reservation.customer?.id === id)
      .filter(reservation => ['awaiting_master', 'ready_to_start', 'reschedule_requested', 'active'].includes(reservation.status))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [reservations, id]
  );

  if (loading) {
    return (
      <section className="container account-profile">
        <div className="account-profile__header">
          <p className="eyebrow">Cliente</p>
          <h1>Profilo cliente</h1>
          <p className="muted">Carichiamo i dettagli e le richieste in arrivo…</p>
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
        <p className="muted">Dettagli pubblici e richieste inviate a te come Master.</p>
      </div>

      <div className="account-profile__grid account-profile__grid--balanced">
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
              <p className="micro muted">Le informazioni qui sotto sono pubbliche per i Master.</p>
            </div>
          </div>

          <div className="public-details-grid">
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

          <div className="account-section">
            <h2>Descrizione pubblica</h2>
            <p className="muted">Ciò che vedi è ciò che il cliente ha condiviso con i Master.</p>
            <div className="public-description-box">
              {clientProfile.bio ? (
                <p>{clientProfile.bio}</p>
              ) : (
                <p className="muted">Il cliente non ha ancora aggiunto una descrizione pubblica.</p>
              )}
            </div>
          </div>
        </div>

        <div className="account-card">
          <div className="account-section">
            <h2>Richieste di questo cliente</h2>
            <p className="muted">Consulta le sessioni in arrivo o attive che questo cliente ha prenotato con te.</p>
            {openRequests.length === 0 ? (
              <p className="muted">Nessuna richiesta in arrivo.</p>
            ) : (
              <div className="request-list">
                {openRequests.map(request => (
                  <div key={request.id} className="request-card">
                    <div className="request-card__header">
                      <div className="request-card__who">
                        <div className="request-avatar">
                          {request.customer?.avatar ? (
                            <img src={request.customer.avatar} alt={request.customer?.name || 'Cliente'} />
                          ) : (
                            <span>{(request.customer?.name || 'CL').slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <p className="micro muted">Cliente</p>
                          <p>{request.customer?.name}</p>
                        </div>
                      </div>
                      <Link to={`/masters/${request.master?.id}`} className="badge-soft">
                        Vai al profilo master
                      </Link>
                    </div>
                    <div className="request-card__body">
                      <p><strong>Data:</strong> {new Date(request.date).toLocaleDateString('it-IT')}</p>
                      <p><strong>Orario:</strong> {request.start} - {request.end}</p>
                      <p><strong>Stato:</strong> {statusLabels[request.status] || request.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
