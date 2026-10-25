import { $, $$, api, esc, gnf, dateFr, icon, store, toast, modal } from '/js/core.js';
import { STATUS, PAY_STATUS, PAYMENT, printInvoice } from '/js/invoice.js';

document.documentElement.dataset.theme = store.get('leno_theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const root = $('#root');
let me = null, config = null, categories = [];
const can = (...roles) => me && roles.includes(me.role);
const ROLE_LABEL = { admin: 'Administrateur', vendeur: 'Vendeur', stock: 'Gestionnaire de stock', livreur: 'Livreur', client: 'Client' };

const PAGES = [
  ['dashboard', 'Tableau de bord', 'chart', ['admin', 'vendeur', 'stock', 'livreur']],
  ['commandes', 'Commandes', 'package', ['admin', 'vendeur', 'stock', 'livreur']],
  ['produits', 'Produits & stock', 'tag', ['admin', 'vendeur', 'stock']],
  ['categories', 'Catégories', 'layers', ['admin']],
  ['clients', 'Clients & équipe', 'users', ['admin', 'vendeur']],
  ['promos', 'Promotions', 'tag', ['admin', 'vendeur']],
  ['livraison', 'Zones de livraison', 'truck', ['admin']],
  ['avis', 'Avis clients', 'star', ['admin', 'vendeur']],
  ['messages', 'Messages & devis', 'message', ['admin', 'vendeur']],
  ['bannieres', 'Bannières accueil', 'image', ['admin']]
];

const stockBadge = n => `<span class="stock-badge ${n <= 0 ? 'out' : n <= 5 ? 'low' : ''}">${n}</span>`;
const pill = (cls, label) => `<span class="status-pill ${cls}">${label}</span>`;

// ---------- connexion ----------
function loginView(error = '') {
  root.innerHTML = `<div class="login-wrap"><form class="panel" id="login">
    <div class="logo" style="justify-content:center;margin-bottom:8px"><span class="logo-mark">L</span><span>LENO <b>SHOP</b></span></div>
    <p class="muted" style="text-align:center">Back-office — réservé à l'équipe</p>
    <div class="field"><label for="a-l">E-mail</label><input class="input" id="a-l" name="login" required autocomplete="username"></div>
    <div class="field"><label for="a-p">Mot de passe</label><input class="input" id="a-p" name="password" type="password" required autocomplete="current-password"></div>
    <p class="error-text">${esc(error)}</p>
    <button class="btn btn-primary btn-block btn-lg">Se connecter</button>
    <p style="text-align:center;margin-top:14px"><a class="muted" href="/">← Retour à la boutique</a></p></form></div>`;
  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const u = await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      if (u.role === 'client') { await api('/api/auth/logout', { method: 'POST' }); return loginView('Ce compte n\'a pas accès au back-office.'); }
      me = u; start();
    } catch (err) { loginView(err.message); }
  });
}

// ---------- coquille ----------
async function start() {
  [config, categories] = await Promise.all([api('/api/config'), api('/api/admin/categories')]);
  root.innerHTML = `<div class="adm">
    <aside class="adm-side" id="side">
      <a class="logo" href="/" target="_blank" rel="noopener"><span class="logo-mark">L</span><span>LENO <b>SHOP</b></span></a>
      ${PAGES.filter(p => can(...p[3])).map(([id, label, ic]) => `<a href="#/${id}" data-page="${id}">${icon(ic)} ${label}<span class="pill" data-pill="${id}" hidden></span></a>`).join('')}
      <div class="sep"></div>
      <a href="/" target="_blank" rel="noopener">${icon('store')} Voir la boutique</a>
      <a href="#" data-logout>${icon('logout')} Déconnexion</a>
    </aside>
    <div class="adm-main">
      <header class="adm-top">
        <button class="icon-btn adm-menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
        <h1 id="title"></h1>
        <div class="right"><button class="icon-btn" data-theme aria-label="Thème">${icon('moon')}</button><span class="muted hide-sm">${esc(me.name)} · ${ROLE_LABEL[me.role]}</span></div>
      </header>
      <div class="adm-body" id="body"></div>
    </div></div>`;
  root.addEventListener('click', async e => {
    if (e.target.closest('[data-logout]')) { e.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); me = null; return loginView(); }
    if (e.target.closest('[data-menu]')) return $('#side').classList.toggle('open');
    if (e.target.closest('[data-theme]')) {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t; store.set('leno_theme', t);
    }
    if (e.target.closest('.adm-side a[data-page]')) $('#side').classList.remove('open');
  });
  window.addEventListener('hashchange', route);
  route();
}

