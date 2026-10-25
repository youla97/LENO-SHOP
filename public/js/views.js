import {
  api, esc, gnf, dateFr, icon, waIcon, stars, state, store, cart, route, setNotFound,
  setTitle, setMeta, navigate, modal, toast, emit
} from './core.js';
import { STATUS, PAY_STATUS, PAYMENT, printInvoice } from './invoice.js';

// Cache des produits affichés (pour l'ajout rapide au panier).
export const productCache = new Map();
const remember = list => { list.forEach(p => productCache.set(p.id, p)); return list; };

const UNIVERS = {
  informatique: { label: 'Informatique', desc: 'Ordinateurs, smartphones, écrans, imprimantes et accessoires.' },
  mode: { label: 'Mode', desc: 'Vêtements, chaussures et accessoires pour homme, femme et enfant.' }
};

const discount = p => (p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0);
const isNew = p => Date.now() - new Date(p.created_at.replace(' ', 'T') + 'Z').getTime() < 10 * 86400000;

// ---------- composants ----------
export function productCard(p) {
  const d = discount(p);
  const fav = state.wishlist.includes(p.id);
  const cmp = state.compare.includes(p.id);
  return `<article class="card reveal">
    <div class="card-media">
      <a href="/produit/${esc(p.slug)}" aria-label="${esc(p.name)}">
        <img src="${esc(p.images[0] || '')}" alt="${esc(p.name)}" loading="lazy">
        ${p.images[1] ? `<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy">` : ''}
      </a>
      <div class="badges">
        ${d ? `<span class="badge promo">-${d}%</span>` : ''}
        ${isNew(p) ? '<span class="badge new">Nouveau</span>' : ''}
        ${p.condition === 'reconditionné' ? '<span class="badge refurb">Reconditionné</span>' : ''}
        ${p.stock <= 0 ? '<span class="badge out">Rupture</span>' : ''}
      </div>
      <button class="card-fav ${fav ? 'on' : ''}" data-action="wish" data-id="${p.id}" aria-label="Ajouter aux favoris">${icon('heart')}</button>
      <div class="card-quick"><button class="btn btn-primary btn-sm btn-block" data-action="quick-add" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${icon('bag')} ${p.sizes.length || p.colors.length > 1 ? 'Choisir les options' : 'Ajouter au panier'}</button></div>
    </div>
    <div class="card-body">
      <span class="card-brand">${esc(p.brand)}</span>
      <a class="card-title" href="/produit/${esc(p.slug)}">${esc(p.name)}</a>
      ${stars(p.rating, p.reviews_count)}
      <div class="price-row"><span class="price">${gnf(p.price)}</span>${d ? `<span class="old-price">${gnf(p.old_price)}</span>` : ''}</div>
      ${p.univers === 'informatique' ? `<label class="compare-check"><input type="checkbox" data-action="compare" data-id="${p.id}" ${cmp ? 'checked' : ''}> Comparer</label>` : ''}
    </div>
  </article>`;
}

const grid = list => `<div class="grid">${remember(list).map(productCard).join('')}</div>`;
const skeletonGrid = n => `<div class="grid">${Array.from({ length: n }, () => '<div class="skeleton sk-card"></div>').join('')}</div>`;
const crumbs = items => `<nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a>${items.map(([label, href]) => ` <span>/</span> ${href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}`).join('')}</nav>`;

const emptyState = (ic, title, text, cta = '<a class="btn btn-primary" href="/boutique">Découvrir la boutique</a>') =>
  `<div class="empty">${icon(ic)}<h3>${title}</h3><p>${text}</p>${cta}</div>`;

// ---------- accueil ----------
route('/', async () => {
  setTitle('');
  setMeta('LENO SHOP, boutique en ligne de matériel informatique et d\'habits à Foula Madina, Conakry. Livraison rapide, paiement Orange Money, MTN MoMo ou à la livraison.');
  const [banners, featured, promos, latest] = await Promise.all([
    api('/api/banners'),
    api('/api/products?featured=1&limit=8'),
    api('/api/products?promo=1&limit=4&sort=populaires'),
    api('/api/products?sort=nouveautes&limit=8')
  ]);
  const cats = univers => state.categories.filter(c => c.univers === univers);
  return `
  <section class="hero container">
    <div class="carousel" data-carousel>
      <div class="slides">
        ${banners.map((b, i) => `<div class="slide ${i === 0 ? 'active' : ''}">
          <img src="${esc(b.image)}" alt="" ${i ? 'loading="lazy"' : ''}>
          <div class="slide-content">
            <span class="eyebrow">LENO SHOP · Foula Madina</span>
            <h1>${esc(b.title)}</h1>
            <p>${esc(b.subtitle)}</p>
            <a class="btn btn-lg" href="${esc(b.link)}">${esc(b.cta)} ${icon('arrow')}</a>
          </div></div>`).join('')}
      </div>
      <button class="car-nav car-prev" data-car="-1" aria-label="Précédent">${icon('left')}</button>
      <button class="car-nav car-next" data-car="1" aria-label="Suivant">${icon('right')}</button>
      <div class="dots">${banners.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" data-dot="${i}" aria-label="Diapositive ${i + 1}"></button>`).join('')}</div>
    </div>
    <div class="perks">
      <div class="perk"><div class="ic">${icon('truck')}</div><div><b>Livraison rapide</b><span>Le jour même à Matoto</span></div></div>
      <div class="perk"><div class="ic">${icon('phone')}</div><div><b>Mobile money</b><span>Orange Money & MTN MoMo</span></div></div>
      <div class="perk"><div class="ic">${icon('shield')}</div><div><b>Produits garantis</b><span>Jusqu'à 12 mois</span></div></div>
      <div class="perk"><div class="ic">${icon('support')}</div><div><b>Conseil WhatsApp</b><span>7 j/7 avec un vendeur</span></div></div>
    </div>
  </section>

  <section class="section container">
    <div class="universes">
      <a class="universe tech reveal" href="/boutique/informatique">
        <svg class="art" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2">${'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>'}</svg>
        <h3>Informatique</h3><p>${UNIVERS.informatique.desc}</p>
        <div class="chip-row">${cats('informatique').slice(0, 4).map(c => `<span>${esc(c.name)}</span>`).join('')}</div>
      </a>
      <a class="universe mode reveal" href="/boutique/mode">
        <svg class="art" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
        <h3>Mode</h3><p>${UNIVERS.mode.desc}</p>
        <div class="chip-row">${cats('mode').slice(0, 4).map(c => `<span>${esc(c.name)}</span>`).join('')}</div>
      </a>
    </div>
  </section>

  <section class="container">
    <div class="section-head"><h2>Nos catégories</h2><a href="/boutique">Tout voir ${icon('arrow')}</a></div>
    <div class="cats">${state.categories.map(c => `<a class="cat ${c.univers} reveal" href="/boutique/${c.univers}/${c.slug}">
      <span class="ic">${icon(c.icon)}</span>${esc(c.name)}<small>${c.count} produit${c.count > 1 ? 's' : ''}</small></a>`).join('')}</div>
  </section>

  <section class="section container">
    <div class="section-head"><h2>Coups de cœur</h2><a href="/boutique?featured=1">Voir plus ${icon('arrow')}</a></div>
    ${grid(featured.items)}
  </section>

  ${promos.items.length ? `<section class="container">
    <div class="section-head"><h2>🔥 Promotions du moment</h2><a href="/boutique?promo=1">Toutes les promos ${icon('arrow')}</a></div>
    ${grid(promos.items)}
  </section>` : ''}

  <section class="section container">
    <div class="section-head"><h2>Nouveautés</h2><a href="/boutique?sort=nouveautes">Voir tout ${icon('arrow')}</a></div>
    ${grid(latest.items)}
  </section>

  <section class="container">
    <div class="newsletter reveal">
      <div><h2>Ne ratez aucune promo</h2><p>Recevez nos ventes flash et nouveautés par WhatsApp ou e-mail. Pas de spam, promis.</p></div>
      <form data-form="newsletter"><input class="input" name="contact" required placeholder="Numéro WhatsApp ou e-mail" aria-label="Numéro WhatsApp ou e-mail"><button class="btn btn-accent">S'inscrire</button></form>
    </div>
  </section>`;
});

// ---------- catalogue ----------
const SORTS = [['', 'Pertinence'], ['populaires', 'Les plus vendus'], ['nouveautes', 'Nouveautés'], ['prix_asc', 'Prix croissant'], ['prix_desc', 'Prix décroissant']];

async function shopView({ params, query }) {
  const univers = UNIVERS[params.univers] ? params.univers : '';
  const category = state.categories.find(c => c.slug === params.category);
  if (params.univers && !univers) throw new Error('Cette page n\'existe pas.');
  const q = new URLSearchParams({ ...query, limit: 12 });
  if (univers) q.set('univers', univers);
  if (category) q.set('category', category.slug);
  const data = await api(`/api/products?${q}`);

  const title = query.q ? `Résultats pour « ${query.q} »` : category ? category.name : univers ? UNIVERS[univers].label : query.promo ? 'Promotions' : 'Toute la boutique';
  setTitle(title);
  setMeta(category ? `${category.name} à Conakry : prix en GNF, livraison rapide et paiement mobile money chez LENO SHOP.` : 'Catalogue LENO SHOP : informatique et mode à Conakry.');

  const base = `/boutique${univers ? '/' + univers : ''}${category ? '/' + category.slug : ''}`;
  const link = (changes) => {
    const u = new URLSearchParams(query);
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null ? u.delete(k) : u.set(k, v)));
    u.delete('page');
    const s = u.toString();
    return base + (s ? '?' + s : '');
  };
  const f = data.facets;
  const catsOf = univers ? state.categories.filter(c => c.univers === univers) : state.categories;
  const selBrands = (query.brand || '').split(',').filter(Boolean);
  const toggleBrand = b => (selBrands.includes(b) ? selBrands.filter(x => x !== b) : [...selBrands, b]).join(',');
  const labels = { q: 'Recherche', brand: 'Marque', size: 'Taille', color: 'Couleur', condition: 'État', min: 'Prix min', max: 'Prix max', promo: 'Promotions', instock: 'En stock', featured: 'Coups de cœur', gender: 'Genre' };
  const active = Object.entries(query).filter(([k]) => labels[k]);

  return `<div class="container">
    ${crumbs([['Boutique', '/boutique'], ...(univers ? [[UNIVERS[univers].label, category ? `/boutique/${univers}` : '']] : []), ...(category ? [[category.name]] : [])])}
    <div class="shop-layout">
      <aside class="filters" id="filters" aria-label="Filtres">
        <div style="display:flex;justify-content:space-between;align-items:center" class="filters-toggle-head">
          <h4 style="margin:0">Univers</h4>
          <button class="icon-btn filters-toggle" data-action="close-filters" aria-label="Fermer les filtres">${icon('x')}</button>
        </div>
        <div class="filter-list" style="margin-top:10px">
          <a href="/boutique" class="${!univers ? 'on' : ''}">Tout</a>
          <a href="/boutique/informatique" class="${univers === 'informatique' && !category ? 'on' : ''}">Informatique</a>
          <a href="/boutique/mode" class="${univers === 'mode' && !category ? 'on' : ''}">Mode</a>
        </div>
        <h4>Catégories</h4>
        <div class="filter-list">${catsOf.map(c => `<a href="/boutique/${c.univers}/${c.slug}${location.search}" class="${category && category.id === c.id ? 'on' : ''}"><span>${esc(c.name)}</span><span class="muted">${c.count}</span></a>`).join('')}</div>
        <h4>Prix (GNF)</h4>
        <form class="price-inputs" data-form="price">
          <input class="input" name="min" type="number" min="0" step="1000" placeholder="${f.minPrice}" value="${esc(query.min || '')}" aria-label="Prix minimum">
          <input class="input" name="max" type="number" min="0" step="1000" placeholder="${f.maxPrice}" value="${esc(query.max || '')}" aria-label="Prix maximum">
          <button class="btn btn-outline btn-sm" style="grid-column:1/-1">Appliquer</button>
        </form>
        ${f.brands.length ? `<h4>Marques</h4><div class="chips">${f.brands.map(b => `<a class="chip ${selBrands.includes(b) ? 'on' : ''}" href="${link({ brand: toggleBrand(b) })}">${esc(b)}</a>`).join('')}</div>` : ''}
        ${f.sizes.length ? `<h4>Tailles</h4><div class="chips">${f.sizes.map(s => `<a class="chip ${query.size === s ? 'on' : ''}" href="${link({ size: query.size === s ? '' : s })}">${esc(s)}</a>`).join('')}</div>` : ''}
        ${f.colors.length ? `<h4>Couleurs</h4><div class="chips">${f.colors.map(s => `<a class="chip ${query.color === s ? 'on' : ''}" href="${link({ color: query.color === s ? '' : s })}">${esc(s)}</a>`).join('')}</div>` : ''}
        ${univers !== 'mode' ? `<h4>État</h4><div class="chips">
          <a class="chip ${query.condition === 'neuf' ? 'on' : ''}" href="${link({ condition: query.condition === 'neuf' ? '' : 'neuf' })}">Neuf</a>
          <a class="chip ${query.condition === 'reconditionné' ? 'on' : ''}" href="${link({ condition: query.condition === 'reconditionné' ? '' : 'reconditionné' })}">Reconditionné</a></div>` : ''}
        <h4>Disponibilité</h4>
        <a class="check" href="${link({ instock: query.instock ? '' : '1' })}"><input type="checkbox" tabindex="-1" ${query.instock ? 'checked' : ''}> En stock uniquement</a>
        <a class="check" href="${link({ promo: query.promo ? '' : '1' })}"><input type="checkbox" tabindex="-1" ${query.promo ? 'checked' : ''}> En promotion</a>
      </aside>
      <section>
        <div class="shop-toolbar">
          <div><h1>${esc(title)}</h1><span class="muted">${data.total} produit${data.total > 1 ? 's' : ''}</span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-outline btn-sm filters-toggle" data-action="open-filters">${icon('filter')} Filtres</button>
            <select class="input" style="height:40px;width:auto" data-action="sort" aria-label="Trier">${SORTS.map(([v, l]) => `<option value="${v}" ${(query.sort || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
        </div>
        ${active.length ? `<div class="active-filters">${active.map(([k, v]) => `<a class="chip" href="${link({ [k]: '' })}">${labels[k]} : ${esc(v === '1' ? 'oui' : v)} ${icon('x')}</a>`).join('')}<a class="chip" href="${base}">Tout effacer</a></div>` : ''}
        ${data.items.length ? grid(data.items) : emptyState('search', 'Aucun produit trouvé', 'Essayez d\'élargir vos filtres ou une autre recherche.', `<a class="btn btn-primary" href="${base}">Réinitialiser les filtres</a>`)}
        ${data.pages > 1 ? `<div class="pagination">${Array.from({ length: data.pages }, (_, i) => i + 1).map(n => `<button class="${n === data.page ? 'on' : ''}" data-page="${n}">${n}</button>`).join('')}</div>` : ''}
      </section>
    </div>
  </div>`;
}
route('/boutique', shopView);
route('/boutique/:univers', shopView);
route('/boutique/:univers/:category', shopView);

// ---------- fiche produit ----------
route('/produit/:slug', async ({ params }) => {
  const p = await api(`/api/products/${encodeURIComponent(params.slug)}`);
  productCache.set(p.id, p);
  remember(p.similar);
  setTitle(p.name);
  setMeta(`${p.name} à ${gnf(p.price)} chez LENO SHOP, Foula Madina. Livraison à Conakry, paiement Orange Money, MTN MoMo ou à la livraison.`);
  const recent = store.get('leno_recent', []).filter(id => id !== p.id);
  store.set('leno_recent', [p.id, ...recent].slice(0, 8));

  const d = discount(p);
  const stockClass = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : '';
  const stockText = p.stock <= 0 ? 'Rupture de stock' : p.stock <= 5 ? `Plus que ${p.stock} en stock` : 'En stock, prêt à être livré';
  const fav = state.wishlist.includes(p.id);
  const shop = state.config.shop;
  const waText = encodeURIComponent(`Bonjour LENO SHOP, je suis intéressé(e) par : ${p.name} (${gnf(p.price)}) ${location.origin}/produit/${p.slug}`);
  const specs = Object.entries(p.specs);
  const cat = state.categories.find(c => c.id === p.category_id);

  return `<div class="container">
    ${crumbs([['Boutique', '/boutique'], [UNIVERS[p.univers].label, `/boutique/${p.univers}`], ...(cat ? [[cat.name, `/boutique/${p.univers}/${cat.slug}`]] : []), [p.name]])}
    <div class="product" data-product="${p.id}">
      <div class="gallery">
        <div class="gallery-main" data-zoom><img src="${esc(p.images[0])}" alt="${esc(p.name)}" id="mainImg"></div>
        ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((src, i) => `<button class="${i === 0 ? 'on' : ''}" data-thumb="${esc(src)}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="p-info">
        <div class="badges" style="position:static;flex-direction:row;margin-bottom:10px">
          ${d ? `<span class="badge promo">-${d}%</span>` : ''}${p.condition === 'reconditionné' ? '<span class="badge refurb">Reconditionné</span>' : ''}
        </div>
        <span class="card-brand">${esc(p.brand)}</span>
        <h1>${esc(p.name)}</h1>
        <div class="p-meta">${stars(p.rating, p.reviews_count) || '<span>Aucun avis pour le moment</span>'}<span>·</span><span>${p.sold} vendus</span>${p.warranty ? `<span>·</span><span>Garantie ${esc(p.warranty)}</span>` : ''}</div>
        <div class="p-price"><span class="price">${gnf(p.price)}</span>${d ? `<span class="old-price">${gnf(p.old_price)}</span><span class="save">Économisez ${gnf(p.old_price - p.price)}</span>` : ''}</div>
        <div class="stock-line ${stockClass}"><span class="dot"></span>${stockText}</div>

        ${p.sizes.length ? `<div class="opt-label"><span>Taille : <b data-sel="size">—</b></span><a href="/faq#tailles" class="muted" style="font-weight:500">Guide des tailles</a></div>
          <div class="opts" data-opt="size">${p.sizes.map(s => `<button class="opt" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        ${p.colors.length ? `<div class="opt-label"><span>Couleur : <b data-sel="color">${p.colors.length === 1 ? esc(p.colors[0]) : '—'}</b></span></div>
          <div class="opts" data-opt="color">${p.colors.map(s => `<button class="opt ${p.colors.length === 1 ? 'on' : ''}" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}

        <div class="opt-label"><span>Quantité</span></div>
        <div class="qty"><button data-q="-1" aria-label="Moins">−</button><input type="number" value="1" min="1" max="${p.stock}" aria-label="Quantité" id="qty"><button data-q="1" aria-label="Plus">+</button></div>

        <div class="buy-row">
          <button class="btn btn-primary btn-lg" data-action="add-product" ${p.stock <= 0 ? 'disabled' : ''}>${icon('bag')} Ajouter au panier</button>
          <button class="btn btn-accent btn-lg" data-action="buy-now" ${p.stock <= 0 ? 'disabled' : ''}>Acheter maintenant</button>
          <button class="icon-btn btn-outline" style="border:1px solid var(--line);width:52px;height:52px" data-action="wish" data-id="${p.id}" aria-label="Favori">${icon('heart', fav ? 'filled' : '')}</button>
        </div>
        <a class="btn btn-outline btn-block" href="https://wa.me/${shop.whatsapp}?text=${waText}" target="_blank" rel="noopener">${waIcon()} Commander ou poser une question sur WhatsApp</a>
        <div class="assurances">
          <div>${icon('truck')} Livraison à Conakry dès 15 000 GNF</div>
          <div>${icon('store')} Retrait gratuit à Foula Madina</div>
          <div>${icon('phone')} Orange Money · MTN MoMo</div>
          <div>${icon('refresh')} ${p.univers === 'mode' ? 'Échange de taille sous 7 jours' : 'Garantie ' + esc(p.warranty || 'constructeur')}</div>
        </div>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button class="on" data-tab="desc">Description</button>
      ${specs.length ? '<button data-tab="specs">Caractéristiques</button>' : ''}
      <button data-tab="reviews">Avis (${p.reviews.length})</button>
      <button data-tab="ship">Livraison & retours</button>
    </div>
    <div data-panel="desc"><p style="max-width:780px">${esc(p.description)}</p></div>
    ${specs.length ? `<div data-panel="specs" hidden><table class="specs" style="max-width:720px">${specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      ${p.condition ? `<tr><td>État</td><td>${esc(p.condition)}</td></tr>` : ''}${p.warranty ? `<tr><td>Garantie</td><td>${esc(p.warranty)}</td></tr>` : ''}</table></div>` : ''}
    <div data-panel="reviews" hidden style="max-width:780px">
      ${p.reviews.length ? p.reviews.map(r => `<div class="review"><div class="review-head"><b>${esc(r.author)}</b>${stars(r.rating)}</div><p class="muted" style="margin:0">${esc(r.comment)}</p></div>`).join('') : '<p class="muted">Soyez le premier à donner votre avis.</p>'}
      <form class="panel" data-form="review" data-id="${p.id}" style="margin-top:20px">
        <h3>Donner mon avis</h3>
        <div class="form-grid">
          <div class="field"><label for="rv-a">Votre nom</label><input class="input" id="rv-a" name="author" required maxlength="60" value="${esc(state.user?.name || '')}"></div>
          <div class="field"><label for="rv-r">Note</label><select class="input" id="rv-r" name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</option>`).join('')}</select></div>
          <div class="field full"><label for="rv-c">Commentaire</label><textarea class="input" id="rv-c" name="comment" maxlength="1000"></textarea></div>
        </div>
        <button class="btn btn-primary">Publier</button>
      </form>
    </div>
    <div data-panel="ship" hidden class="prose">
      <p><b>Livraison :</b> le jour même dans la commune de Matoto (Foula Madina et environs), sous 24 h dans le reste de Conakry, 24 à 48 h pour Coyah et Dubréka. Les frais sont calculés automatiquement selon votre commune.</p>
      <p><b>Retrait en boutique :</b> gratuit, à Foula Madina, sur présentation de votre numéro de commande.</p>
      <p><b>Retours :</b> échange de taille sous 7 jours pour la mode (article non porté, avec étiquette). Matériel informatique couvert par la garantie indiquée.</p>
    </div>

    ${p.similar.length ? `<section class="section"><div class="section-head"><h2>Vous aimerez aussi</h2></div>${grid(p.similar)}</section>` : ''}
  </div>`;
});

// ---------- panier ----------
function summaryBlock({ editable = false } = {}) {
  const sub = cart.subtotal();
  const disc = state.promo ? state.promo.discount : 0;
  return `<div class="totals">
    <div><span>Sous-total (${cart.count()} article${cart.count() > 1 ? 's' : ''})</span><b>${gnf(sub)}</b></div>
    ${disc ? `<div style="color:var(--ok)"><span>Remise ${esc(state.promo.code)} ${editable ? '<button class="link-btn" data-action="remove-promo">retirer</button>' : ''}</span><b>- ${gnf(disc)}</b></div>` : ''}
    <div class="muted"><span>Livraison</span><span data-fee>Calculée à l'étape suivante</span></div>
    <div class="grand"><span>Total</span><span data-total>${gnf(sub - disc)}</span></div>
  </div>`;
}

export function lineItems(editable = true) {
  return state.cart.map(i => `<div class="line-item">
    <a href="/produit/${esc(i.slug)}"><img src="${esc(i.image)}" alt=""></a>
    <div><a class="li-title" href="/produit/${esc(i.slug)}">${esc(i.name)}</a>
      ${i.size || i.color ? `<div class="li-var">${esc([i.size && 'Taille ' + i.size, i.color].filter(Boolean).join(' · '))}</div>` : ''}
      ${editable ? `<div class="li-actions"><div class="qty sm"><button data-cq="-1" data-key="${esc(i.key)}" aria-label="Moins">−</button><input value="${i.qty}" readonly aria-label="Quantité"><button data-cq="1" data-key="${esc(i.key)}" aria-label="Plus">+</button></div>
        <button class="link-btn" data-action="remove-line" data-key="${esc(i.key)}">Retirer</button></div>` : `<div class="li-var">Qté : ${i.qty}</div>`}
    </div>
    <b>${gnf(i.price * i.qty)}</b></div>`).join('');
}

route('/panier', () => {
  setTitle('Mon panier');
  if (!state.cart.length) return `<div class="container">${emptyState('bag', 'Votre panier est vide', 'Parcourez nos catégories et ajoutez vos articles préférés.')}</div>`;
  return `<div class="container">
    ${crumbs([['Panier']])}
    <div class="checkout">
      <div class="panel"><h2>Mon panier</h2>${lineItems(true)}
        <div style="display:flex;justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:10px"><a class="btn btn-ghost" href="/boutique">${icon('left')} Continuer mes achats</a><button class="btn btn-ghost" data-action="clear-cart">${icon('trash')} Vider le panier</button></div>
      </div>
      <aside class="panel summary">
        <h3>Récapitulatif</h3>
        ${state.promo ? '' : `<form class="promo-row" data-form="promo"><input class="input" name="code" placeholder="Code promo" aria-label="Code promo"><button class="btn btn-outline">Appliquer</button></form>`}
        ${summaryBlock({ editable: true })}
        <a class="btn btn-accent btn-lg btn-block" style="margin-top:16px" href="/commande">${icon('lock')} Passer la commande</a>
        <p class="hint" style="text-align:center;margin-top:10px">Paiement Orange Money, MTN MoMo, à la livraison ou en boutique</p>
      </aside>
    </div>
  </div>`;
});

// ---------- commande ----------
route('/commande', () => {
  setTitle('Finaliser ma commande');
  if (!state.cart.length) { setTimeout(() => navigate('/panier', { replace: true })); return ''; }
  const u = state.user || {};
  const last = store.get('leno_customer', {});
  const zones = state.config.zones;
  return `<div class="container">
    ${crumbs([['Panier', '/panier'], ['Commande']])}
    <form class="checkout" data-form="checkout" novalidate>
      <div>
        ${state.user ? '' : `<div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span>Déjà client ? Connectez-vous pour suivre vos commandes facilement.</span><a class="btn btn-outline btn-sm" href="/compte?retour=/commande">Se connecter</a></div>`}
        <div class="panel">
          <h3><span class="step-num">1</span> Vos coordonnées</h3>
          <div class="form-grid">
            <div class="field"><label for="c-name">Nom complet *</label><input class="input" id="c-name" name="name" required autocomplete="name" value="${esc(u.name || last.name || '')}"></div>
            <div class="field"><label for="c-phone">Téléphone *</label><input class="input" id="c-phone" name="phone" required type="tel" inputmode="tel" placeholder="6XX XX XX XX" autocomplete="tel" value="${esc(u.phone || last.phone || '')}"></div>
            <div class="field full"><label for="c-email">E-mail (facultatif)</label><input class="input" id="c-email" name="email" type="email" autocomplete="email" value="${esc(u.email || last.email || '')}"></div>
          </div>
        </div>
        <div class="panel">
          <h3><span class="step-num">2</span> Livraison</h3>
          <div class="choice-grid">
            <label class="choice"><input type="radio" name="mode" value="livraison" checked><span class="pay-logo cash">${icon('truck')}</span><span><b>Livraison à domicile</b><small>Partout à Conakry</small></span></label>
            <label class="choice"><input type="radio" name="mode" value="retrait"><span class="pay-logo shop">${icon('store')}</span><span><b>Retrait en boutique</b><small>Gratuit · Foula Madina</small></span></label>
          </div>
          <div data-delivery style="margin-top:16px">
            <div class="form-grid">
              <div class="field"><label for="c-zone">Commune *</label><select class="input" id="c-zone" name="zone_id"><option value="">Choisir…</option>${zones.map(z => `<option value="${z.id}" ${String(last.zone_id) === String(z.id) ? 'selected' : ''}>${esc(z.commune)} — ${gnf(z.fee)} (${esc(z.delay)})</option>`).join('')}</select></div>
              <div class="field"><label for="c-addr">Quartier, rue ou repère *</label><input class="input" id="c-addr" name="address" placeholder="Ex. Foula Madina, près de la mosquée" value="${esc(last.address || '')}"></div>
            </div>
          </div>
          <div data-pickup hidden class="hint" style="margin-top:12px">${icon('pin')} ${esc(state.config.shop.address)} — ${esc(state.config.shop.hours)}</div>
        </div>
        <div class="panel">
          <h3><span class="step-num">3</span> Paiement</h3>
          <div class="choice-grid">
            <label class="choice"><input type="radio" name="payment" value="orange_money" checked><span class="pay-logo om">OM</span><span><b>Orange Money</b><small>Paiement sécurisé immédiat</small></span></label>
            <label class="choice"><input type="radio" name="payment" value="mtn_momo"><span class="pay-logo mtn">MoMo</span><span><b>MTN Mobile Money</b><small>Paiement sécurisé immédiat</small></span></label>
            <label class="choice" data-pay="livraison"><input type="radio" name="payment" value="livraison"><span class="pay-logo cash">GNF</span><span><b>À la livraison</b><small>Espèces ou mobile money</small></span></label>
            <label class="choice" data-pay="boutique"><input type="radio" name="payment" value="boutique" disabled><span class="pay-logo shop">${icon('store')}</span><span><b>En boutique</b><small>Au moment du retrait</small></span></label>
          </div>
          <div class="field" style="margin-top:16px"><label for="c-note">Note pour la commande (facultatif)</label><textarea class="input" id="c-note" name="note" placeholder="Heure de livraison souhaitée, précisions…" maxlength="500"></textarea></div>
        </div>
      </div>
      <aside class="panel summary">
        <h3>Votre commande</h3>
        ${lineItems(false)}
        ${state.promo ? '' : `<div class="promo-row"><input class="input" name="promo_input" placeholder="Code promo" aria-label="Code promo"><button type="button" class="btn btn-outline" data-action="apply-promo">OK</button></div>`}
        <div style="margin-top:12px">${summaryBlock()}</div>
        <p class="error-text" data-error></p>
        <button class="btn btn-accent btn-lg btn-block" style="margin-top:10px" type="submit">${icon('lock')} Confirmer la commande</button>
        <p class="hint" style="text-align:center;margin-top:10px">En confirmant, vous acceptez nos <a href="/cgv" style="text-decoration:underline">conditions générales de vente</a>.</p>
      </aside>
    </form>
  </div>`;
});

// Paiement mobile money (démonstration) : simule la validation sur le téléphone du client.
export function mobileMoneyFlow(order) {
  return new Promise(resolve => {
    const om = order.payment === 'orange_money';
    const m = modal(`<div style="text-align:center">
      <div class="pay-logo ${om ? 'om' : 'mtn'}" style="width:64px;height:64px;margin:0 auto 14px;font-size:1rem">${om ? 'OM' : 'MoMo'}</div>
      <h3>Paiement ${om ? 'Orange Money' : 'MTN Mobile Money'}</h3>
      <p>Une demande de paiement de <b>${gnf(order.total)}</b> a été envoyée au <b>${esc(order.phone)}</b>.</p>
      <p class="muted">Validez-la sur votre téléphone avec votre code secret${om ? ' (ou composez #144#)' : ' (ou composez *155#)'}.</p>
      <div class="spinner"></div>
      <p class="hint">Mode démonstration : cliquez sur le bouton pour simuler la validation.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-primary" data-pay-ok>J'ai validé le paiement</button>
        <button class="btn btn-ghost" data-close>Payer plus tard</button>
      </div></div>`, { onClose: () => resolve(false) });
    m.el.querySelector('[data-pay-ok]').addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        await api(`/api/orders/${order.code}/pay`, { method: 'POST', body: { phone: order.phone } });
        m.el.remove();
        toast('Paiement reçu, merci !');
        resolve(true);
      } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    });
  });
}

// ---------- confirmation et suivi ----------
const STEPS = ['recue', 'confirmee', 'en_preparation', 'en_livraison', 'livree'];
// Libellés écrits par le serveur dans l'historique d'une commande.
const HISTORY_LABEL = {
  'Commande reçue': 'recue', 'Commande confirmée': 'confirmee', 'En préparation': 'en_preparation',
  'En cours de livraison': 'en_livraison', 'Livrée': 'livree'
};
function timeline(o) {
  if (o.status === 'annulee') return `<p class="status-pill annulee">Commande annulée</p>`;
  const idx = STEPS.indexOf(o.status);
  const steps = o.mode === 'retrait' ? STEPS.filter(s => s !== 'en_livraison') : STEPS;
  const labels = { ...STATUS, livree: o.mode === 'retrait' ? 'Retirée en boutique' : 'Livrée' };
  return `<ul class="timeline">${steps.map(s => {
    const i = STEPS.indexOf(s);
    const h = o.history.find(x => HISTORY_LABEL[x.label] === s);
    return `<li class="${i < idx ? 'done' : i === idx ? (s === 'livree' ? 'done' : 'current') : ''}"><span class="tl-dot"></span><b>${labels[s]}</b>${h ? `<small>${dateFr(h.at)}</small>` : ''}</li>`;
  }).join('')}</ul>`;
}

export function orderDetail(o, { title = true } = {}) {
  return `<div class="checkout" style="padding-top:0">
    <div>
      <div class="panel">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          ${title ? `<h3 style="margin:0">Commande <span class="code-pill">${esc(o.code)}</span></h3>` : ''}
          <span class="status-pill ${o.status}">${STATUS[o.status]}</span>
        </div>
        <p class="muted" style="margin-top:6px">Passée le ${dateFr(o.created_at)}</p>
        ${timeline(o)}
      </div>
      <div class="panel"><h3>Articles</h3>${o.items.map(i => `<div class="line-item" style="grid-template-columns:56px 1fr auto"><img src="${esc(i.image)}" alt="" style="width:56px;height:56px"><div><a class="li-title" href="/produit/${esc(i.slug)}">${esc(i.name)}</a><div class="li-var">${esc([i.size && 'Taille ' + i.size, i.color, 'Qté ' + i.qty].filter(Boolean).join(' · '))}</div></div><b>${gnf(i.price * i.qty)}</b></div>`).join('')}</div>
    </div>
    <aside class="panel summary">
      <h3>Résumé</h3>
      <div class="totals">
        <div><span>Sous-total</span><b>${gnf(o.subtotal)}</b></div>
        ${o.discount ? `<div style="color:var(--ok)"><span>Remise ${esc(o.promo_code || '')}</span><b>- ${gnf(o.discount)}</b></div>` : ''}
        <div><span>Livraison</span><b>${o.delivery_fee ? gnf(o.delivery_fee) : 'Gratuite'}</b></div>
        <div class="grand"><span>Total</span><span>${gnf(o.total)}</span></div>
      </div>
      <div class="info-list">
        <div>${icon(o.mode === 'retrait' ? 'store' : 'truck')}<span><b>${o.mode === 'retrait' ? 'Retrait en boutique' : 'Livraison'}</b><br><span class="muted">${esc(o.commune)}${o.address ? ' — ' + esc(o.address) : ''}</span></span></div>
        <div>${icon('phone')}<span><b>${PAYMENT[o.payment]}</b><br><span class="status-pill ${o.payment_status}">${PAY_STATUS[o.payment_status]}</span></span></div>
      </div>
      ${['orange_money', 'mtn_momo'].includes(o.payment) && o.payment_status === 'en_attente' && o.status !== 'annulee' ? `<button class="btn btn-accent btn-block" data-action="pay-order" data-code="${esc(o.code)}">Payer maintenant</button>` : ''}
      <button class="btn btn-outline btn-block" style="margin-top:8px" data-action="invoice" data-code="${esc(o.code)}">${icon('print')} Facture (imprimer / PDF)</button>
      <a class="btn btn-ghost btn-block" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/${state.config.shop.whatsapp}?text=${encodeURIComponent(`Bonjour LENO SHOP, je vous contacte au sujet de ma commande ${o.code}.`)}">${waIcon()} Contacter la boutique</a>
    </aside>
  </div>`;
}

export const orderCache = new Map();

route('/commande/confirmation/:code', async ({ params }) => {
  setTitle('Commande confirmée');
  const saved = store.get('leno_orders', []).find(o => o.code === params.code);
  const o = await api(`/api/orders/${encodeURIComponent(params.code)}?phone=${encodeURIComponent(saved?.phone || '')}`);
  orderCache.set(o.code, o);
  return `<div class="container">
    <div class="confirm-hero"><div class="ok">${icon('check')}</div>
      <h1>Merci ${esc(o.name.split(' ')[0])} !</h1>
      <p class="muted">Votre commande a bien été enregistrée. Un conseiller LENO SHOP vous appellera pour la confirmer.</p>
      <p>Numéro de commande : <span class="code-pill">${esc(o.code)}</span></p>
    </div>
    ${orderDetail(o, { title: false })}
    <div style="text-align:center;padding-bottom:40px"><a class="btn btn-primary" href="/boutique">Continuer mes achats</a></div>
  </div>`;
});

route('/suivi', async ({ query }) => {
  setTitle('Suivre ma commande');
  let result = '';
  if (query.code && query.phone) {
    try {
      const o = await api(`/api/orders/${encodeURIComponent(query.code.trim().toUpperCase())}?phone=${encodeURIComponent(query.phone)}`);
      orderCache.set(o.code, o);
      result = orderDetail(o);
    } catch (err) { result = `<p class="error-text" style="text-align:center">${esc(err.message)}</p>`; }
  }
  const recent = store.get('leno_orders', []);
  return `<div class="container">
    ${crumbs([['Suivi de commande']])}
    <div class="auth-wrap" style="max-width:620px">
      <div class="panel">
        <h2>${icon('package')} Suivre ma commande</h2>
        <p class="muted">Saisissez votre numéro de commande (ex. LS-261025-A1B2C3) et le téléphone utilisé.</p>
        <form class="form-grid" data-form="track">
          <div class="field"><label for="t-code">N° de commande</label><input class="input" id="t-code" name="code" required value="${esc(query.code || '')}"></div>
          <div class="field"><label for="t-phone">Téléphone</label><input class="input" id="t-phone" name="phone" type="tel" required value="${esc(query.phone || '')}"></div>
          <button class="btn btn-primary full">Rechercher</button>
        </form>
        ${recent.length ? `<p class="hint" style="margin-top:12px">Vos commandes récentes sur cet appareil : ${recent.slice(0, 5).map(o => `<a style="text-decoration:underline" href="/suivi?code=${esc(o.code)}&phone=${encodeURIComponent(o.phone)}">${esc(o.code)}</a>`).join(', ')}</p>` : ''}
      </div>
    </div>
    ${result}
  </div>`;
});

// ---------- compte ----------
route('/compte', async ({ query }) => {
  if (!state.user) {
    setTitle('Connexion');
    const reg = query.mode === 'inscription';
    return `<div class="container"><div class="auth-wrap">
      <div class="panel">
        <div class="logo" style="justify-content:center;margin-bottom:12px"><span class="logo-mark">L</span><span>LENO <b>SHOP</b></span></div>
        <div class="seg"><button class="${reg ? '' : 'on'}" data-seg="connexion">Connexion</button><button class="${reg ? 'on' : ''}" data-seg="inscription">Créer un compte</button></div>
        ${reg ? `<form data-form="register">
          <div class="field"><label for="r-name">Nom complet</label><input class="input" id="r-name" name="name" required autocomplete="name"></div>
          <div class="field"><label for="r-phone">Téléphone</label><input class="input" id="r-phone" name="phone" type="tel" placeholder="6XX XX XX XX" autocomplete="tel"></div>
          <div class="field"><label for="r-email">E-mail</label><input class="input" id="r-email" name="email" type="email" autocomplete="email"><span class="hint">Téléphone ou e-mail obligatoire.</span></div>
          <div class="field"><label for="r-pass">Mot de passe</label><input class="input" id="r-pass" name="password" type="password" required minlength="6" autocomplete="new-password"></div>
          <p class="error-text" data-error></p>
          <button class="btn btn-primary btn-block btn-lg">Créer mon compte</button>
        </form>` : `<form data-form="login">
          <div class="field"><label for="l-login">E-mail ou téléphone</label><input class="input" id="l-login" name="login" required autocomplete="username"></div>
          <div class="field"><label for="l-pass">Mot de passe</label><input class="input" id="l-pass" name="password" type="password" required autocomplete="current-password"></div>
          <p class="error-text" data-error></p>
          <button class="btn btn-primary btn-block btn-lg">Se connecter</button>
        </form>`}
        <p class="hint" style="text-align:center;margin-top:14px">Vous pouvez aussi commander sans compte et <a href="/suivi" style="text-decoration:underline">suivre votre commande</a> avec son numéro.</p>
      </div></div></div>`;
  }
  setTitle('Mon compte');
  const tab = query.onglet || 'commandes';
  const orders = tab === 'commandes' ? await api('/api/me/orders') : [];
  orders.forEach(o => orderCache.set(o.code, o));
  const u = state.user;
  return `<div class="container">
    ${crumbs([['Mon compte']])}
    <div class="account">
      <nav class="side-menu">
        <a href="/compte" class="${tab === 'commandes' ? 'on' : ''}">${icon('package')} Mes commandes</a>
        <a href="/compte?onglet=profil" class="${tab === 'profil' ? 'on' : ''}">${icon('user')} Mon profil</a>
        <a href="/favoris">${icon('heart')} Mes favoris</a>
        ${u.role !== 'client' ? `<a href="/admin" data-external>${icon('settings')} Back-office</a>` : ''}
        <button data-action="logout">${icon('logout')} Déconnexion</button>
      </nav>
      <section>
        <h1 style="font-size:1.6rem">Bonjour ${esc(u.name.split(' ')[0])} 👋</h1>
        ${tab === 'commandes' ? (orders.length ? orders.map(o => `<div class="panel order-card">
            <div><b class="code-pill">${esc(o.code)}</b><div class="muted" style="margin-top:6px">${dateFr(o.created_at)} · ${o.items.reduce((s, i) => s + i.qty, 0)} article(s)</div></div>
            <div class="order-thumbs">${o.items.slice(0, 4).map(i => `<img src="${esc(i.image)}" alt="">`).join('')}</div>
            <div style="text-align:right"><b>${gnf(o.total)}</b><br><span class="status-pill ${o.status}">${STATUS[o.status]}</span></div>
            <a class="btn btn-outline btn-sm" href="/suivi?code=${esc(o.code)}&phone=${encodeURIComponent(o.phone)}">Détails</a>
          </div>`).join('') : `<div class="panel">${emptyState('package', 'Aucune commande', 'Vos commandes apparaîtront ici.')}</div>`) : `
          <div class="panel"><h3>Informations</h3><p>${esc(u.name)}<br><span class="muted">${esc(u.email || '')} ${esc(u.phone || '')}</span></p></div>
          <form class="panel" data-form="password"><h3>Changer de mot de passe</h3>
            <div class="form-grid">
              <div class="field"><label for="p-cur">Mot de passe actuel</label><input class="input" id="p-cur" type="password" name="current" required autocomplete="current-password"></div>
              <div class="field"><label for="p-new">Nouveau mot de passe</label><input class="input" id="p-new" type="password" name="next" required minlength="6" autocomplete="new-password"></div>
            </div><button class="btn btn-primary">Mettre à jour</button></form>`}
      </section>
    </div>
  </div>`;
});

// ---------- favoris et comparateur ----------
route('/favoris', async () => {
  setTitle('Mes favoris');
  if (!state.wishlist.length) return `<div class="container">${crumbs([['Favoris']])}${emptyState('heart', 'Aucun favori', 'Touchez le cœur sur un produit pour le retrouver ici.')}</div>`;
  const data = await api(`/api/products?ids=${state.wishlist.join(',')}&limit=100`);
  return `<div class="container">${crumbs([['Favoris']])}<div class="section-head"><h1>Mes favoris</h1><span class="muted">${data.total} produit(s)</span></div>${grid(data.items)}<div style="height:48px"></div></div>`;
});

route('/comparer', async () => {
  setTitle('Comparer');
  if (state.compare.length < 2) return `<div class="container">${crumbs([['Comparateur']])}${emptyState('compare', 'Sélectionnez au moins 2 produits', 'Cochez « Comparer » sur les fiches informatiques (jusqu\'à 4).', '<a class="btn btn-primary" href="/boutique/informatique">Voir l\'informatique</a>')}</div>`;
  const data = await api(`/api/products?ids=${state.compare.join(',')}&limit=4`);
  const ps = remember(data.items);
  const keys = [...new Set(ps.flatMap(p => Object.keys(p.specs)))];
  const row = (label, fn) => `<tr><th>${label}</th>${ps.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`;
  return `<div class="container">${crumbs([['Comparateur']])}
    <h1>Comparer ${ps.length} produits</h1>
    <div class="table-scroll"><table class="compare-table">
      <tr><th></th>${ps.map(p => `<td><img src="${esc(p.images[0])}" alt="" style="width:140px;border-radius:12px"><a class="card-title" style="margin-top:8px" href="/produit/${esc(p.slug)}">${esc(p.name)}</a><button class="link-btn" data-action="compare-remove" data-id="${p.id}">Retirer</button></td>`).join('')}</tr>
      ${row('Prix', p => `<b class="price">${gnf(p.price)}</b>`)}
      ${row('Marque', p => esc(p.brand))}
      ${row('État', p => esc(p.condition))}
      ${row('Garantie', p => esc(p.warranty || '—'))}
      ${keys.map(k => row(esc(k), p => esc(p.specs[k] || '—'))).join('')}
      ${row('Note', p => stars(p.rating, p.reviews_count) || '—')}
      ${row('Stock', p => (p.stock > 0 ? `${p.stock} disponible(s)` : 'Rupture'))}
      ${row('', p => `<button class="btn btn-primary btn-sm" data-action="quick-add" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Ajouter au panier</button>`)}
    </table></div><div style="height:48px"></div></div>`;
});

// ---------- contact, devis, pages ----------
route('/contact', () => {
  setTitle('Contact');
  const s = state.config.shop;
  return `<div class="container">${crumbs([['Contact']])}
    <h1>Contactez LENO SHOP</h1><p class="muted">Une question sur un produit, une commande ou un devis ? Nous répondons en moins d'une heure aux heures d'ouverture.</p>
    <div class="contact-grid">
      <div>
        <div class="panel">
          <div class="info-list">
            <div>${icon('pin')}<span><b>Boutique</b><br>${esc(s.address)}</span></div>
            <div>${icon('call')}<span><b>Téléphone</b><br><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></span></div>
            <div>${icon('mail')}<span><b>E-mail</b><br><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></span></div>
            <div>${icon('clock')}<span><b>Horaires</b><br>${esc(s.hours)}</span></div>
          </div>
          <a class="btn btn-block" style="background:#25d366;color:#fff" target="_blank" rel="noopener" href="https://wa.me/${s.whatsapp}">${waIcon()} Discuter sur WhatsApp</a>
        </div>
        <form class="panel" data-form="contact"><h3>Envoyer un message</h3>
          <div class="form-grid">
            <div class="field"><label for="ct-n">Nom *</label><input class="input" id="ct-n" name="name" required></div>
            <div class="field"><label for="ct-p">Téléphone</label><input class="input" id="ct-p" name="phone" type="tel"></div>
            <div class="field full"><label for="ct-e">E-mail</label><input class="input" id="ct-e" name="email" type="email"></div>
            <div class="field full"><label for="ct-m">Message *</label><textarea class="input" id="ct-m" name="message" required></textarea></div>
          </div><button class="btn btn-primary">Envoyer</button></form>
      </div>
      <iframe class="map" title="Carte LENO SHOP Foula Madina" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(s.mapQuery)}&output=embed"></iframe>
    </div></div>`;
});

route('/devis', () => {
  setTitle('Demande de devis entreprise');
  return `<div class="container">${crumbs([['Devis entreprise']])}
    <div class="auth-wrap" style="max-width:720px"><form class="panel" data-form="devis">
      <h1 style="font-size:1.6rem">Devis pour entreprises & institutions</h1>
      <p class="muted">Équipement de bureau, parc informatique, tenues d'équipe : recevez une offre personnalisée sous 24 h.</p>
      <div class="form-grid">
        <div class="field"><label for="d-n">Nom du contact *</label><input class="input" id="d-n" name="name" required></div>
        <div class="field"><label for="d-c">Entreprise</label><input class="input" id="d-c" name="company"></div>
        <div class="field"><label for="d-p">Téléphone *</label><input class="input" id="d-p" name="phone" type="tel" required></div>
        <div class="field"><label for="d-e">E-mail</label><input class="input" id="d-e" name="email" type="email"></div>
        <div class="field full"><label for="d-m">Votre besoin *</label><textarea class="input" id="d-m" name="message" required placeholder="Ex. 10 ordinateurs portables Core i5, 2 imprimantes laser, livraison à Kaloum"></textarea></div>
      </div><button class="btn btn-primary btn-lg">Demander mon devis</button></form></div></div>`;
});

route('/a-propos', () => {
  setTitle('À propos');
  return `<div class="container prose">${crumbs([['À propos']])}
    <h1>LENO SHOP, votre boutique à Foula Madina</h1>
    <p>LENO SHOP réunit deux passions sous un même toit : la technologie et la mode. Depuis notre boutique de Foula Madina, dans la commune de Matoto à Conakry, nous proposons du matériel informatique neuf et reconditionné ainsi qu'une sélection de vêtements, chaussures et tenues traditionnelles.</p>
    <h2>Nos engagements</h2>
    <p>Des prix clairs en francs guinéens, des produits testés et garantis, un conseil honnête et une livraison rapide partout à Conakry. Payez comme vous le souhaitez : Orange Money, MTN Mobile Money, à la livraison ou directement en boutique.</p>
    <h2>Venez nous voir</h2>
    <p>${esc(state.config.shop.address)}<br>${esc(state.config.shop.hours)}</p>
    <a class="btn btn-primary" href="/contact">Nous contacter</a></div>`;
});

route('/faq', () => {
  setTitle('Questions fréquentes');
  const faqs = [
    ['Comment passer commande ?', 'Ajoutez vos articles au panier, cliquez sur « Passer la commande », indiquez vos coordonnées, votre commune et votre moyen de paiement. Vous recevez immédiatement un numéro de commande.'],
    ['Quels sont les moyens de paiement ?', 'Orange Money, MTN Mobile Money, paiement à la livraison (espèces ou mobile money) et paiement en boutique lors du retrait.'],
    ['Combien coûte la livraison ?', 'Les frais dépendent de votre commune : à partir de 15 000 GNF dans la commune de Matoto. Le montant exact s\'affiche avant la validation. Le retrait en boutique est gratuit.'],
    ['Quels sont les délais ?', 'Le jour même à Foula Madina et dans la commune de Matoto, sous 24 h dans le reste de Conakry, 24 à 48 h pour Coyah et Dubréka.'],
    ['Les ordinateurs sont-ils garantis ?', 'Oui : 12 mois pour le matériel neuf, 6 mois pour le reconditionné. La garantie est indiquée sur chaque fiche produit.'],
    ['Puis-je échanger un vêtement ?', 'Oui, sous 7 jours en boutique, si l\'article n\'a pas été porté et possède encore son étiquette.'],
    ['Comment choisir ma taille ?', 'Nos tailles suivent les standards européens (S à XXL pour les vêtements, 36 à 46 pour les chaussures). En cas de doute, écrivez-nous sur WhatsApp avec vos mesures.'],
    ['Comment suivre ma commande ?', 'Rendez-vous sur la page « Suivi de commande » avec votre numéro de commande et votre téléphone, ou dans « Mon compte » si vous êtes connecté.']
  ];
  return `<div class="container prose">${crumbs([['FAQ']])}<h1>Questions fréquentes</h1>
    ${faqs.map(([q, a], i) => `<details class="faq" ${i === 6 ? 'id="tailles"' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
    <p style="margin-top:20px">Une autre question ? <a href="/contact" style="color:var(--brand);font-weight:600">Contactez-nous</a>.</p></div>`;
});

route('/cgv', () => {
  setTitle('Conditions générales de vente');
  return `<div class="container prose">${crumbs([['CGV']])}<h1>Conditions générales de vente</h1>
    <p class="muted">Modèle à faire valider par un conseiller juridique avant la mise en ligne.</p>
    <h2>1. Objet</h2><p>Les présentes conditions régissent les ventes réalisées sur le site LENO SHOP, exploité depuis Foula Madina, Conakry, Guinée.</p>
    <h2>2. Prix</h2><p>Les prix sont indiqués en francs guinéens (GNF), toutes taxes comprises. Les frais de livraison sont précisés avant la validation de la commande.</p>
    <h2>3. Commande et paiement</h2><p>La commande est enregistrée à sa validation. Le paiement s'effectue par Orange Money, MTN Mobile Money, à la livraison ou en boutique. Les commandes payables à la livraison peuvent faire l'objet d'une confirmation téléphonique.</p>
    <h2>4. Livraison</h2><p>Les délais sont donnés à titre indicatif selon la commune. Le client vérifie le colis à la réception.</p>
    <h2>5. Retours et garantie</h2><p>Échange des articles de mode sous 7 jours (non portés, étiquette présente). Le matériel informatique bénéficie de la garantie indiquée sur la fiche produit.</p>
    <h2>6. Données personnelles</h2><p>Les données collectées servent uniquement au traitement des commandes et ne sont jamais revendues. Le client peut demander leur suppression à ${esc(state.config.shop.email)}.</p></div>`;
});

setNotFound(() => {
  setTitle('Page introuvable');
  return `<div class="container">${emptyState('search', 'Page introuvable', 'La page demandée n\'existe pas ou a été déplacée.', '<a class="btn btn-primary" href="/">Retour à l\'accueil</a>')}</div>`;
});

export { summaryBlock, UNIVERS, emit };
