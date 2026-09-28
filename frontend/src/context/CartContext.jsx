import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState({}); // { [productId]: qty }

  const add = (id) => setItems((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const changeQty = (id, delta) =>
    setItems((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) + delta };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  const clear = () => setItems({});

  const count = useMemo(() => Object.values(items).reduce((a, b) => a + b, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, changeQty, clear, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
