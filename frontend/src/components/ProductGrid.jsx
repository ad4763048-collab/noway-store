import { useState } from 'react';
import { useCart } from '../context/CartContext';

function money(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductCard({ product }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    add(product.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="card">
      <div className="top">
        <h3>{product.name}</h3>
        <span className="kind">{product.tag}</span>
      </div>
      <p className="desc">{product.desc}</p>
      <div className="badge">{product.badge || ''}</div>
      <div className="bottom">
        <div className="price">
          {product.oldPrice && <span className="old">{money(product.oldPrice)}</span>}
          {money(product.price)}
        </div>
        <button className={`add-btn${justAdded ? ' added' : ''}`} onClick={handleAdd}>
          {justAdded ? 'Adicionado ✓' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}

export default function ProductGrid({ title, products }) {
  if (!products.length) return null;
  return (
    <>
      <div className="section-title"><h2>{title}</h2></div>
      <div className="grid">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </>
  );
}