async function refreshPills() {
  try {
    const s = await api('/api/admin/stats');
    const set = (id, n) => { const p = $(`[data-pill="${id}"]`); if (p) { p.hidden = !n; p.textContent = n; } };
    set('commandes', s.pending); set('messages', s.unreadMessages); set('avis', s.pendingReviews);
    return s;
  } catch { return null; }
}

async function route() {
  const [page, arg] = (location.hash.replace(/^#\//, '') || 'dashboard').split('/');
  const def = PAGES.find(p => p[0] === page && can(...p[3])) || PAGES[0];
  $$('.adm-side a[data-page]').forEach(a => a.classList.toggle('on', a.dataset.page === def[0]));
  $('#title').textContent = def[1];
  document.title = `${def[1]} | Back-office LENO SHOP`;
  const body = $('#body');
  body.innerHTML = '<div class="spinner" style="margin-top:60px"></div>';
  try { await VIEWS[def[0]](body, arg); } catch (err) { body.innerHTML = `<div class="panel error-text">${esc(err.message)}</div>`; }
  refreshPills();
}

// ---------- tableau de bord ----------
async function dashboard(body) {
  const s = await api('/api/admin/stats');
  const max = Math.max(...s.series.map(d => d.total), 1);
  const uni = Object.fromEntries(s.byUnivers.map(r => [r.univers, r.total || 0]));
  const tot = (uni.informatique || 0) + (uni.mode || 0) || 1;
  const day = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  body.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="lbl"><span class="ic">${icon('chart')}</span> Ventes du jour</div><div class="val">${gnf(s.today.s)}</div><div class="sub">${s.today.n} commande(s)</div></div>
      <div class="kpi"><div class="lbl"><span class="ic">${icon('chart')}</span> 7 derniers jours</div><div class="val">${gnf(s.week.s)}</div><div class="sub">${s.week.n} commande(s)</div></div>
      <div class="kpi"><div class="lbl"><span class="ic">${icon('chart')}</span> Ce mois-ci</div><div class="val">${gnf(s.month.s)}</div><div class="sub">${s.month.n} commande(s) · panier moyen ${gnf(s.month.n ? s.month.s / s.month.n : 0)}</div></div>
      <div class="kpi"><div class="lbl"><span class="ic">${icon('package')}</span> À traiter</div><div class="val">${s.pending}</div><div class="sub"><a href="#/commandes" style="color:var(--brand)">Voir les commandes →</a></div></div>
      <div class="kpi"><div class="lbl"><span class="ic">${icon('users')}</span> Clients inscrits</div><div class="val">${s.customers}</div><div class="sub">${s.products} produits au catalogue</div></div>
    </div>
    <div class="two">
      <div class="panel"><h3>Chiffre d'affaires — 14 derniers jours</h3>
        <div class="chart-bars">${s.series.map(d => `<div class="b"><div class="bar" style="height:${Math.max(2, (d.total / max) * 100)}%" data-tip="${gnf(d.total)} · ${d.orders} cde"></div><small>${day(d.date)}</small></div>`).join('')}</div>
      </div>
      <div class="panel"><h3>Ventes par univers</h3>
        <div class="split"><span style="width:${(uni.informatique || 0) / tot * 100}%;background:var(--tech)"></span><span style="width:${(uni.mode || 0) / tot * 100}%;background:var(--mode)"></span></div>
        <div class="totals"><div><span>● Informatique</span><b>${gnf(uni.informatique || 0)}</b></div><div><span>● Mode</span><b>${gnf(uni.mode || 0)}</b></div></div>
        <h3 style="margin-top:22px">Alertes de stock</h3>
        ${s.lowStock.length ? s.lowStock.map(p => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><a href="#/produits/${p.id}">${esc(p.name)}</a>${stockBadge(p.stock)}</div>`).join('') : '<p class="muted">Aucune alerte.</p>'}
      </div>
    </div>
    <div class="two" style="margin-top:18px">
      <div class="panel"><h3>Dernières commandes</h3>${ordersTable(s.recentOrders)}</div>
      <div class="panel"><h3>Meilleures ventes</h3>${s.topProducts.map((p, i) => `<div style="display:flex;gap:10px;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span><b>${i + 1}.</b> ${esc(p.name)}</span><span class="muted" style="white-space:nowrap">${p.sold} vendus</span></div>`).join('')}</div>
    </div>`;
  bindOrderRows(body, s.recentOrders);
}

// ---------- commandes ----------
function ordersTable(list) {
  if (!list.length) return '<p class="muted">Aucune commande.</p>';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Livraison</th><th>Paiement</th><th>Statut</th><th class="num">Total</th></tr></thead><tbody>
    ${list.map(o => `<tr class="click" data-order="${o.id}"><td><b>${esc(o.code)}</b></td><td class="muted">${dateFr(o.created_at)}</td><td>${esc(o.name)}<br><small class="muted">${esc(o.phone)}</small></td>
      <td>${esc(o.commune)}</td><td>${esc(PAYMENT[o.payment])}<br>${pill(o.payment_status, PAY_STATUS[o.payment_status])}</td><td>${pill(o.status, STATUS[o.status])}</td><td class="num"><b>${gnf(o.total)}</b></td></tr>`).join('')}
  </tbody></table></div>`;
}

function bindOrderRows(scope, list, after) {
  $$('[data-order]', scope).forEach(tr => tr.addEventListener('click', () => orderModal(list.find(o => o.id === Number(tr.dataset.order)), after)));
}

function orderModal(o, after) {
  const statuses = me.role === 'livreur' ? ['en_livraison', 'livree'] : Object.keys(STATUS);
  const waMsg = encodeURIComponent(`Bonjour ${o.name}, LENO SHOP vous contacte au sujet de votre commande ${o.code} (${gnf(o.total)}).`);
  const m = modal(`<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h3 style="margin:0">Commande ${esc(o.code)}</h3><small class="muted">${dateFr(o.created_at)}</small></div><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="form-grid" style="margin-top:16px">
      <div><b>Client</b><br>${esc(o.name)}<br><a href="tel:${esc(o.phone)}" style="color:var(--brand)">${esc(o.phone)}</a>${o.email ? '<br>' + esc(o.email) : ''}</div>
      <div><b>${o.mode === 'retrait' ? 'Retrait en boutique' : 'Livraison'}</b><br>${esc(o.commune)}<br>${esc(o.address || '')}</div>
    </div>
    ${o.note ? `<p class="panel" style="margin:14px 0 0;padding:12px"><b>Note :</b> ${esc(o.note)}</p>` : ''}
    <div style="margin-top:14px">${o.items.map(i => `<div class="line-item" style="grid-template-columns:48px 1fr auto;padding:8px 0"><img src="${esc(i.image)}" alt="" style="width:48px;height:48px"><div><b style="font-size:.88rem">${esc(i.name)}</b><div class="li-var">${esc([i.size, i.color, 'x' + i.qty].filter(Boolean).join(' · '))}</div></div><b>${gnf(i.price * i.qty)}</b></div>`).join('')}</div>
    <div class="totals" style="margin:12px 0"><div><span>Sous-total</span><span>${gnf(o.subtotal)}</span></div>${o.discount ? `<div><span>Remise ${esc(o.promo_code)}</span><span>- ${gnf(o.discount)}</span></div>` : ''}<div><span>Livraison</span><span>${gnf(o.delivery_fee)}</span></div><div class="grand"><span>Total</span><span>${gnf(o.total)}</span></div></div>
    <div class="form-grid">
      <div class="field"><label>Statut de la commande</label><select class="input" data-f="status" ${o.status === 'annulee' ? 'disabled' : ''}>${statuses.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></div>
      <div class="field"><label>Paiement (${esc(PAYMENT[o.payment])})</label><select class="input" data-f="payment_status" ${me.role === 'stock' ? 'disabled' : ''}>${Object.entries(PAY_STATUS).map(([k, v]) => `<option value="${k}" ${k === o.payment_status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <p class="hint">Annuler une commande remet automatiquement les articles en stock.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
      <button class="btn btn-primary" data-save>Enregistrer</button>
      <button class="btn btn-outline" data-print>${icon('print')} Facture / bon de livraison</button>
      <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(o.phone.replace(/\D/g, '').replace(/^(?!224)/, '224'))}?text=${waMsg}">WhatsApp client</a>
    </div>
    <details style="margin-top:14px"><summary class="muted">Historique</summary>${o.history.map(h => `<div style="font-size:.85rem;padding:4px 0">${dateFr(h.at)} — ${esc(h.label)}</div>`).join('')}</details>`, { wide: true });
  $('[data-print]', m.el).addEventListener('click', () => printInvoice(o, config.shop));
  $('[data-save]', m.el).addEventListener('click', async () => {
    const status = $('[data-f="status"]', m.el).value, payment_status = $('[data-f="payment_status"]', m.el).value;
    if (status === 'annulee' && o.status !== 'annulee' && !confirm('Annuler cette commande ? Les articles seront remis en stock.')) return;
    try {
      await api(`/api/admin/orders/${o.id}`, { method: 'PUT', body: { status, payment_status } });
      toast('Commande mise à jour'); m.close(); after ? after() : route();
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function commandes(body) {
  const params = new URLSearchParams(store.get('adm_order_filter', {}));
  const list = await api(`/api/admin/orders?${params}`);
  body.innerHTML = `<div class="toolbar">
      <input class="input grow" type="search" placeholder="N° de commande, nom ou téléphone" data-q value="${esc(params.get('q') || '')}">
      <select class="input" data-s><option value="">Tous les statuts</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${params.get('status') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="input" data-p><option value="">Tous paiements</option>${Object.entries(PAY_STATUS).map(([k, v]) => `<option value="${k}" ${params.get('payment_status') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      ${can('admin', 'vendeur') ? `<a class="btn btn-outline" href="/api/admin/export/orders.csv">${icon('download')} Export Excel (CSV)</a>` : ''}
    </div>
    <p class="muted">${list.length} commande(s)</p>${ordersTable(list)}`;
  const apply = () => { store.set('adm_order_filter', Object.fromEntries(Object.entries({ q: $('[data-q]').value, status: $('[data-s]').value, payment_status: $('[data-p]').value }).filter(([, v]) => v))); commandes(body); };
  $('[data-s]').addEventListener('change', apply);
  $('[data-p]').addEventListener('change', apply);
  let t; $('[data-q]').addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 350); });
  bindOrderRows(body, list, () => commandes(body));
}

// ---------- produits ----------
async function produits(body, editId) {
  const f = store.get('adm_prod_filter', {});
  const data = await api(`/api/admin/products?${new URLSearchParams({ ...f, limit: 100 })}`);
  body.innerHTML = `<div class="toolbar">
      <input class="input grow" type="search" placeholder="Rechercher un produit" data-q value="${esc(f.q || '')}">
      <select class="input" data-u><option value="">Tous les univers</option><option value="informatique" ${f.univers === 'informatique' ? 'selected' : ''}>Informatique</option><option value="mode" ${f.univers === 'mode' ? 'selected' : ''}>Mode</option></select>
      <label class="switch"><input type="checkbox" data-low ${f.lowstock ? 'checked' : ''}> Stock faible (≤ 5)</label>
      ${can('admin', 'vendeur') ? `<button class="btn btn-primary" data-new>${icon('plus')} Nouveau produit</button>` : ''}
    </div>
    <p class="muted">${data.total} produit(s)</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Produit</th><th>Catégorie</th><th class="num">Prix</th><th class="num">Stock</th><th class="num">Vendus</th><th>Visible</th><th></th></tr></thead><tbody>
      ${data.items.map(p => `<tr><td><img class="th" src="${esc(p.images[0] || '/icons/icon.svg')}" alt=""></td>
        <td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.brand)}${p.featured ? ' · ★ vedette' : ''}</small></td>
        <td>${esc(p.category_name || '—')}</td>
        <td class="num">${gnf(p.price)}${p.old_price ? `<br><small class="old-price">${gnf(p.old_price)}</small>` : ''}</td>
        <td class="num">${stockBadge(p.stock)}</td><td class="num">${p.sold}</td>
        <td>${p.active ? pill('livree', 'Oui') : pill('annulee', 'Non')}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm btn-outline" data-stock="${p.id}" title="Mouvement de stock">± Stock</button>
          ${can('admin', 'vendeur') ? `<button class="btn btn-sm btn-ghost" data-edit="${p.id}" aria-label="Modifier">${icon('edit')}</button>` : ''}
          ${can('admin') ? `<button class="btn btn-sm btn-ghost" data-del="${p.id}" aria-label="Supprimer">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
  const apply = () => { store.set('adm_prod_filter', Object.fromEntries(Object.entries({ q: $('[data-q]').value, univers: $('[data-u]').value, lowstock: $('[data-low]').checked ? '1' : '' }).filter(([, v]) => v))); produits(body); };
  let t; $('[data-q]').addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 350); });
  $('[data-u]').addEventListener('change', apply);
  $('[data-low]').addEventListener('change', apply);
  $('[data-new]')?.addEventListener('click', () => productForm(null, () => produits(body)));
  $$('[data-edit]', body).forEach(b => b.addEventListener('click', async () => productForm(await api(`/api/admin/products/${b.dataset.edit}`), () => produits(body))));
  $$('[data-del]', body).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement ce produit ?')) return;
    await api(`/api/admin/products/${b.dataset.del}`, { method: 'DELETE' }); toast('Produit supprimé'); produits(body);
  }));
  $$('[data-stock]', body).forEach(b => b.addEventListener('click', () => stockModal(data.items.find(p => p.id === Number(b.dataset.stock)), () => produits(body))));
  if (editId && can('admin', 'vendeur')) productForm(await api(`/api/admin/products/${editId}`), () => { location.hash = '#/produits'; });
}

function stockModal(p, after) {
  const m = modal(`<h3>Mouvement de stock</h3><p><b>${esc(p.name)}</b><br><span class="muted">Stock actuel : ${p.stock}</span></p>
    <form data-sf><div class="form-grid">
      <div class="field"><label>Type</label><select class="input" name="type"><option value="in">Entrée (réapprovisionnement)</option><option value="out">Sortie (casse, vente en boutique…)</option></select></div>
      <div class="field"><label>Quantité</label><input class="input" type="number" name="qty" min="1" value="1" required></div>
      <div class="field full"><label>Motif</label><input class="input" name="reason" placeholder="Ex. Livraison fournisseur, vente en boutique"></div>
    </div><div style="display:flex;gap:8px"><button class="btn btn-primary">Valider</button><button type="button" class="btn btn-ghost" data-close>Annuler</button></div></form>`);
  $('[data-sf]', m.el).addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(`/api/admin/products/${p.id}/stock`, { method: 'PUT', body: { delta: (d.type === 'out' ? -1 : 1) * Number(d.qty), reason: d.reason } });
      toast(`Nouveau stock : ${r.stock}`); m.close(); after();
    } catch (err) { toast(err.message, 'err'); }
  });
}

const fileToDataUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

// Réduit les photos avant l'envoi (max 1200 px, WebP) pour un site rapide.
async function compress(file) {
  const url = await fileToDataUrl(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = c.toDataURL('image/webp', 0.85);
  return out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', 0.85);
}

function productForm(p, after) {
  const isNew = !p;
  p = p || { name: '', brand: '', description: '', price: '', old_price: '', stock: 0, images: [], specs: {}, sizes: [], colors: [], condition: 'neuf', gender: '', warranty: '', featured: false, active: true, category_id: categories[0]?.id };
  let images = [...p.images];
  const specRow = (k = '', v = '') => `<div class="spec-row"><input class="input" placeholder="Caractéristique (ex. RAM)" value="${esc(k)}" data-sk><input class="input" placeholder="Valeur (ex. 16 Go)" value="${esc(v)}" data-sv><button type="button" class="icon-btn" data-rm-spec aria-label="Retirer">${icon('x')}</button></div>`;
  const m = modal(`<form data-pf>
    <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">${isNew ? 'Nouveau produit' : 'Modifier le produit'}</h3><button type="button" class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="form-grid" style="margin-top:16px">
      <div class="field full"><label>Nom du produit *</label><input class="input" name="name" required value="${esc(p.name)}"></div>
      <div class="field"><label>Catégorie *</label><select class="input" name="category_id">${['informatique', 'mode'].map(u => `<optgroup label="${u === 'mode' ? 'Mode' : 'Informatique'}">${categories.filter(c => c.univers === u).map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field"><label>Marque</label><input class="input" name="brand" value="${esc(p.brand)}"></div>
      <div class="field"><label>Prix de vente (GNF) *</label><input class="input" name="price" type="number" min="0" step="500" required value="${esc(p.price)}"></div>
      <div class="field"><label>Ancien prix (GNF) — pour afficher une promo</label><input class="input" name="old_price" type="number" min="0" step="500" value="${esc(p.old_price || '')}"></div>
      <div class="field"><label>Stock</label><input class="input" name="stock" type="number" min="0" value="${esc(p.stock)}"></div>
      <div class="field"><label>État</label><select class="input" name="condition"><option value="neuf">Neuf</option><option value="reconditionné" ${p.condition === 'reconditionné' ? 'selected' : ''}>Reconditionné</option></select></div>
      <div class="field"><label>Tailles (séparées par des virgules)</label><input class="input" name="sizes" placeholder="S, M, L, XL" value="${esc(p.sizes.join(', '))}"></div>
      <div class="field"><label>Couleurs (séparées par des virgules)</label><input class="input" name="colors" placeholder="Noir, Blanc" value="${esc(p.colors.join(', '))}"></div>
      <div class="field"><label>Genre (mode)</label><select class="input" name="gender">${[['', '—'], ['homme', 'Homme'], ['femme', 'Femme'], ['enfant', 'Enfant']].map(([v, l]) => `<option value="${v}" ${p.gender === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Garantie</label><input class="input" name="warranty" placeholder="12 mois" value="${esc(p.warranty)}"></div>
      <div class="field full"><label>Description</label><textarea class="input" name="description">${esc(p.description)}</textarea></div>
      <div class="field full"><label>Photos (la première est la photo principale)</label>
        <div class="img-list" data-imgs></div>
        <span class="hint">JPG, PNG ou WEBP · les photos sont automatiquement allégées.</span></div>
      <div class="field full"><label>Caractéristiques techniques</label><div data-specs>${Object.entries(p.specs).map(([k, v]) => specRow(k, v)).join('')}</div>
        <button type="button" class="btn btn-sm btn-outline" data-add-spec>${icon('plus')} Ajouter une caractéristique</button></div>
      <label class="switch"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Mettre en avant (coups de cœur)</label>
      <label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Visible sur la boutique</label>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px"><button class="btn btn-primary btn-lg">${isNew ? 'Créer le produit' : 'Enregistrer'}</button><button type="button" class="btn btn-ghost" data-close>Annuler</button></div>
  </form>`, { wide: true });
  const el = m.el;
  const drawImgs = () => {
    $('[data-imgs]', el).innerHTML = images.map((src, i) => `<div class="im"><img src="${esc(src)}" alt=""><button type="button" data-rm-img="${i}" aria-label="Retirer">${icon('x')}</button></div>`).join('')
      + `<label class="upload-tile">${icon('plus')}<span>Ajouter<br>des photos</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden data-upload></label>`;
  };
  drawImgs();
  el.addEventListener('click', e => {
    const rmImg = e.target.closest('[data-rm-img]');
    if (rmImg) { images.splice(Number(rmImg.dataset.rmImg), 1); drawImgs(); }
    if (e.target.closest('[data-add-spec]')) $('[data-specs]', el).insertAdjacentHTML('beforeend', specRow());
    if (e.target.closest('[data-rm-spec]')) e.target.closest('.spec-row').remove();
  });
  el.addEventListener('change', async e => {
    if (!e.target.matches('[data-upload]')) return;
    for (const file of e.target.files) {
      try {
        const { url } = await api('/api/admin/upload', { method: 'POST', body: { data: await compress(file) } });
        images.push(url); drawImgs();
      } catch (err) { toast(err.message, 'err'); }
    }
  });
  $('[data-pf]', el).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const specs = {};
    $$('.spec-row', el).forEach(r => { const k = $('[data-sk]', r).value.trim(), v = $('[data-sv]', r).value.trim(); if (k && v) specs[k] = v; });
    const body = { ...fd, featured: !!fd.featured, active: !!fd.active, images, specs };
    try {
      await api(isNew ? '/api/admin/products' : `/api/admin/products/${p.id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? 'Produit créé' : 'Produit enregistré'); m.close(); after();
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ---------- catégories ----------
async function categoriesView(body) {
  categories = await api('/api/admin/categories');
  body.innerHTML = `<form class="panel toolbar" data-new-cat style="margin-bottom:18px">
      <input class="input grow" name="name" placeholder="Nom de la nouvelle catégorie" required>
      <select class="input" name="univers"><option value="informatique">Informatique</option><option value="mode">Mode</option></select>
      <button class="btn btn-primary">${icon('plus')} Ajouter</button></form>
    <div class="two">${['informatique', 'mode'].map(u => `<div class="panel"><h3>${u === 'mode' ? 'Mode' : 'Informatique'}</h3>
      ${categories.filter(c => c.univers === u).map(c => `<div class="toolbar" style="margin-bottom:8px"><input class="input grow" value="${esc(c.name)}" data-cat-name="${c.id}" data-sort="${c.sort}"><span class="muted">${c.count} produit(s)</span>
        <button class="btn btn-sm btn-outline" data-cat-save="${c.id}">Renommer</button><button class="btn btn-sm btn-ghost" data-cat-del="${c.id}" aria-label="Supprimer">${icon('trash')}</button></div>`).join('')}</div>`).join('')}</div>`;
  $('[data-new-cat]').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/categories', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Catégorie ajoutée'); categoriesView(body); } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-cat-save]', body).forEach(b => b.addEventListener('click', async () => {
    const input = $(`[data-cat-name="${b.dataset.catSave}"]`);
    await api(`/api/admin/categories/${b.dataset.catSave}`, { method: 'PUT', body: { name: input.value, sort: input.dataset.sort } }); toast('Catégorie renommée');
  }));
  $$('[data-cat-del]', body).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    try { await api(`/api/admin/categories/${b.dataset.catDel}`, { method: 'DELETE' }); toast('Catégorie supprimée'); categoriesView(body); } catch (err) { toast(err.message, 'err'); }
  }));
}

