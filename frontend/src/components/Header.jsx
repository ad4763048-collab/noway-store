import logoSquare from '../assets/logo-square.png';
import { useCart } from '../context/CartContext';

export default function Header({ user, onLogout, onOpenCart, onOpenAccount, onOpenAdmin }) {
  const { count } = useCart();
  const canOpenAdmin = user.permissions?.includes('admin.access');
  return <header className="site-header"><div className="brand"><img src={logoSquare} alt="NoWay" /></div><div className="header-right"><div className="user-chip"><img src={user.picture} alt={user.name} referrerPolicy="no-referrer" /><span>{user.name?.split(' ')[0]}</span><button className="logout-btn" onClick={onOpenAccount}>Pedidos</button>{canOpenAdmin && <button className="logout-btn" onClick={onOpenAdmin}>Admin</button>}<button className="logout-btn" onClick={onLogout}>Sair</button></div><button className="cart-btn" onClick={onOpenCart}>Carrinho <span className="cart-count">{count}</span></button></div></header>;
}