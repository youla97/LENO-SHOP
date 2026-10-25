import {
  $, $$, api, esc, gnf, icon, waIcon, state, store, cart, toggleWish, toggleCompare,
  toast, render, navigate, subscribe, emit
} from './core.js';
import { productCache, lineItems, mobileMoneyFlow, orderCache } from './views.js';
import { printInvoice } from './invoice.js';

// ---------- thème ----------
const savedTheme = store.get('leno_theme', null);
const theme = savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;

function shell() {
  const s = state.config.shop;
  $('#topbar').innerHTML = `<div class="container">
    <span class="marquee">🚚 Livraison le jour même à Foula Madina · Paiement Orange Money, MTN MoMo ou à la livraison</span>
    <span class="hide-sm"><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a> · <a href="/suivi">Suivre ma commande</a></span></div>`;
  $('#header').innerHTML = `<div class="container">
    <a class="logo" href="/" aria-label="LENO SHOP, accueil"><span class="logo-mark">L</span><span>LENO <b>SHOP</b></span></a>
    <nav class="nav" aria-label="Navigation principale">
      <a href="/boutique/informatique">Informatique</a><a href="/boutique/mode">Mode</a>
      <a href="/boutique?promo=1">Promos</a><a href="/devis">Entreprises</a><a href="/contact">Contact</a>
    </nav>
    <div class="search" id="search" role="search">
      ${icon('search')}
      <input type="search" id="q" placeholder="Rechercher un ordinateur, une robe, une marque…" autocomplete="off" aria-label="Rechercher">
      <div class="suggest" id="suggest"></div>
    </div>
    <div class="header-actions">
      <button class="icon-btn search-toggle" data-action="toggle-search" aria-label="Rechercher">${icon('search')}</button>
      <button class="icon-btn" data-action="theme" aria-label="Changer de thème">${icon(theme === 'dark' ? 'sun' : 'moon')}</button>
      <a class="icon-btn hide-sm" href="/favoris" aria-label="Favoris">${icon('heart')}<span class="badge-count" data-count="wish"></span></a>
      <a class="icon-btn hide-sm" href="/compte" aria-label="Mon compte">${icon('user')}</a>
      <button class="icon-btn" data-action="open-cart" aria-label="Panier">${icon('bag')}<span class="badge-count" data-count="cart"></span></button>
    </div></div>`;
  $('#bottom-nav').innerHTML = `
    <a href="/" data-nav="/">${icon('home')}Accueil</a>
    <a href="/boutique" data-nav="/boutique">${icon('grid')}Boutique</a>
    <button data-action="open-cart">${icon('bag')}Panier<span class="badge-count" data-count="cart"></span></button>
    <a href="/favoris" data-nav="/favoris">${icon('heart')}Favoris<span class="badge-count" data-count="wish"></span></a>
    <a href="/compte" data-nav="/compte">${icon('user')}Compte</a>`;
  const cats = u => state.categories.filter(c => c.univers === u).map(c => `<a href="/boutique/${u}/${c.slug}">${esc(c.name)}</a>`).join('');
  $('#footer').innerHTML = `<div class="container">
    <div class="footer-grid">
      <div><a class="logo" href="/"><span class="logo-mark">L</span><span>LENO <b>SHOP</b></span></a>
        <p style="color:#94a3b8;font-size:.9rem">${esc(s.slogan)}.</p>
        <p style="color:#94a3b8;font-size:.9rem">${icon('pin')} ${esc(s.address)}<br>${icon('clock')} ${esc(s.hours)}</p>
        <div class="socials"><a href="${esc(s.socials.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook')}</a><a href="${esc(s.socials.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a><a href="${esc(s.socials.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${icon('tiktok')}</a><a href="https://wa.me/${s.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${waIcon()}</a></div>
      </div>
      <div><h4>Informatique</h4>${cats('informatique')}</div>
      <div><h4>Mode</h4>${cats('mode')}</div>
      <div><h4>Aide</h4><a href="/suivi">Suivre ma commande</a><a href="/faq">Questions fréquentes</a><a href="/devis">Devis entreprise</a><a href="/a-propos">À propos</a><a href="/cgv">Conditions générales de vente</a><a href="/contact">Contact</a>
        <div class="pay-badges"><span style="background:#ff7900;color:#fff">Orange Money</span><span style="background:#ffcc00;color:#000">MTN MoMo</span><span>Cash à la livraison</span></div></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} LENO SHOP — Foula Madina, Conakry, Guinée</span><span>Prix en francs guinéens (GNF), TTC</span></div></div>`;
  $('#wa').href = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent('Bonjour LENO SHOP, j\'ai une question.')}`;
  $('#wa').innerHTML = waIcon();
}

// ---------- compteurs, tiroir panier, comparateur ----------
function updateCounts(bump) {
  const set = (name, n) => $$(`[data-count="${name}"]`).forEach(b => {
    b.textContent = n; b.classList.toggle('show', n > 0);
    if (bump === name) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  });
  set('cart', cart.count());
  set('wish', state.wishlist.length);
}

function drawerContent() {
  const body = $('#drawer-body'), foot = $('#drawer-foot');
  if (!state.cart.length) {
    body.innerHTML = `<div class="empty">${icon('bag')}<h3>Votre panier est vide</h3><p>Ajoutez des articles pour commencer.</p></div>`;
    foot.innerHTML = `<a class="btn btn-primary btn-block" href="/boutique" data-action="close-cart">Découvrir la boutique</a>`;
    return;
  }
  body.innerHTML = lineItems(true);
  const disc = state.promo ? state.promo.discount : 0;
  foot.innerHTML = `<div class="totals">
      <div><span>Sous-total</span><b>${gnf(cart.subtotal())}</b></div>
      ${disc ? `<div style="color:var(--ok)"><span>Remise ${esc(state.promo.code)}</span><b>- ${gnf(disc)}</b></div>` : ''}
      <div class="muted"><span>Livraison</span><span>dès ${gnf(Math.min(...state.config.zones.map(z => z.fee)))} · retrait gratuit</span></div>
    </div>
    <a class="btn btn-accent btn-lg btn-block" href="/commande" data-action="close-cart">${icon('lock')} Commander · ${gnf(cart.subtotal() - disc)}</a>
    <a class="btn btn-outline btn-block" href="/panier" data-action="close-cart">Voir le panier</a>`;
}

const openCart = () => { drawerContent(); $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); };
const closeCart = () => { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#filters')?.classList.remove('open'); };

function updateCompareBar() {
  const bar = $('#compare-bar');
  const n = state.compare.length;
  bar.classList.toggle('show', n > 0 && location.pathname !== '/comparer');
  bar.innerHTML = `<span>${icon('compare')} ${n} produit${n > 1 ? 's' : ''} à comparer</span>
    <button class="btn btn-sm btn-ghost" style="color:inherit" data-action="compare-clear">Vider</button>
    <a class="btn btn-sm btn-primary" href="/comparer">Comparer</a>`;
}

// Recalcule le promo si le panier change (le montant de remise dépend du sous-total).
async function refreshPromo() {
  if (!state.promo) return;
  try {
    const r = await api('/api/promo/check', { method: 'POST', body: { code: state.promo.code, subtotal: cart.subtotal() } });
    if (r.discount !== state.promo.discount) { state.promo = r; emit('promo'); }
  } catch { state.promo = null; emit('promo'); toast('Le code promo ne s\'applique plus à ce panier', 'err'); }
}

subscribe(what => {
  updateCounts(what === 'cart' || what === 'wishlist' ? (what === 'cart' ? 'cart' : 'wish') : null);
  if ($('#drawer').classList.contains('open')) drawerContent();
  if (what === 'compare') updateCompareBar();
  if (what === 'cart') refreshPromo();
  if ((what === 'cart' || what === 'promo') && ['/panier', '/commande'].includes(location.pathname)) {
    if (location.pathname === '/panier') render(); else updateCheckoutTotals();
  }
});

// ---------- recherche instantanée ----------
let suggestTimer, suggestIdx = -1;
function setupSearch() {
  const input = $('#q'), box = $('#suggest');
  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const q = input.value.trim();
    if (q.length < 2) { box.classList.remove('open'); return; }
    suggestTimer = setTimeout(async () => {
      const r = await api(`/api/search/suggest?q=${encodeURIComponent(q)}`).catch(() => null);
      if (!r || input.value.trim() !== q) return;
      suggestIdx = -1;
      box.innerHTML = (r.categories.length ? `<div class="s-title">Catégories</div>${r.categories.map(c => `<a href="/boutique/${c.univers}/${c.slug}">${icon('grid')} ${esc(c.name)}</a>`).join('')}` : '')
        + (r.products.length ? `<div class="s-title">Produits</div>${r.products.map(p => `<a href="/produit/${esc(p.slug)}"><img src="${esc(p.image)}" alt=""><span><b style="font-weight:600;font-size:.9rem">${esc(p.name)}</b><br><span class="muted">${gnf(p.price)}</span></span></a>`).join('')}` : '')
        + `<a href="/boutique?q=${encodeURIComponent(q)}" style="color:var(--brand);font-weight:600">${icon('search')} Voir tous les résultats pour « ${esc(q)} »</a>`;
      box.classList.add('open');
    }, 180);
  });
  input.addEventListener('keydown', e => {
    const links = $$('a', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIdx = (suggestIdx + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.classList.toggle('hl', i === suggestIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = links[suggestIdx];
      box.classList.remove('open');
      input.blur();
      navigate(target ? target.getAttribute('href') : `/boutique?q=${encodeURIComponent(input.value.trim())}`);
    } else if (e.key === 'Escape') box.classList.remove('open');
  });
  document.addEventListener('click', e => { if (!e.target.closest('#search')) box.classList.remove('open'); });
}

// ---------- carrousel ----------
let carTimer;
function setupCarousel() {
  clearInterval(carTimer);
  const car = $('[data-carousel]');
  if (!car) return;
  const slides = $$('.slide', car), dots = $$('[data-dot]', car);
  let i = 0;
  const go = n => {
    i = (n + slides.length) % slides.length;
    $('.slides', car).style.transform = `translateX(-${i * 100}%)`;
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  car.go = go; car.cur = () => i;
  carTimer = setInterval(() => go(i + 1), 6000);
  car.addEventListener('mouseenter', () => clearInterval(carTimer));
  car.addEventListener('mouseleave', () => { clearInterval(carTimer); carTimer = setInterval(() => go(i + 1), 6000); });
  let x0 = null;
  car.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  car.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
}

// ---------- apparition au défilement ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -40px' }) : null;
const reveal = () => $$('.reveal:not(.in)').forEach((el, k) => { if (io) { el.style.transitionDelay = `${(k % 4) * 60}ms`; io.observe(el); } else el.classList.add('in'); });

// ---------- commande : totaux dynamiques ----------
function updateCheckoutTotals() {
  const form = $('[data-form="checkout"]');
  if (!form) return;
  const mode = form.mode.value;
  const zone = state.config.zones.find(z => String(z.id) === form.zone_id.value);
  const fee = mode === 'retrait' ? 0 : zone ? zone.fee : null;
  const disc = state.promo ? state.promo.discount : 0;
  const feeEl = $('[data-fee]', form), totalEl = $('[data-total]', form);
  if (feeEl) feeEl.textContent = mode === 'retrait' ? 'Gratuit (retrait)' : fee == null ? 'Choisissez votre commune' : gnf(fee);
  if (totalEl) totalEl.textContent = gnf(cart.subtotal() - disc + (fee || 0));
  $('[data-delivery]', form).hidden = mode === 'retrait';
  $('[data-pickup]', form).hidden = mode !== 'retrait';
  const payShop = $('[data-pay="boutique"] input', form), payCod = $('[data-pay="livraison"] input', form);
  payShop.disabled = mode !== 'retrait';
  payCod.disabled = mode === 'retrait';
  if (form.payment.value === '' || (payShop.disabled && payShop.checked) || (payCod.disabled && payCod.checked)) form.querySelector('input[name="payment"][value="orange_money"]').checked = true;
}

async function applyPromo(code) {
  if (!code) return;
  try {
    state.promo = await api('/api/promo/check', { method: 'POST', body: { code, subtotal: cart.subtotal() } });
    emit('promo');
    toast(`Code ${state.promo.code} appliqué : - ${gnf(state.promo.discount)}`);
    if (location.pathname === '/commande') render();
  } catch (err) { toast(err.message, 'err'); }
}

// ---------- fiche produit : options ----------
function selectedOptions(root) {
  const pick = name => $(`[data-opt="${name}"] .opt.on`, root)?.dataset.val || '';
  return { size: pick('size'), color: pick('color'), qty: Math.max(1, parseInt($('#qty', root)?.value, 10) || 1) };
}

function addFromProductPage(goCheckout) {
  const root = $('[data-product]');
  const p = productCache.get(Number(root.dataset.product));
  const opts = selectedOptions(root);
  if (p.sizes.length && !opts.size) { toast('Choisissez une taille', 'err'); $('[data-opt="size"]').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (p.colors.length > 1 && !opts.color) { toast('Choisissez une couleur', 'err'); return; }
  if (!opts.color && p.colors.length === 1) opts.color = p.colors[0];
  if (cart.add(p, opts)) {
    if (goCheckout) navigate('/commande');
    else { toast('Ajouté au panier'); openCart(); }
  }
}

// ---------- clics ----------
document.addEventListener('click', async e => {
  const a = e.target.closest('a[href]');
  const act = e.target.closest('[data-action]');

  if (act) {
    const id = Number(act.dataset.id);
    switch (act.dataset.action) {
      case 'wish': {
        e.preventDefault();
        const on = toggleWish(id);
        act.classList.toggle('on', on);
        const svg = act.querySelector('.icon');
        if (svg && !act.classList.contains('card-fav')) svg.classList.toggle('filled', on);
        if (location.pathname === '/favoris') render();
        return;
      }
      case 'quick-add': {
        e.preventDefault();
        const p = productCache.get(id);
        if (!p) return;
        if (p.sizes.length || p.colors.length > 1) { navigate(`/produit/${p.slug}`); return; }
        if (cart.add(p, { color: p.colors[0] || '' })) { toast('Ajouté au panier'); openCart(); }
        return;
      }
      case 'add-product': return addFromProductPage(false);
      case 'buy-now': return addFromProductPage(true);
      case 'open-cart': e.preventDefault(); return openCart();
      case 'close-cart': closeCart(); break;
      case 'remove-line': return cart.remove(act.dataset.key);
      case 'clear-cart': if (confirm('Vider le panier ?')) cart.clear(); return;
      case 'remove-promo': state.promo = null; emit('promo'); return;
      case 'apply-promo': return applyPromo($('[name="promo_input"]')?.value.trim());
      case 'theme': {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        store.set('leno_theme', next);
        act.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
        return;
      }
      case 'toggle-search': $('#search').classList.toggle('open'); $('#q').focus(); return;
      case 'open-filters': $('#filters').classList.add('open'); $('#overlay').classList.add('open'); return;
      case 'close-filters': closeCart(); return;
      case 'compare-remove': toggleCompare(id); return render();
      case 'compare-clear': state.compare = []; emit('compare'); $$('[data-action="compare"]').forEach(c => { c.checked = false; }); return;
      case 'logout':
        await api('/api/auth/logout', { method: 'POST' });
        state.user = null; toast('Vous êtes déconnecté'); return navigate('/');
      case 'invoice': {
        const o = orderCache.get(act.dataset.code);
        if (o) printInvoice(o, state.config.shop);
        return;
      }
      case 'pay-order': {
        const o = orderCache.get(act.dataset.code);
        if (o && await mobileMoneyFlow(o)) render();
        return;
      }
    }
  }

  // navigation interne sans rechargement
  if (a && !e.defaultPrevented && a.origin === location.origin && !a.target && !a.hasAttribute('download') && !a.dataset.external
    && !a.pathname.startsWith('/admin') && !a.pathname.startsWith('/uploads') && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    closeCart();
    $('#search')?.classList.remove('open');
    if (a.pathname + a.search !== location.pathname + location.search || a.hash) navigate(a.pathname + a.search + a.hash, { keepScroll: !!a.hash });
    return;
  }

  const t = e.target;
  const car = t.closest('[data-carousel]');
  if (car && t.closest('[data-car]')) return car.go(car.cur() + Number(t.closest('[data-car]').dataset.car));
  if (car && t.closest('[data-dot]')) return car.go(Number(t.closest('[data-dot]').dataset.dot));

  const thumb = t.closest('[data-thumb]');
  if (thumb) { $('#mainImg').src = thumb.dataset.thumb; $$('[data-thumb]').forEach(b => b.classList.toggle('on', b === thumb)); return; }

  const tab = t.closest('[data-tab]');
  if (tab) { $$('[data-tab]').forEach(b => b.classList.toggle('on', b === tab)); $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; }); return; }

  const opt = t.closest('.opt');
  if (opt) {
    const group = opt.closest('[data-opt]');
    $$('.opt', group).forEach(o => o.classList.toggle('on', o === opt));
    const label = $(`[data-sel="${group.dataset.opt}"]`);
    if (label) label.textContent = opt.dataset.val;
    return;
  }

  const qb = t.closest('[data-q]');
  if (qb) { const input = $('#qty'); input.value = Math.max(1, Math.min(Number(input.max) || 99, (parseInt(input.value, 10) || 1) + Number(qb.dataset.q))); return; }

  const cq = t.closest('[data-cq]');
  if (cq) { const line = state.cart.find(i => i.key === cq.dataset.key); if (line) cart.setQty(line.key, line.qty + Number(cq.dataset.cq)); return; }

  const pg = t.closest('[data-page]');
  if (pg) { const u = new URL(location.href); u.searchParams.set('page', pg.dataset.page); return navigate(u.pathname + u.search); }

  const seg = t.closest('[data-seg]');
  if (seg) return navigate(`/compte${seg.dataset.seg === 'inscription' ? '?mode=inscription' : ''}${new URL(location.href).searchParams.get('retour') ? (seg.dataset.seg === 'inscription' ? '&' : '?') + 'retour=' + encodeURIComponent(new URL(location.href).searchParams.get('retour')) : ''}`, { replace: true });
});

$('#overlay').addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-action="sort"]')) {
    const u = new URL(location.href);
    t.value ? u.searchParams.set('sort', t.value) : u.searchParams.delete('sort');
    u.searchParams.delete('page');
    navigate(u.pathname + u.search, { replace: true, keepScroll: true });
  }
  if (t.matches('[data-action="compare"]')) { toggleCompare(Number(t.dataset.id)); t.checked = state.compare.includes(Number(t.dataset.id)); }
  if (t.closest('[data-form="checkout"]') && (t.name === 'mode' || t.name === 'zone_id')) updateCheckoutTotals();
});

// zoom de la photo produit
document.addEventListener('mousemove', e => {
  const z = e.target.closest('[data-zoom]');
  if (!z) return;
  const r = z.getBoundingClientRect();
  z.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
  z.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
});
document.addEventListener('mouseover', e => { const z = e.target.closest('[data-zoom]'); if (z && matchMedia('(hover: hover)').matches) z.classList.add('zoom'); });
document.addEventListener('mouseout', e => { const z = e.target.closest('[data-zoom]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('zoom'); });

// ---------- formulaires ----------
const formData = f => Object.fromEntries(new FormData(f).entries());

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('button[type="submit"], button:not([type])');
  const err = $('[data-error]', f);
  if (err) err.textContent = '';
  const data = formData(f);
  const busy = on => { if (btn) btn.disabled = on; };

  try {
    busy(true);
    switch (f.dataset.form) {
      case 'newsletter':
        await api('/api/messages', { method: 'POST', body: { type: 'contact', name: 'Inscription newsletter', [data.contact.includes('@') ? 'email' : 'phone']: data.contact, message: 'Souhaite recevoir les promotions LENO SHOP.' } });
        f.reset(); toast('Merci ! Vous recevrez nos meilleures offres.'); break;
      case 'price': {
        const u = new URL(location.href);
        ['min', 'max'].forEach(k => (data[k] ? u.searchParams.set(k, data[k]) : u.searchParams.delete(k)));
        u.searchParams.delete('page');
        navigate(u.pathname + u.search, { keepScroll: true }); break;
      }
      case 'review': {
        const r = await api(`/api/products/${f.dataset.id}/reviews`, { method: 'POST', body: data });
        f.reset(); toast(r.message); break;
      }
      case 'promo': await applyPromo(data.code.trim()); break;
      case 'track': navigate(`/suivi?code=${encodeURIComponent(data.code.trim())}&phone=${encodeURIComponent(data.phone.trim())}`); break;
      case 'login':
      case 'register': {
        state.user = await api(`/api/auth/${f.dataset.form}`, { method: 'POST', body: data });
        toast(`Bienvenue ${state.user.name.split(' ')[0]} !`);
        navigate(new URL(location.href).searchParams.get('retour') || '/compte', { replace: true }); break;
      }
      case 'password':
        await api('/api/me/password', { method: 'PUT', body: data });
        f.reset(); toast('Mot de passe mis à jour'); break;
      case 'contact':
      case 'devis':
        await api('/api/messages', { method: 'POST', body: { ...data, type: f.dataset.form } });
        f.reset(); toast(f.dataset.form === 'devis' ? 'Demande envoyée, nous revenons vers vous sous 24 h.' : 'Message envoyé, merci !'); break;
      case 'checkout': {
        const body = {
          ...data, promo: state.promo?.code || '',
          items: state.cart.map(i => ({ id: i.id, qty: i.qty, size: i.size, color: i.color }))
        };
        const order = await api('/api/orders', { method: 'POST', body });
        store.set('leno_customer', { name: data.name, phone: data.phone, email: data.email, zone_id: data.zone_id, address: data.address });
        store.set('leno_orders', [{ code: order.code, phone: order.phone }, ...store.get('leno_orders', [])].slice(0, 20));
        cart.clear();
        if (['orange_money', 'mtn_momo'].includes(order.payment)) await mobileMoneyFlow(order);
        navigate(`/commande/confirmation/${order.code}`, { replace: true }); break;
      }
    }
  } catch (ex) {
    if (err) err.textContent = ex.message;
    toast(ex.message, 'err');
  } finally { busy(false); }
});

// ---------- après chaque rendu ----------
document.addEventListener('page:rendered', () => {
  setupCarousel();
  reveal();
  updateCompareBar();
  updateCheckoutTotals();
  const path = location.pathname;
  $$('.nav a').forEach(a => a.classList.toggle('active', path.startsWith(a.pathname) && a.pathname !== '/' && !a.search));
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === '/' ? path === '/' : path.startsWith(a.dataset.nav)));
  const q = new URL(location.href).searchParams.get('q');
  if ($('#q') && document.activeElement !== $('#q')) $('#q').value = q || '';
});

window.addEventListener('popstate', render);

// ---------- démarrage ----------
(async function boot() {
  try {
    const [config, categories, user] = await Promise.all([api('/api/config'), api('/api/categories'), api('/api/auth/me')]);
    Object.assign(state, { config, categories, user });
  } catch {
    $('#app').innerHTML = `<div class="container empty"><h2>Connexion impossible</h2><p>Vérifiez votre connexion Internet puis rechargez la page.</p></div>`;
    return;
  }
  shell();
  setupSearch();
  updateCounts();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