// ---------- clients & équipe ----------
async function clients(body) {
  const list = await api('/api/admin/customers');
  body.innerHTML = `${can('admin') ? `<form class="panel" data-new-user style="margin-bottom:18px"><h3>Ajouter un membre de l'équipe</h3>
      <div class="toolbar"><input class="input grow" name="name" placeholder="Nom" required><input class="input grow" name="email" type="email" placeholder="E-mail" required>
      <input class="input" name="password" type="password" placeholder="Mot de passe (8 car. min.)" minlength="8" required autocomplete="new-password">
      <select class="input" name="role">${['vendeur', 'stock', 'livreur', 'admin'].map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}</select>
      <button class="btn btn-primary">Créer</button></div></form>` : ''}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Contact</th><th>Inscrit le</th><th class="num">Commandes</th><th class="num">Total dépensé</th><th>Rôle</th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email || '')}<br><small class="muted">${esc(u.phone || '')}</small></td><td class="muted">${dateFr(u.created_at)}</td><td class="num">${u.orders}</td><td class="num">${gnf(u.spent)}</td>
      <td>${can('admin') && u.id !== me.id ? `<select class="input" style="height:36px" data-role="${u.id}">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLE_LABEL[u.role]}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('[data-new-user]')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Compte créé'); clients(body); } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-role]', body).forEach(s => s.addEventListener('change', async () => {
    try { await api(`/api/admin/users/${s.dataset.role}`, { method: 'PUT', body: { role: s.value } }); toast('Rôle mis à jour'); } catch (err) { toast(err.message, 'err'); }
  }));
}

