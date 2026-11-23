import { useEffect, useMemo, useState } from 'react';
import { Icon } from './shared.jsx';
import { actions, useStore } from './store.js';
import { useToast } from './ui.jsx';

/* Reviews, ratings and wishlist hearts shared across product, orders and service pages. */

export const Stars = ({ value, label = true }) => (
  <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map((i) => (
      <span key={i} className={i < Math.round(value) ? 'on' : ''}>
        <Icon name="star" size={14} />
      </span>
    ))}
    {label && <b>{Number(value).toFixed(1)}</b>}
  </span>
);

export const Avatar = ({ name }) => (
  <span className="avatar" aria-hidden="true">
    {name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')}
  </span>
);

export function HeartButton({ id, name }) {
  const saved = useStore((s) => s.wishlist.includes(id));
  const toast = useToast();
  return (
    <button
      type="button"
      className={`heart${saved ? ' is-on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved items` : `Save ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        actions.toggleWishlist(id).catch((err) => toast(err.message, { tone: 'error' }));
        toast(saved ? 'Removed from saved items' : 'Saved for later');
      }}
    >
      <Icon name="heart" size={18} />
    </button>
  );
}

export function useReviews(kind, target) {
  const real = useStore((s) => s.reviewsByKey[`${kind}:${target}`]);
  useEffect(() => {
    actions.loadReviews(kind, target).catch(() => {});
  }, [kind, target]);
  return [...(real || [])].sort((a, b) => b.at - a.at);
}

export function ReviewForm({ kind, target, label, bookingId, onDone }) {
  const user = useStore((s) => s.user);
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="review-auth-gate">
        <p className="muted">
          <a className="text-link" href={`/login?redirect=${kind === 'product' ? 'shop' : 'orders'}`}>
            Sign in
          </a>{' '}
          to leave a verified review.
        </p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast('Pick a star rating first', { tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await actions.addReview({ kind, target, bookingId, rating, text: text.trim() });
      toast('Thanks for your review', { tone: 'success' });
      setRating(0);
      setText('');
      onDone?.();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="review-form modern" onSubmit={submit}>
      <fieldset>
        <legend>{label || 'Your rating'}</legend>
        <div className="rate" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={n <= rating ? 'on' : ''}
              onClick={() => setRating(n)}
            >
              <Icon name="star" size={24} />
            </button>
          ))}
          {rating > 0 && <span className="rate-val">{rating}.0 / 5</span>}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`rv-${kind}-${target}`}>Written feedback (optional)</label>
        <textarea
          id={`rv-${kind}-${target}`}
          rows="3"
          maxLength={500}
          placeholder="What did you like or what could be improved?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <button className="pill pill-small" type="submit" disabled={busy || !rating}>
        {busy ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}

function formatAgo(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function Reviews({ kind, target, form = true }) {
  const list = useReviews(kind, target);
  const [filter, setFilter] = useState('all');

  const avg = list.length ? list.reduce((n, r) => n + r.rating, 0) / list.length : 0;
  const count5 = list.filter((r) => r.rating === 5).length;
  const count4 = list.filter((r) => r.rating === 4).length;
  const satPct = list.length ? Math.round(((count5 + count4) / list.length) * 100) : 0;

  const visible = useMemo(() => {
    if (filter === '5') return list.filter((r) => r.rating === 5);
    if (filter === '4') return list.filter((r) => r.rating === 4);
    if (filter === 'low') return list.filter((r) => r.rating <= 3);
    if (filter === 'notes') return list.filter((r) => !!r.text?.trim());
    return list;
  }, [list, filter]);

  return (
    <section className="reviews modern-reviews" aria-labelledby={`rv-h-${kind}-${target}`}>
      <div className="rv-header">
        <div>
          <h2 className="h2" id={`rv-h-${kind}-${target}`}>
            Customer reviews
          </h2>
          <p className="rv-sub">Real ratings and verified feedback from genuine bookings.</p>
        </div>
      </div>

      {list.length > 0 ? (
        <div className="rv-hero-card">
          <div className="rv-hero-score">
            <span className="rv-big-num">{avg.toFixed(1)}</span>
            <div className="rv-stars-group">
              <Stars value={avg} label={false} />
              <span className="rv-count-tag">
                {list.length} review{list.length > 1 ? 's' : ''}
              </span>
            </div>
            {satPct > 0 && <span className="rv-sat-pill">{satPct}% satisfaction rate</span>}
          </div>

          <div className="rv-breakdown">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = list.filter((r) => r.rating === stars).length;
              const pct = list.length ? Math.round((count / list.length) * 100) : 0;
              return (
                <div key={stars} className="rv-bar-row">
                  <span className="rv-bar-label">{stars} ★</span>
                  <div className="rv-bar-track">
                    <div className="rv-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="rv-bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rv-empty-state">
          <p className="muted">No reviews yet. Be the first to share your experience.</p>
        </div>
      )}

      {list.length > 1 && (
        <div className="rv-filters" role="group" aria-label="Filter reviews">
          <button
            type="button"
            className={`chip chip-sm${filter === 'all' ? ' is-on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({list.length})
          </button>
          <button
            type="button"
            className={`chip chip-sm${filter === '5' ? ' is-on' : ''}`}
            onClick={() => setFilter('5')}
          >
            5 ★ ({count5})
          </button>
          <button
            type="button"
            className={`chip chip-sm${filter === '4' ? ' is-on' : ''}`}
            onClick={() => setFilter('4')}
          >
            4 ★ ({count4})
          </button>
          {list.some((r) => r.text) && (
            <button
              type="button"
              className={`chip chip-sm${filter === 'notes' ? ' is-on' : ''}`}
              onClick={() => setFilter('notes')}
            >
              With comments
            </button>
          )}
        </div>
      )}

      <ul className="rv-list modern-list">
        {visible.map((r) => (
          <li key={r.id} className="rv-card">
            <div className="rv-card-head">
              <Avatar name={r.name} />
              <div className="rv-user-meta">
                <div className="rv-user-row">
                  <b className="rv-name">{r.name}</b>
                  <span className="rv-verified-pill">Verified</span>
                </div>
                {r.at && <span className="rv-time">{formatAgo(r.at)}</span>}
              </div>
              <div className="rv-star-pill">
                <Stars value={r.rating} label={false} />
                <span className="rv-num">{r.rating}.0</span>
              </div>
            </div>
            {r.text && <p className="rv-comment">{r.text}</p>}
          </li>
        ))}
      </ul>


      {form && <ReviewForm kind={kind} target={target} />}
    </section>
  );
}
