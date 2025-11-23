import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import client from '../api/client.js';
import Avatar from './Avatar.jsx';

const StarRating = ({ rating, size = 'medium' }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span 
        key={i} 
        className={`review-star ${i <= rating ? 'filled' : ''}`}
        style={{ fontSize: size === 'small' ? '0.9rem' : '1rem' }}
      >
        ★
      </span>
    );
  }
  return <div className="review-stars">{stars}</div>;
};

export default function ReviewsList({ masterId, masterUserId, limit = 10 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const resolveUserId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value._id || value.id || value.user_id || '';
    return '';
  };

  const resolveProfilePath = (value) => {
    const id = resolveUserId(value);
    return id ? `/clients/${id}` : '';
  };

  useEffect(() => {
    const loadReviews = async () => {
      const targetId = resolveUserId(masterUserId) || resolveUserId(masterId);
      if (!targetId) return;

      try {
        setLoading(true);
        // Always use user_id based endpoint since reviews are linked to user_id
        const res = await client.get(`/reviews/user/${targetId}?reviewer_type=client&limit=${limit}`);
        setReviews(res.data.reviews || []);
      } catch (err) {
        console.warn('Failed to load reviews:', err);
        setError('Impossibile caricare le recensioni');
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [masterId, masterUserId, limit]);

  if (loading) {
    return (
      <div className="reviews-loading">
        <p>Caricamento recensioni...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reviews-empty">
        <p>{error}</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="reviews-empty">
        <p>Questo esperti non ha ancora ricevuto recensioni dai clienti.</p>
      </div>
    );
  }

  return (
    <div className="reviews-list">
      {reviews.map(review => (
        <div key={review._id} className="review-item-enhanced">
          <div className="review-item-header">
            <div className="review-author-section">
              {resolveProfilePath(review.reviewer_id) ? (
                <Link
                  to={resolveProfilePath(review.reviewer_id)}
                  className="avatar-link"
                  aria-label={`Apri il profilo di ${review.reviewer_id?.display_name || 'Cliente Rivelya'}`}
                >
                  <Avatar
                    src={review.reviewer_id?.avatar_url}
                    name={review.reviewer_id?.display_name || 'Cliente'}
                    size="small"
                  />
                </Link>
              ) : (
                <Avatar
                  src={review.reviewer_id?.avatar_url}
                  name={review.reviewer_id?.display_name || 'Cliente'}
                  size="small"
                />
              )}
              <div className="review-author-details">
                {resolveProfilePath(review.reviewer_id) ? (
                  <Link to={resolveProfilePath(review.reviewer_id)} className="review-author-name">
                    {review.reviewer_id?.display_name || 'Cliente Rivelya'}
                  </Link>
                ) : (
                  <p className="review-author-name">
                    {review.reviewer_id?.display_name || 'Cliente Rivelya'}
                  </p>
                )}
                <p className="review-date-text">
                  {dayjs(review.createdAt).format('DD MMM YYYY')}
                </p>
              </div>
            </div>
            <StarRating rating={review.rating} size="small" />
          </div>
          {review.text && (
            <p className="review-content">{review.text}</p>
          )}
          {review.reply && (
            <div className="review-reply">
              <div className="review-reply-header">
                <span className="review-reply-label">Risposta del consulente</span>
                <span className="review-reply-date">
                  {dayjs(review.reply.createdAt).format('DD MMM YYYY')}
                </span>
              </div>
              <p className="review-reply-content">{review.reply.text}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}