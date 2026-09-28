import { useEffect, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import LoginGate from './components/LoginGate';
import AccountPanel from './components/AccountPanel';
import AdminPanel from './components/AdminPanel';
import CookieConsent from './components/CookieConsent';
import { api } from './api';
import logoSquare from './assets/logo-square.png';

export default function App() {
  const [user, setUser] = useState(undefined); const [products, setProducts] = useState([]); const [cartOpen, setCartOpen] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => { api.getMe().then(({ user: current }) => setUser(current)).catch(() => setUser(null)); api.getProducts().then(({ products: data }) => setProducts(data)).catch(() => setProducts([])); }, []);
  if (user === undefined) return null;
  if (!user) return <><LoginGate onLoggedIn={setUser} /><CookieConsent user={null} /></>;
  const byCategory = (category) => products.filter((product) => product.category === category);
  return <><Header user={user} onLogout={async () => { await api.logout(); setUser(null); }} onOpenCart={() => setCartOpen(true)} onOpenAccount={() => setAccountOpen(true)} onOpenAdmin={() => setAdminOpen(true)} /><Hero /><main><ProductGrid title="Scripts" products={byCategory('scripts')} /><ProductGrid title="Bases completas" products={byCategory('bases')} /><ProductGrid title="Bots e sites" products={byCategory('bots')} /></main><footer className="site-footer"><img src={logoSquare} alt="NoWay" /><span id="privacidade"><a href="/privacy.html">Privacidade</a> <a href="/cookies.html">Cookies</a> <a href="/terms.html">Termos e reembolso</a><span>Encarregado de dados: ad4763048@gmail.com.</span></span></footer><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} products={products} /><AccountPanel open={accountOpen} onClose={() => setAccountOpen(false)} /><AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} /><CookieConsent user={user} /></>;
}