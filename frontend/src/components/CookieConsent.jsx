import { useState } from 'react';
import { api } from '../api';

const defaults = { necessary: true, analytics: false, functional: false, marketing: false };
const labels = { necessary: 'Estritamente necessarios', analytics: 'Analiticos e desempenho', functional: 'Funcionalidade', marketing: 'Marketing e publicidade' };

export default function CookieConsent({ user }) {
  const [preferences, setPreferences] = useState(() => { try { return JSON.parse(localStorage.getItem('noway_cookie_preferences')) || defaults; } catch { return defaults; } });
  const [open, setOpen] = useState(() => !localStorage.getItem('noway_cookie_preferences'));
  const save = async (next) => { setPreferences(next); localStorage.setItem('noway_cookie_preferences', JSON.stringify(next)); try { await api.saveConsent(next, user?.id); } catch {} setOpen(false); };
  return <>{open && <section className="cookie-banner" aria-label="Preferencias de cookies"><div><strong>Sua privacidade</strong><p>Usamos cookies necessarios para seguranca e carrinho. Os opcionais so sao ativados com sua permissao.</p><a href="#privacidade">Privacidade</a> <a href="#cookies">Cookies</a></div><div className="cookie-actions"><button onClick={() => save({ necessary: true, analytics: true, functional: true, marketing: true })}>Aceitar todos</button><button onClick={() => save(defaults)}>Rejeitar opcionais</button></div><div className="cookie-options">{Object.entries(preferences).map(([key, value]) => <label key={key}><input type="checkbox" checked={value} disabled={key === 'necessary'} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} /> {labels[key]}</label>)}<button className="secondary" onClick={() => save(preferences)}>Salvar preferencias</button></div></section>}{!open && <button className="cookie-manage" onClick={() => setOpen(true)}>Cookies</button>}</>;
}