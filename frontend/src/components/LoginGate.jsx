import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import logoSquare from '../assets/logo-square.png';
import { api } from '../api';

export default function LoginGate({ onLoggedIn }) {
  const [error, setError] = useState('');

  const handleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const { user } = await api.loginWithGoogle(credentialResponse.credential);
      onLoggedIn(user);
    } catch (err) {
      setError('Não foi possível confirmar seu login. Tente novamente.');
    }
  };

  return (
    <div className="login-gate">
      <div className="login-card">
        <img src={logoSquare} alt="NoWay" />
        <h2>Entrar na NoWay</h2>
        <p>Acesse com sua conta Google para ver e comprar os recursos.</p>
        <div className="google-btn-wrap">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError('Login com Google falhou.')}
            theme="filled_black"
            shape="pill"
            text="continue_with"
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="login-note">
          O login usa o OAuth oficial do Google — sua senha nunca passa pela NoWay.
        </div>
      </div>
    </div>
  );
}
