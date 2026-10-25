import { esc, gnf, dateFr } from './core.js';

export const STATUS = {
  recue: 'Reçue', confirmee: 'Confirmée', en_preparation: 'En préparation',
  en_livraison: 'En livraison', livree: 'Livrée', annulee: 'Annulée'
};
export const PAY_STATUS = { en_attente: 'En attente', paye: 'Payée', rembourse: 'Remboursée' };
export const PAYMENT = {
  orange_money: 'Orange Money', mtn_momo: 'MTN Mobile Money',
  livraison: 'Paiement à la livraison', boutique: 'Paiement en boutique'
};

// Ouvre une facture imprimable (ou à enregistrer en PDF depuis la boîte d'impression).
export function printInvoice(order, shop) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return alert('Autorisez les fenêtres pop-up pour imprimer la facture.');
  const rows = order.items.map(i => `<tr><td>${esc(i.name)}${i.size || i.color ? `<br><small>${esc([i.size, i.color].filter(Boolean).join(' · '))}</small>` : ''}</td>
    <td class="r">${i.qty}</td><td class="r">${gnf(i.price)}</td><td class="r">${gnf(i.price * i.qty)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${esc(order.code)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;margin:40px;font-size:13px}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:18px}
.logo{font-size:26px;font-weight:800;letter-spacing:-.5px}.logo b{color:#f97316}
h2{margin:0 0 4px;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:24px}
th{background:#eef2ff;text-align:left;padding:10px}td{padding:10px;border-bottom:1px solid #e5e7eb}.r{text-align:right}
.cols{display:flex;gap:40px;margin-top:22px}.cols div{flex:1}.muted{color:#64748b}
.tot{margin-left:auto;width:320px;margin-top:16px}.tot div{display:flex;justify-content:space-between;padding:5px 0}
.grand{font-size:17px;font-weight:800;border-top:2px solid #0f172a;margin-top:6px;padding-top:8px!important}
.foot{margin-top:50px;font-size:11px;color:#64748b;text-align:center}
</style></head><body>
<div class="top"><div><div class="logo">LENO <b>SHOP</b></div><div class="muted">${esc(shop.address)}<br>${esc(shop.phone)} · ${esc(shop.email)}</div></div>
<div style="text-align:right"><h2>FACTURE</h2><div>N° <b>${esc(order.code)}</b></div><div class="muted">${dateFr(order.created_at)}</div></div></div>
<div class="cols"><div><b>Client</b><br>${esc(order.name)}<br>${esc(order.phone)}${order.email ? '<br>' + esc(order.email) : ''}</div>
<div><b>${order.mode === 'retrait' ? 'Retrait' : 'Livraison'}</b><br>${esc(order.commune || '')}<br>${esc(order.address || '')}</div>
<div><b>Paiement</b><br>${esc(PAYMENT[order.payment])}<br>Statut : ${esc(PAY_STATUS[order.payment_status])}</div></div>
<table><thead><tr><th>Article</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><div><span>Sous-total</span><span>${gnf(order.subtotal)}</span></div>
${order.discount ? `<div><span>Remise ${esc(order.promo_code || '')}</span><span>- ${gnf(order.discount)}</span></div>` : ''}
<div><span>Livraison</span><span>${order.delivery_fee ? gnf(order.delivery_fee) : 'Gratuite'}</span></div>
<div class="grand"><span>Total</span><span>${gnf(order.total)}</span></div></div>
<div class="foot">Merci pour votre confiance ! LENO SHOP — Informatique & Mode — Foula Madina, Conakry</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