// ---------- promotions ----------
async function promos(body) {
  const list = await api('/api/admin/promos');
  body.innerHTML = `${can('admin') ? `<form class="panel" data-new-promo style="margin-bottom:18px"><h3>Créer un code promo</h3><div class="toolbar">
      <input class="input" name="code" placeholder="CODE" required style="text-transform:uppercase">
      <select class="input" name="type"><option value="percent">Pourcentage (%)</option><option value="amount">Montant (GNF)</option></select>
      <input class="input" name="value" type="number" min="1" placeholder="Valeur" required>
      <input class="input" name="min_total" type="number" min="0" placeholder="Achat minimum (GNF)">
      <input class="input" name="expires" type="date" aria-label="Expire le">
      <button class="btn btn-primary">Créer</button></div></form>` : ''}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Réduction</th><th>Minimum d'achat</th><th>Expire le</th><th>Actif</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr><td><b class="code-pill">${esc(p.code)}</b></td><td>${p.type === 'percent' ? p.value + ' %' : gnf(p.value)}</td><td>${p.min_total ? gnf(p.min_total) : '—'}</td><td>${esc(p.expires || '—')}</td><td>${p.active ? pill('livree', 'Oui') : pill('annulee', 'Non')}</td>
      <td>${can('admin') ? `<button class="btn btn-sm btn-ghost" data-del-promo="${esc(p.code)}">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('[data-new-promo]')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/promos', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Code créé'); promos(body); } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-del-promo]', body).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Supprimer ce code ?')) return;
    await api(`/api/admin/promos/${encodeURIComponent(b.dataset.delPromo)}`, { method: 'DELETE' }); promos(body);
  }));
}

