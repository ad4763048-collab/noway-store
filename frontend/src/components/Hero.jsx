import logoWide from '../assets/logo-wide.png';

export default function Hero() {
  return (
    <div className="hero">
      <img className="hero-logo" src={logoWide} alt="NoWay" />
      <p>Scripts, bases completas, bots e sites prontos para o seu servidor FiveM. Entrega automática e suporte incluso.</p>
      <div className="tags">
        <span>ESX / QBCore</span>
        <span>Suporte incluso</span>
        <span>Entrega automática</span>
      </div>
    </div>
  );
}
