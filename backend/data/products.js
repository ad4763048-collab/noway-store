// "Banco de dados" em memória, só para demonstração.
// Troque por um banco de verdade (Postgres, MongoDB, SQLite...) em produção.

let products = [
  { id: 'sc1', category: 'scripts', name: 'Sistema de Facções v3', desc: 'Territórios, guerra de gangues e recompensas configuráveis.', price: 39.9, oldPrice: 49.9, tag: 'ESX/QB', badge: 'Atualizado' },
  { id: 'sc2', category: 'scripts', name: 'Garagem Avançada', desc: 'Múltiplas garagens, seguro de veículos e reboque automático.', price: 24.9, tag: 'QBCore', badge: 'Popular' },
  { id: 'sc3', category: 'scripts', name: 'HUD Minimalista', desc: 'Interface leve com fome, sede, stamina e dinheiro em tempo real.', price: 14.9, tag: 'Standalone', badge: 'Leve' },
  { id: 'sc4', category: 'scripts', name: 'Sistema de Empregos', desc: '6 empregos prontos: entregador, mecânico, taxista e mais.', price: 29.9, tag: 'ESX', badge: '' },
  { id: 'bs1', category: 'bases', name: 'Base RP Completa — Cidade X', desc: 'Mapa customizado, economia balanceada e 20+ scripts inclusos.', price: 149.9, oldPrice: 199.9, tag: 'QBCore', badge: 'Mais vendida' },
  { id: 'bs2', category: 'bases', name: 'Base Econômica Starter', desc: 'Ideal para começar um servidor com poucos recursos, leve e estável.', price: 79.9, tag: 'ESX', badge: '' },
  { id: 'bt1', category: 'bots', name: 'Bot de Whitelist Discord', desc: 'Formulário automático, aprovação por staff e cargo automático.', price: 19.9, tag: 'Discord.js', badge: '' },
  { id: 'bt2', category: 'bots', name: 'Site de Loja Integrado', desc: 'Loja web com login Discord e entrega automática de pacotes.', price: 59.9, tag: 'Node + React', badge: 'Novo' },
];

function getAll() {
  return products;
}

function getById(id) {
  return products.find(p => p.id === id);
}

module.exports = { getAll, getById };
