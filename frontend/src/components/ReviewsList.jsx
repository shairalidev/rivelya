import { useState, useEffect } from 'react';
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

export default function ReviewsList({ masterUserId, limit = 10 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReviews = async () => {
      if (!masterUserId) return;
      
      try {
        setLoading(true);
        const res = await client.get(`/review/user/${masterUserId}?reviewer_type=client&limit=${limit}`);
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
  }, [masterUserId, limit]);

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
              <Avatar 
                src={review.reviewer_id?.avatar_url} 
                name={review.reviewer_id?.display_name || 'Cliente'}
                size="small"
              />
              <div className="review-author-details">
                <p className="review-author-name">
                  {review.reviewer_id?.display_name || 'Cliente Rivelya'}
                </p>
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
        </div>
      ))}
    </div>
  );
}