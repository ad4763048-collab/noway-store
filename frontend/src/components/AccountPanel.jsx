import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AccountPanel({ open, onClose }) {
  const [orders, setOrders] = useState([]); const [downloads, setDownloads] = useState({});
  useEffect(() => { if (open) api.getOrders().then(({ orders: data }) => setOrders(data)).catch(() => setOrders([])); }, [open]);
  const loadDownloads = async (orderId) => { try { const { downloads: files } = await api.getDownloads(orderId); setDownloads((current) => ({ ...current, [orderId]: files })); } catch { setDownloads((current) => ({ ...current, [orderId]: [] })); } };
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="panel" onMouseDown={(event) => event.stopPropagation()}><button className="close-btn" aria-label="Fechar" onClick={onClose}>x</button><h2>Meus pedidos</h2>{orders.length ? orders.map((order) => <article className="order-row" key={order.id}><strong>#{order.id.slice(0, 8)}</strong><span>{order.status === 'paid' ? 'Pagamento aprovado' : order.status === 'failed' ? 'Pagamento recusado' : 'Aguardando pagamento'}</span><span>R$ {Number(order.total).toFixed(2)}</span>{order.status === 'paid' && <span className="downloads">{downloads[order.id] ? downloads[order.id].length ? downloads[order.id].map((file) => <a key={file.url} href={file.url}>Baixar {file.name}</a>) : 'Arquivos ainda nao cadastrados.' : <button className="secondary" onClick={() => loadDownloads(order.id)}>Ver downloads</button>}</span>}</article>) : <p>Nenhum pedido encontrado.</p>}</section></div>;
}