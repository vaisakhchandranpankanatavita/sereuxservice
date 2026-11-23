import React, { useEffect, useRef, useState } from 'react';
import { googleLogin, redirectTarget } from './auth.js';

/* "Continue with Google" via Google Identity Services. Renders nothing unless VITE_GOOGLE_CLIENT_ID is set. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let loading;
const loadGsi = () => loading ||= new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = resolve; s.onerror = () => { loading = null; reject(new Error('gsi')); };
  document.head.appendChild(s);
});

export function GoogleButton() {
  const box = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!CLIENT_ID) return;
    let dead = false;
    loadGsi().then(() => {
      if (dead || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          const msg = await googleLogin(credential);
          if (msg) setError(msg); else window.location.assign(redirectTarget());
        },
      });
      window.google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
        width: Math.min(400, Math.max(200, box.current.parentElement.clientWidth)),
      });
    }).catch(() => setError('Google sign-in is unavailable right now.'));
    return () => { dead = true; };
  }, []);
  if (!CLIENT_ID) return null;
  return (
    <div className="google-auth">
      <div ref={box} className="google-btn" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="or-divider"><span>or</span></div>
    </div>
  );
}