// ---------- zones de livraison ----------
async function livraison(body) {
  const list = await api('/api/admin/zones');
  const row = z => `<div class="toolbar" data-zone="${z.id}"><input class="input grow" value="${esc(z.commune)}" data-c><input class="input" type="number" min="0" step="500" value="${z.fee}" data-fee style="width:140px"><input class="input" value="${esc(z.delay)}" data-d style="width:150px">
    <button class="btn btn-sm btn-outline" data-zsave>Enregistrer</button><button class="btn btn-sm btn-ghost" data-zdel aria-label="Supprimer">${icon('trash')}</button></div>`;
  body.innerHTML = `<div class="panel"><h3>Tarifs par commune</h3><p class="muted">Commune · frais (GNF) · délai affiché au client. Le retrait en boutique est toujours gratuit.</p>
    ${list.map(row).join('')}</div>
    <form class="panel toolbar" data-new-zone><input class="input grow" name="commune" placeholder="Nouvelle commune ou zone" required><input class="input" name="fee" type="number" min="0" step="500" placeholder="Frais (GNF)" required><input class="input" name="delay" placeholder="Délai (ex. 24h)"><button class="btn btn-primary">${icon('plus')} Ajouter</button></form>`;
  $$('[data-zone]', body).forEach(r => {
    const id = r.dataset.zone;
    $('[data-zsave]', r).addEventListener('click', async () => { await api(`/api/admin/zones/${id}`, { method: 'PUT', body: { commune: $('[data-c]', r).value, fee: $('[data-fee]', r).value, delay: $('[data-d]', r).value } }); toast('Zone enregistrée'); });
    $('[data-zdel]', r).addEventListener('click', async () => { if (confirm('Supprimer cette zone ?')) { await api(`/api/admin/zones/${id}`, { method: 'DELETE' }); livraison(body); } });
  });
  $('[data-new-zone]').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/zones', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Zone ajoutée'); livraison(body); } catch (err) { toast(err.message, 'err'); }
  });
}

