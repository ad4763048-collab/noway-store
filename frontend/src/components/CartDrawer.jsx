import { useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import Turnstile from './Turnstile';

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CartDrawer({ open, onClose, products }) {
  const { items, changeQty, clear } = useCart();
  const [status, setStatus] = useState(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const checkoutKey = useRef(crypto.randomUUID());
  const ids = Object.keys(items);
  const lines = ids.map((id) => ({ product: products.find((p) => p.id === id), qty: items[id] })).filter((line) => line.product);
  const total = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  const handleCheckout = async () => {
    setStatus('loading');
    try {
      const { checkoutUrl } = await api.checkout(lines.map(({ product, qty }) => ({ id: product.id, qty })), captchaToken, checkoutKey.current, couponCode.trim().toUpperCase() || undefined);
      clear();
      window.location.assign(checkoutUrl);
    } catch {
      setStatus('error');
      setCaptchaToken('');
      setTurnstileKey((key) => key + 1);
    }
  };

  return <>
    <div className={`overlay${open ? ' open' : ''}`} onClick={onClose} />
    <aside className={`drawer${open ? ' open' : ''}`} aria-label="Carrinho">
      <div className="drawer-head"><h3>Seu carrinho</h3><button className="close-btn" aria-label="Fechar" onClick={onClose}>x</button></div>
      <div className="drawer-body">{lines.length === 0 ? <div className="empty-cart">Seu carrinho esta vazio.</div> : lines.map(({ product, qty }) => <div className="cart-item" key={product.id}><div><div className="name">{product.name}</div><div className="qty-row"><button aria-label="Diminuir" onClick={() => changeQty(product.id, -1)}>-</button><span>{qty}</span><button aria-label="Aumentar" onClick={() => changeQty(product.id, 1)}>+</button></div></div><div>{money(product.price * qty)}</div></div>)}</div>
      <div className="drawer-foot"><Turnstile key={turnstileKey} onVerify={setCaptchaToken} /><input className="coupon-input" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Cupom de desconto" maxLength="32" /><div className="total-row"><span>Total</span><strong>{money(total)}</strong></div><button className="checkout-btn" disabled={!lines.length || status === 'loading' || (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken)} onClick={handleCheckout}>{status === 'loading' ? 'Preparando pagamento...' : 'Ir para pagamento'}</button>{status === 'error' && <div className="login-error">Nao foi possivel iniciar o pagamento. Tente novamente.</div>}<div className="note">Os dados de pagamento sao processados pelo Mercado Pago.</div></div>
    </aside>
  </>;
}