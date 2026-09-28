import { useEffect, useRef } from 'react';

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function Turnstile({ onVerify }) {
  const container = useRef(null);

  useEffect(() => {
    if (!siteKey || !container.current) return undefined;
    const render = () => {
      if (container.current?.childElementCount === 0) {
        window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': () => onVerify(''),
          'error-callback': () => onVerify(''),
          theme: 'dark',
        });
      }
    };
    const existing = document.getElementById('turnstile-script');
    if (window.turnstile) render();
    else if (existing) existing.addEventListener('load', render, { once: true });
    else {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', render, { once: true });
      document.head.appendChild(script);
    }
    return () => existing?.removeEventListener('load', render);
  }, [onVerify]);

  return siteKey ? <div className="turnstile" ref={container} /> : null;
}
