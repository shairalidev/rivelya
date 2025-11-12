import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import client from '../api/client.js';

const scriptId = 'google-identity-services';

export default function GoogleLoginButton({ onSuccess }) {
  const buttonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const initialize = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async response => {
          try {
            const res = await client.post('/auth/google', { credential: response.credential });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            toast.success('Accesso con Google riuscito!');
            window.dispatchEvent(new Event('rivelya-auth-change'));
            onSuccess?.();
          } catch (error) {
            const message = error?.response?.data?.message || 'Impossibile completare l\'accesso con Google.';
            toast.error(message);
          }
        },
        auto_select: false
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 320
      });
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.id = scriptId;
      script.onload = initialize;
      document.head.appendChild(script);
    } else {
      initialize();
    }

    return () => {
      // no-op cleanup, button destroyed with component
    };
  }, [clientId, onSuccess]);

  if (!clientId) {
    return (
      <button type="button" className="btn outline" disabled>
        Configura Google Client ID
      </button>
    );
  }

  return <div ref={buttonRef} className="google-signin" />;
}

GoogleLoginButton.propTypes = {
  onSuccess: PropTypes.func
};
