import { useState } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client.js';

const StarIcon = ({ filled, onClick, onHover }) => (
  <button
    type="button"
    className={`star-icon ${filled ? 'filled' : ''}`}
    onClick={onClick}
    onMouseEnter={onHover}
    style={{ 
      cursor: 'pointer', 
      background: 'none', 
      border: 'none', 
      padding: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '24px', height: '24px', pointerEvents: 'none' }}
    >
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  </button>
);

export default function ReviewModal({ isOpen, onClose, bookingId, partnerName, partnerType, onReviewSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Seleziona una valutazione');
      return;
    }

    if (!bookingId) {
      toast.error('Non è possibile inviare una recensione senza prenotazione.');
      return;
    }

    try {
      setIsSubmitting(true);

      await client.post('/reviews/booking', {
        booking_id: bookingId,
        rating,
        text: text.trim()
      });
      
      toast.success('Recensione inviata con successo!');
      if (onReviewSubmitted) onReviewSubmitted();
      onClose();
    } catch (error) {
      const message = error?.response?.data?.message || 'Errore durante l\'invio della recensione';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    toast('Puoi lasciare la recensione più tardi nella sezione Prenotazioni.');
    onClose();
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content review-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Valuta la sessione</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="review-header">
            <h3>Come è stata la tua esperienza?</h3>
            <p className="review-prompt">
              La tua opinione aiuta altri utenti a scegliere <strong>{partnerName}</strong>
            </p>
          </div>
          
          <div className="rating-section">
            <label className="rating-label">Valutazione complessiva</label>
            <div 
              className="stars-container"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map(star => (
                <StarIcon
                  key={star}
                  filled={star <= displayRating}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRating(star);
                  }}
                  onHover={() => setHoverRating(star)}
                />
              ))}
            </div>
           
          </div>

          <div className="review-text-section">
            <label htmlFor="review-text" className="input-label">
              Racconta la tua esperienza (opzionale)
            </label>
            <textarea
              id="review-text"
              className="review-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Cosa ti è piaciuto di più della consulenza con ${partnerName}? Come ti ha aiutato?`}
              rows={4}
              maxLength={1000}
              disabled={isSubmitting}
            />
            <div className="char-count">{text.length}/1000 caratteri</div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn secondary" 
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Salta
          </button>
          <button 
            className="btn primary" 
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? 'Invio...' : 'Invia recensione'}
          </button>
        </div>
      </div>
    </div>
  );
}