// ---------- avis ----------
async function avis(body) {
  const list = await api('/api/admin/reviews');
  body.innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produit</th><th>Client</th><th>Note</th><th>Commentaire</th><th>Statut</th><th></th></tr></thead><tbody>
    ${list.map(r => `<tr><td><a href="/produit/${esc(r.product_slug)}" target="_blank" rel="noopener">${esc(r.product_name)}</a></td><td>${esc(r.author)}<br><small class="muted">${dateFr(r.created_at)}</small></td><td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td><td style="max-width:340px">${esc(r.comment)}</td>
      <td>${r.approved ? pill('livree', 'Publié') : pill('confirmee', 'En attente')}</td>
      <td style="white-space:nowrap"><button class="btn btn-sm ${r.approved ? 'btn-outline' : 'btn-primary'}" data-ap="${r.id}" data-v="${r.approved ? 0 : 1}">${r.approved ? 'Masquer' : 'Publier'}</button><button class="btn btn-sm btn-ghost" data-rdel="${r.id}">${icon('trash')}</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="panel muted">Aucun avis.</div>';
  $$('[data-ap]', body).forEach(b => b.addEventListener('click', async () => { await api(`/api/admin/reviews/${b.dataset.ap}`, { method: 'PUT', body: { approved: b.dataset.v === '1' } }); avis(body); refreshPills(); }));
  $$('[data-rdel]', body).forEach(b => b.addEventListener('click', async () => { if (confirm('Supprimer cet avis ?')) { await api(`/api/admin/reviews/${b.dataset.rdel}`, { method: 'DELETE' }); avis(body); } }));
}

// ---------- messages ----------
async function messages(body) {
  const list = await api('/api/admin/messages');
  body.innerHTML = list.length ? list.map(m => `<div class="panel" style="${m.handled ? 'opacity:.6' : ''}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(m.name)}</b> ${m.company ? `· ${esc(m.company)}` : ''} ${pill(m.type === 'devis' ? 'en_livraison' : 'recue', m.type === 'devis' ? 'Devis' : 'Contact')}<br>
        <small class="muted">${dateFr(m.created_at)} · ${esc(m.phone || '')} ${esc(m.email || '')}</small></div>
        <div style="display:flex;gap:6px">${m.phone ? `<a class="btn btn-sm btn-outline" href="https://wa.me/${esc(m.phone.replace(/\D/g, '').replace(/^(?!224)/, '224'))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${m.email ? `<a class="btn btn-sm btn-outline" href="mailto:${esc(m.email)}">E-mail</a>` : ''}
        <button class="btn btn-sm ${m.handled ? 'btn-ghost' : 'btn-primary'}" data-h="${m.id}" data-v="${m.handled ? 0 : 1}">${m.handled ? 'Rouvrir' : 'Marquer traité'}</button></div></div>
      <p style="margin:12px 0 0;white-space:pre-wrap">${esc(m.message)}</p></div>`).join('') : '<div class="panel muted">Aucun message.</div>';
  $$('[data-h]', body).forEach(b => b.addEventListener('click', async () => { await api(`/api/admin/messages/${b.dataset.h}`, { method: 'PUT', body: { handled: b.dataset.v === '1' } }); messages(body); refreshPills(); }));
}

// ---------- bannières ----------
async function bannieres(body) {
  const list = await api('/api/admin/banners');
  body.innerHTML = list.map(b => `<form class="panel" data-banner="${b.id}"><div class="two">
      <div><div class="field"><label>Titre</label><input class="input" name="title" value="${esc(b.title)}" required></div>
      <div class="field"><label>Sous-titre</label><textarea class="input" name="subtitle" style="min-height:80px">${esc(b.subtitle)}</textarea></div>
      <div class="form-grid"><div class="field"><label>Texte du bouton</label><input class="input" name="cta" value="${esc(b.cta)}"></div><div class="field"><label>Lien</label><input class="input" name="link" value="${esc(b.link)}"></div></div>
      <label class="switch"><input type="checkbox" name="active" ${b.active ? 'checked' : ''}> Affichée</label></div>
      <div><img src="${esc(b.image)}" alt="" style="border-radius:14px;width:100%;aspect-ratio:12/5;object-fit:cover" data-prev>
        <label class="btn btn-outline btn-sm" style="margin-top:10px">${icon('image')} Changer l'image<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-bimg></label></div></div>
      <button class="btn btn-primary" style="margin-top:12px">Enregistrer</button></form>`).join('');
  $$('[data-banner]', body).forEach(f => {
    let image = null;
    $('[data-bimg]', f).addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try { image = (await api('/api/admin/upload', { method: 'POST', body: { data: await compress(file) } })).url; $('[data-prev]', f).src = image; } catch (err) { toast(err.message, 'err'); }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      await api(`/api/admin/banners/${f.dataset.banner}`, { method: 'PUT', body: { ...d, active: !!d.active, image } });
      toast('Bannière enregistrée');
    });
  });
}

const VIEWS = { dashboard, commandes, produits, categories: categoriesView, clients, promos, livraison, avis, messages, bannieres };

// ---------- démarrage ----------
(async () => {
  me = await api('/api/auth/me').catch(() => null);
  if (me && me.role !== 'client') start(); else loginView();
})();
