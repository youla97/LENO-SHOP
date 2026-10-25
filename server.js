const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config');
const { open, hashPassword, verifyPassword, slugify, UPLOADS } = require('./lib/db');

const db = open({ reset: process.argv.includes('--reset') });
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob: https://images.unsplash.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-src https://www.google.com https://maps.google.com",
    "script-src 'self'",
    "connect-src 'self'"
  ].join('; ')
};

const ORDER_STATUS = ['recue', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee'];
const PAYMENT_STATUS = ['en_attente', 'paye', 'rembourse'];
const PAYMENTS = ['orange_money', 'mtn_momo', 'livraison', 'boutique'];
const ROLES = ['client', 'admin', 'vendeur', 'stock', 'livreur'];

// ---------- utilitaires ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body) || typeof body === 'string';
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isBuf ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers
  });
  res.end(isBuf ? body : JSON.stringify(body));
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Fichier trop volumineux')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Requête invalide')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function currentUser(req) {
  const token = parseCookies(req).leno_session;
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at > datetime('now', '-30 days')`).get(token) || null;
}

function sessionCookie(token, maxAge) {
  return `leno_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function requireRole(req, roles) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Connexion requise');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'Accès refusé');
  return user;
}

// Photos acceptées : fichiers envoyés sur le site, ou photos Unsplash (autorisées par la politique de sécurité).
const IMAGE_HOSTS = ['https://images.unsplash.com/'];
const isImageUrl = u => typeof u === 'string' && u.length < 600 && (u.startsWith('/uploads/') || IMAGE_HOSTS.some(h => u.startsWith(h)));

const str = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));
const int = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
const digits = v => String(v || '').replace(/\D/g, '');

function mapProduct(p) {
  if (!p) return p;
  return {
    ...p,
    images: JSON.parse(p.images || '[]'),
    specs: JSON.parse(p.specs || '{}'),
    sizes: JSON.parse(p.sizes || '[]'),
    colors: JSON.parse(p.colors || '[]'),
    featured: !!p.featured,
    active: !!p.active,
    rating: p.rating ? Math.round(p.rating * 10) / 10 : null,
    reviews_count: p.reviews_count || 0
  };
}

function mapOrder(o) {
  if (!o) return o;
  return { ...o, items: JSON.parse(o.items), history: JSON.parse(o.history) };
}

const PRODUCT_SELECT = `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
  (SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id AND r.approved = 1) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.approved = 1) AS reviews_count
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

// Construit la requête catalogue à partir des filtres de l'URL.
function productQuery(q, { admin = false } = {}) {
  const where = [];
  const params = [];
  if (!admin) where.push('p.active = 1');
  if (q.univers) { where.push('p.univers = ?'); params.push(q.univers); }
  if (q.category) { where.push('c.slug = ?'); params.push(q.category); }
  if (q.q) {
    const term = `%${q.q.toLowerCase()}%`;
    where.push('(lower(p.name) LIKE ? OR lower(p.brand) LIKE ? OR lower(c.name) LIKE ? OR lower(p.description) LIKE ?)');
    params.push(term, term, term, term);
  }
  if (q.min) { where.push('p.price >= ?'); params.push(int(q.min)); }
  if (q.max) { where.push('p.price <= ?'); params.push(int(q.max)); }
  if (q.brand) {
    const brands = q.brand.split(',').filter(Boolean);
    where.push(`p.brand IN (${brands.map(() => '?').join(',')})`); params.push(...brands);
  }
  if (q.size) { where.push('EXISTS (SELECT 1 FROM json_each(p.sizes) WHERE value = ?)'); params.push(q.size); }
  if (q.color) { where.push('EXISTS (SELECT 1 FROM json_each(p.colors) WHERE value = ?)'); params.push(q.color); }
  if (q.condition) { where.push('p.condition = ?'); params.push(q.condition); }
  if (q.gender) { where.push('p.gender = ?'); params.push(q.gender); }
  if (q.ids) {
    const ids = q.ids.split(',').map(n => int(n)).filter(Boolean).slice(0, 100);
    where.push(ids.length ? `p.id IN (${ids.map(() => '?').join(',')})` : '0'); params.push(...ids);
  }
  if (q.promo === '1') where.push('p.old_price IS NOT NULL AND p.old_price > p.price');
  if (q.featured === '1') where.push('p.featured = 1');
  if (q.instock === '1') where.push('p.stock > 0');
  if (admin && q.lowstock === '1') where.push('p.stock <= 5');

  const sorts = {
    nouveautes: 'p.created_at DESC, p.id DESC',
    prix_asc: 'p.price ASC',
    prix_desc: 'p.price DESC',
    populaires: 'p.sold DESC',
    nom: 'p.name ASC'
  };
  const order = sorts[q.sort] || 'p.featured DESC, p.sold DESC';
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params, order };
}

function listProducts(q, opts) {
  const { whereSql, params, order } = productQuery(q, opts);
  const limit = Math.min(Math.max(int(q.limit, 12), 1), 100);
  const page = Math.max(int(q.page, 1), 1);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`).get(...params).n;
  const items = db.prepare(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit).map(mapProduct);

  // Facettes calculées sur l'univers / la catégorie courante (sans les autres filtres).
  const base = productQuery({ univers: q.univers, category: q.category, q: q.q }, opts);
  const all = db.prepare(`SELECT p.brand, p.sizes, p.colors, p.price FROM products p LEFT JOIN categories c ON c.id = p.category_id ${base.whereSql}`).all(...base.params);
  const uniq = arr => [...new Set(arr)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const facets = {
    brands: uniq(all.map(r => r.brand)),
    sizes: uniq(all.flatMap(r => JSON.parse(r.sizes))),
    colors: uniq(all.flatMap(r => JSON.parse(r.colors))),
    minPrice: all.length ? Math.min(...all.map(r => r.price)) : 0,
    maxPrice: all.length ? Math.max(...all.map(r => r.price)) : 0
  };
  return { items, total, page, pages: Math.max(Math.ceil(total / limit), 1), facets };
}

function orderCode() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `LS-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function computePromo(code, subtotal) {
  if (!code) return { discount: 0, promo: null };
  const promo = db.prepare("SELECT * FROM promos WHERE code = ? AND active = 1 AND (expires IS NULL OR expires = '' OR expires >= date('now'))").get(code.toUpperCase());
  if (!promo) throw new HttpError(400, 'Code promo invalide ou expiré');
  if (subtotal < promo.min_total) throw new HttpError(400, `Ce code est valable dès ${promo.min_total.toLocaleString('fr-FR')} GNF d'achat`);
  const discount = promo.type === 'percent' ? Math.round(subtotal * promo.value / 100) : Math.min(promo.value, subtotal);
  return { discount, promo };
}

function addHistory(order, label) {
  const history = JSON.parse(order.history || '[]');
  history.push({ at: new Date().toISOString(), label });
  return JSON.stringify(history);
}

const STATUS_LABEL = {
  recue: 'Commande reçue', confirmee: 'Commande confirmée', en_preparation: 'En préparation',
  en_livraison: 'En cours de livraison', livree: 'Livrée', annulee: 'Annulée'
};

// Tentatives de connexion par IP (anti force brute).
const loginAttempts = new Map();
function checkLoginRate(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, since: now };
  if (now - entry.since > 15 * 60 * 1000) { entry.count = 0; entry.since = now; }
  entry.count += 1;
  loginAttempts.set(ip, entry);
  if (entry.count > 10) throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

// --- public ---
route('GET', '/api/config', () => ({
  shop: config.shop,
  zones: db.prepare('SELECT * FROM zones ORDER BY fee').all()
}));

route('GET', '/api/categories', () => db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS count
  FROM categories c ORDER BY c.univers, c.sort`).all());

route('GET', '/api/banners', () => db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY sort').all());

route('GET', '/api/products', ({ query }) => listProducts(query));

route('GET', '/api/products/:slug', ({ params }) => {
  const p = mapProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`).get(params.slug));
  if (!p) throw new HttpError(404, 'Produit introuvable');
  p.reviews = db.prepare('SELECT id, author, rating, comment, created_at FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC').all(p.id);
  p.similar = db.prepare(`${PRODUCT_SELECT} WHERE p.category_id = ? AND p.id != ? AND p.active = 1 ORDER BY p.sold DESC LIMIT 4`).all(p.category_id, p.id).map(mapProduct);
  return p;
});

route('GET', '/api/search/suggest', ({ query }) => {
  const q = str(query.q, 60).toLowerCase();
  if (q.length < 2) return { products: [], categories: [] };
  const term = `%${q}%`;
  return {
    products: db.prepare(`SELECT p.name, p.slug, p.price, p.images FROM products p WHERE p.active = 1 AND (lower(p.name) LIKE ? OR lower(p.brand) LIKE ?) ORDER BY p.sold DESC LIMIT 6`)
      .all(term, term).map(p => ({ ...p, image: JSON.parse(p.images)[0] })),
    categories: db.prepare('SELECT name, slug, univers FROM categories WHERE lower(name) LIKE ? LIMIT 3').all(term)
  };
});

route('POST', '/api/products/:id/reviews', async ({ params, body }) => {
  const rating = int(body.rating);
  const author = str(body.author, 60);
  if (!author || rating < 1 || rating > 5) throw new HttpError(400, 'Nom et note (1 à 5) obligatoires');
  db.prepare('INSERT INTO reviews (product_id, author, rating, comment) VALUES (?, ?, ?, ?)').run(int(params.id), author, rating, str(body.comment, 1000));
  return { ok: true, message: 'Merci ! Votre avis sera publié après validation.' };
});

route('POST', '/api/promo/check', ({ body }) => {
  const { discount, promo } = computePromo(str(body.code, 40), int(body.subtotal));
  return { code: promo.code, discount, type: promo.type, value: promo.value };
});

route('POST', '/api/orders', ({ body, user }) => {
  const name = str(body.name, 100);
  const phone = str(body.phone, 30);
  const mode = body.mode === 'retrait' ? 'retrait' : 'livraison';
  const payment = PAYMENTS.includes(body.payment) ? body.payment : null;
  if (!name || digits(phone).length < 8) throw new HttpError(400, 'Nom et numéro de téléphone valides obligatoires');
  if (!payment) throw new HttpError(400, 'Choisissez un moyen de paiement');
  if (mode === 'retrait' && payment === 'livraison') throw new HttpError(400, 'Pour un retrait, choisissez le paiement en boutique ou mobile money');
  if (mode === 'livraison' && payment === 'boutique') throw new HttpError(400, 'Le paiement en boutique est réservé au retrait');
  if (!Array.isArray(body.items) || !body.items.length) throw new HttpError(400, 'Votre panier est vide');

  let zone = null;
  if (mode === 'livraison') {
    zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(int(body.zone_id));
    if (!zone) throw new HttpError(400, 'Choisissez votre commune de livraison');
    if (!str(body.address)) throw new HttpError(400, 'Indiquez votre adresse ou un repère (quartier, rue, point connu)');
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const items = body.items.slice(0, 50).map(it => {
    const p = getProduct.get(int(it.id));
    if (!p) throw new HttpError(400, 'Un produit du panier n\'est plus disponible');
    const qty = Math.max(1, Math.min(int(it.qty, 1), 99));
    if (p.stock < qty) throw new HttpError(409, `Stock insuffisant pour « ${p.name} » (reste ${p.stock})`);
    return { id: p.id, name: p.name, slug: p.slug, price: p.price, qty, size: str(it.size, 20), color: str(it.color, 40), image: JSON.parse(p.images)[0] };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const { discount, promo } = computePromo(str(body.promo, 40), subtotal);
  const delivery_fee = zone ? zone.fee : 0;
  const total = subtotal - discount + delivery_fee;
  const code = orderCode();
  const history = JSON.stringify([{ at: new Date().toISOString(), label: STATUS_LABEL.recue }]);

  db.exec('BEGIN');
  try {
    const dec = db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ? AND stock >= ?');
    const move = db.prepare('INSERT INTO stock_moves (product_id, delta, reason) VALUES (?, ?, ?)');
    for (const it of items) {
      if (dec.run(it.qty, it.qty, it.id, it.qty).changes !== 1) throw new HttpError(409, `Stock insuffisant pour « ${it.name} »`);
      move.run(it.id, -it.qty, `Commande ${code}`);
    }
    db.prepare(`INSERT INTO orders (code, user_id, name, phone, email, mode, zone_id, commune, address, note, payment, items, subtotal, discount, delivery_fee, total, promo_code, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(code, user ? user.id : null, name, phone, str(body.email, 120), mode, zone ? zone.id : null, zone ? zone.commune : 'Retrait en boutique',
        str(body.address), str(body.note, 500), payment, JSON.stringify(items), subtotal, discount, delivery_fee, total, promo ? promo.code : null, history);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return mapOrder(db.prepare('SELECT * FROM orders WHERE code = ?').get(code));
});

route('GET', '/api/orders/:code', ({ params, query, user }) => {
  const o = db.prepare('SELECT * FROM orders WHERE code = ?').get(str(params.code, 30).toUpperCase());
  const owner = o && user && (o.user_id === user.id || user.role !== 'client');
  if (!o || (!owner && digits(o.phone).slice(-8) !== digits(query.phone).slice(-8))) {
    throw new HttpError(404, 'Commande introuvable. Vérifiez le numéro de commande et le téléphone.');
  }
  return mapOrder(o);
});

// Paiement mobile money en mode démonstration : à remplacer par l'API de l'opérateur ou de l'agrégateur.
route('POST', '/api/orders/:code/pay', ({ params, body }) => {
  const o = db.prepare('SELECT * FROM orders WHERE code = ?').get(str(params.code, 30));
  if (!o || digits(o.phone).slice(-8) !== digits(body.phone).slice(-8)) throw new HttpError(404, 'Commande introuvable');
  if (!['orange_money', 'mtn_momo'].includes(o.payment)) throw new HttpError(400, 'Cette commande n\'est pas payée par mobile money');
  if (o.payment_status === 'paye') return mapOrder(o);
  const label = o.payment === 'orange_money' ? 'Paiement Orange Money reçu' : 'Paiement MTN MoMo reçu';
  db.prepare("UPDATE orders SET payment_status = 'paye', history = ? WHERE id = ?").run(addHistory(o, label), o.id);
  return mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id));
});

route('POST', '/api/messages', ({ body }) => {
  const name = str(body.name, 100);
  const message = str(body.message, 3000);
  if (!name || !message || (!str(body.phone) && !str(body.email))) throw new HttpError(400, 'Nom, message et téléphone ou e-mail obligatoires');
  db.prepare('INSERT INTO messages (type, name, phone, email, company, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(body.type === 'devis' ? 'devis' : 'contact', name, str(body.phone, 30), str(body.email, 120), str(body.company, 120), message);
  return { ok: true };
});

// --- comptes ---
route('POST', '/api/auth/register', ({ body, res }) => {
  const name = str(body.name, 100);
  const email = str(body.email, 120).toLowerCase() || null;
  const phone = digits(body.phone) || null;
  const password = String(body.password || '');
  if (!name || (!email && !phone)) throw new HttpError(400, 'Nom et e-mail ou téléphone obligatoires');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse e-mail invalide');
  if (password.length < 6) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères');
  if (email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
  if (phone && db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) throw new HttpError(409, 'Un compte existe déjà avec ce numéro');
  const id = db.prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)').run(name, email, phone, hashPassword(password)).lastInsertRowid;
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, id);
  res.setHeader('Set-Cookie', sessionCookie(token, 30 * 86400));
  return db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(id);
});

route('POST', '/api/auth/login', ({ body, res, req }) => {
  checkLoginRate(req.socket.remoteAddress);
  const login = str(body.login, 120).toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(login, digits(login) || '-');
  if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) throw new HttpError(401, 'Identifiants incorrects');
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, u.id);
  res.setHeader('Set-Cookie', sessionCookie(token, 30 * 86400));
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
});

route('POST', '/api/auth/logout', ({ req, res }) => {
  const token = parseCookies(req).leno_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return { ok: true };
});

route('GET', '/api/auth/me', ({ user }) => user);

route('GET', '/api/me/orders', ({ req }) => {
  const u = requireRole(req);
  return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id).map(mapOrder);
});

route('PUT', '/api/me/password', ({ req, body }) => {
  const u = requireRole(req);
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(u.id);
  if (!verifyPassword(String(body.current || ''), row.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect');
  if (String(body.next || '').length < 6) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 6 caractères');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.next)), u.id);
  return { ok: true };
});

// --- administration ---
const STAFF = ['admin', 'vendeur', 'stock', 'livreur'];
const admin = (method, pattern, roles, handler) => route(method, pattern, ctx => {
  ctx.staff = requireRole(ctx.req, roles);
  return handler(ctx);
});

admin('GET', '/api/admin/stats', STAFF, () => {
  const sum = (where) => db.prepare(`SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS n FROM orders WHERE status != 'annulee' AND ${where}`).get();
  const days = db.prepare(`SELECT date(created_at) AS d, COALESCE(SUM(total),0) AS total, COUNT(*) AS n FROM orders
    WHERE status != 'annulee' AND created_at >= date('now','-13 days') GROUP BY d`).all();
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    const row = days.find(r => r.d === d);
    return { date: d, total: row ? row.total : 0, orders: row ? row.n : 0 };
  });
  return {
    today: sum("date(created_at) = date('now')"),
    week: sum("created_at >= date('now','-6 days')"),
    month: sum("created_at >= date('now','start of month')"),
    pending: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('recue','confirmee','en_preparation')").get().n,
    customers: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client'").get().n,
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    lowStock: db.prepare('SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock LIMIT 8').all(),
    topProducts: db.prepare('SELECT id, name, sold, price FROM products ORDER BY sold DESC LIMIT 5').all(),
    byUnivers: db.prepare(`SELECT p.univers, SUM(j.value ->> '$.qty' * (j.value ->> '$.price')) AS total
      FROM orders o, json_each(o.items) j JOIN products p ON p.id = j.value ->> '$.id' WHERE o.status != 'annulee' GROUP BY p.univers`).all(),
    recentOrders: db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6').all().map(mapOrder),
    unreadMessages: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').get().n,
    pendingReviews: db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE approved = 0').get().n,
    series
  };
});

admin('GET', '/api/admin/products', ['admin', 'vendeur', 'stock'], ({ query }) => listProducts({ ...query, limit: query.limit || 50 }, { admin: true }));

function productFromBody(body) {
  const name = str(body.name, 200);
  const price = int(body.price);
  if (!name || price <= 0) throw new HttpError(400, 'Nom et prix obligatoires');
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(int(body.category_id));
  if (!cat) throw new HttpError(400, 'Catégorie obligatoire');
  const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => str(s, 40)).filter(Boolean);
  const specs = {};
  if (body.specs && typeof body.specs === 'object') for (const [k, v] of Object.entries(body.specs)) if (str(k) && str(v)) specs[str(k, 60)] = str(v, 200);
  const images = (Array.isArray(body.images) ? body.images : []).filter(isImageUrl).slice(0, 8);
  return {
    univers: cat.univers, category_id: cat.id, name, brand: str(body.brand, 80), description: str(body.description, 5000),
    price, old_price: int(body.old_price) > price ? int(body.old_price) : null, stock: Math.max(0, int(body.stock)),
    images: JSON.stringify(images), specs: JSON.stringify(specs), sizes: JSON.stringify(list(body.sizes)), colors: JSON.stringify(list(body.colors)),
    condition: body.condition === 'reconditionné' ? 'reconditionné' : 'neuf', gender: str(body.gender, 20), warranty: str(body.warranty, 60),
    featured: body.featured ? 1 : 0, active: body.active === false ? 0 : 1
  };
}

function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name) || 'produit';
  let slug = base, i = 2;
  while (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, exceptId)) slug = `${base}-${i++}`;
  return slug;
}

admin('GET', '/api/admin/products/:id', ['admin', 'vendeur', 'stock'], ({ params }) => {
  const p = mapProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(int(params.id)));
  if (!p) throw new HttpError(404, 'Produit introuvable');
  p.moves = db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 20').all(p.id);
  return p;
});

admin('POST', '/api/admin/products', ['admin', 'vendeur'], ({ body }) => {
  const d = productFromBody(body);
  const cols = Object.keys(d);
  const id = db.prepare(`INSERT INTO products (${cols.join(',')}, slug) VALUES (${cols.map(() => '?').join(',')}, ?)`)
    .run(...Object.values(d), uniqueSlug(d.name)).lastInsertRowid;
  if (d.stock) db.prepare('INSERT INTO stock_moves (product_id, delta, reason) VALUES (?, ?, ?)').run(id, d.stock, 'Stock initial');
  return mapProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id));
});

admin('PUT', '/api/admin/products/:id', ['admin', 'vendeur'], ({ params, body }) => {
  const id = int(params.id);
  const old = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!old) throw new HttpError(404, 'Produit introuvable');
  const d = productFromBody(body);
  db.prepare(`UPDATE products SET ${Object.keys(d).map(k => `${k} = ?`).join(', ')}, slug = ? WHERE id = ?`)
    .run(...Object.values(d), old.name === d.name ? old.slug : uniqueSlug(d.name, id), id);
  if (d.stock !== old.stock) db.prepare('INSERT INTO stock_moves (product_id, delta, reason) VALUES (?, ?, ?)').run(id, d.stock - old.stock, 'Ajustement manuel');
  return mapProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id));
});

admin('PUT', '/api/admin/products/:id/stock', ['admin', 'vendeur', 'stock'], ({ params, body }) => {
  const id = int(params.id);
  const delta = int(body.delta);
  const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(id);
  if (!p) throw new HttpError(404, 'Produit introuvable');
  if (p.stock + delta < 0) throw new HttpError(400, 'Le stock ne peut pas être négatif');
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, id);
  db.prepare('INSERT INTO stock_moves (product_id, delta, reason) VALUES (?, ?, ?)').run(id, delta, str(body.reason, 120) || (delta > 0 ? 'Réapprovisionnement' : 'Sortie de stock'));
  return { stock: p.stock + delta };
});

admin('DELETE', '/api/admin/products/:id', ['admin'], ({ params }) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(int(params.id));
  return { ok: true };
});

admin('POST', '/api/admin/upload', ['admin', 'vendeur'], ({ body }) => {
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/.exec(String(body.data || ''));
  if (!m) throw new HttpError(400, 'Formats acceptés : JPG, PNG, WEBP, GIF');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new HttpError(413, 'Image trop lourde (5 Mo maximum)');
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.mkdirSync(path.join(UPLOADS, 'products'), { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, 'products', name), buf);
  return { url: `/uploads/products/${name}` };
});

admin('GET', '/api/admin/categories', STAFF, () => db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count FROM categories c ORDER BY c.univers, c.sort`).all());
admin('POST', '/api/admin/categories', ['admin'], ({ body }) => {
  const name = str(body.name, 80);
  if (!name || !['informatique', 'mode'].includes(body.univers)) throw new HttpError(400, 'Nom et univers obligatoires');
  let slug = slugify(name), i = 2;
  while (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) slug = `${slugify(name)}-${i++}`;
  const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS s FROM categories').get().s;
  return { id: db.prepare('INSERT INTO categories (univers, name, slug, icon, sort) VALUES (?, ?, ?, ?, ?)').run(body.univers, name, slug, str(body.icon, 30) || 'tshirt', sort).lastInsertRowid };
});
admin('PUT', '/api/admin/categories/:id', ['admin'], ({ params, body }) => {
  db.prepare('UPDATE categories SET name = ?, sort = ? WHERE id = ?').run(str(body.name, 80), int(body.sort), int(params.id));
  return { ok: true };
});
admin('DELETE', '/api/admin/categories/:id', ['admin'], ({ params }) => {
  if (db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(int(params.id)).n) throw new HttpError(400, 'Déplacez d\'abord les produits de cette catégorie');
  db.prepare('DELETE FROM categories WHERE id = ?').run(int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/orders', STAFF, ({ query }) => {
  const where = [], params = [];
  if (query.status) { where.push('status = ?'); params.push(query.status); }
  if (query.payment_status) { where.push('payment_status = ?'); params.push(query.payment_status); }
  if (query.q) { where.push('(code LIKE ? OR name LIKE ? OR phone LIKE ?)'); const t = `%${query.q}%`; params.push(t, t, t); }
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM orders ${sql} ORDER BY id DESC LIMIT 200`).all(...params).map(mapOrder);
});

admin('PUT', '/api/admin/orders/:id', STAFF, ({ params, body, staff }) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(params.id));
  if (!o) throw new HttpError(404, 'Commande introuvable');
  let { status, payment_status, history } = o;
  if (body.status && body.status !== o.status) {
    if (!ORDER_STATUS.includes(body.status)) throw new HttpError(400, 'Statut inconnu');
    if (staff.role === 'livreur' && !['en_livraison', 'livree'].includes(body.status)) throw new HttpError(403, 'Action non autorisée');
    if (o.status === 'annulee') throw new HttpError(400, 'Une commande annulée ne peut plus changer de statut');
    if (body.status === 'annulee') {
      const restock = db.prepare('UPDATE products SET stock = stock + ?, sold = MAX(sold - ?, 0) WHERE id = ?');
      const move = db.prepare('INSERT INTO stock_moves (product_id, delta, reason) VALUES (?, ?, ?)');
      for (const it of JSON.parse(o.items)) {
        if (restock.run(it.qty, it.qty, it.id).changes) move.run(it.id, it.qty, `Annulation ${o.code}`);
      }
    }
    status = body.status;
    history = addHistory({ history }, STATUS_LABEL[status]);
  }
  if (body.payment_status && body.payment_status !== o.payment_status) {
    if (!PAYMENT_STATUS.includes(body.payment_status)) throw new HttpError(400, 'Statut de paiement inconnu');
    payment_status = body.payment_status;
    history = addHistory({ history }, payment_status === 'paye' ? 'Paiement encaissé' : payment_status === 'rembourse' ? 'Commande remboursée' : 'Paiement en attente');
  }
  db.prepare('UPDATE orders SET status = ?, payment_status = ?, history = ? WHERE id = ?').run(status, payment_status, history, o.id);
  return mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id));
});

admin('GET', '/api/admin/customers', ['admin', 'vendeur'], () => db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
  (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status != 'annulee') AS spent
  FROM users u ORDER BY u.id DESC`).all());

admin('POST', '/api/admin/users', ['admin'], ({ body }) => {
  const role = ROLES.includes(body.role) ? body.role : 'vendeur';
  const email = str(body.email, 120).toLowerCase();
  if (!str(body.name) || !email || String(body.password || '').length < 8) throw new HttpError(400, 'Nom, e-mail et mot de passe (8 caractères min.) obligatoires');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'E-mail déjà utilisé');
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(str(body.name, 100), email, hashPassword(String(body.password)), role);
  return { ok: true };
});

admin('PUT', '/api/admin/users/:id', ['admin'], ({ params, body, staff }) => {
  if (int(params.id) === staff.id) throw new HttpError(400, 'Vous ne pouvez pas modifier votre propre rôle');
  if (!ROLES.includes(body.role)) throw new HttpError(400, 'Rôle inconnu');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/promos', ['admin', 'vendeur'], () => db.prepare('SELECT * FROM promos ORDER BY code').all());
admin('POST', '/api/admin/promos', ['admin'], ({ body }) => {
  const code = str(body.code, 40).toUpperCase().replace(/\s+/g, '');
  if (!code || !['percent', 'amount'].includes(body.type) || int(body.value) <= 0) throw new HttpError(400, 'Code, type et valeur obligatoires');
  if (body.type === 'percent' && int(body.value) > 90) throw new HttpError(400, 'Réduction maximale : 90 %');
  db.prepare('INSERT OR REPLACE INTO promos (code, type, value, min_total, active, expires) VALUES (?, ?, ?, ?, ?, ?)')
    .run(code, body.type, int(body.value), int(body.min_total), body.active === false ? 0 : 1, str(body.expires, 10) || null);
  return { ok: true };
});
admin('DELETE', '/api/admin/promos/:code', ['admin'], ({ params }) => {
  db.prepare('DELETE FROM promos WHERE code = ?').run(decodeURIComponent(params.code));
  return { ok: true };
});

admin('GET', '/api/admin/zones', STAFF, () => db.prepare('SELECT * FROM zones ORDER BY fee').all());
admin('POST', '/api/admin/zones', ['admin'], ({ body }) => {
  if (!str(body.commune)) throw new HttpError(400, 'Commune obligatoire');
  db.prepare('INSERT INTO zones (commune, fee, delay) VALUES (?, ?, ?)').run(str(body.commune, 80), Math.max(0, int(body.fee)), str(body.delay, 40));
  return { ok: true };
});
admin('PUT', '/api/admin/zones/:id', ['admin'], ({ params, body }) => {
  db.prepare('UPDATE zones SET commune = ?, fee = ?, delay = ? WHERE id = ?').run(str(body.commune, 80), Math.max(0, int(body.fee)), str(body.delay, 40), int(params.id));
  return { ok: true };
});
admin('DELETE', '/api/admin/zones/:id', ['admin'], ({ params }) => {
  db.prepare('DELETE FROM zones WHERE id = ?').run(int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/reviews', ['admin', 'vendeur'], () => db.prepare(`SELECT r.*, p.name AS product_name, p.slug AS product_slug FROM reviews r
  JOIN products p ON p.id = r.product_id ORDER BY r.approved, r.id DESC`).all());
admin('PUT', '/api/admin/reviews/:id', ['admin', 'vendeur'], ({ params, body }) => {
  db.prepare('UPDATE reviews SET approved = ? WHERE id = ?').run(body.approved ? 1 : 0, int(params.id));
  return { ok: true };
});
admin('DELETE', '/api/admin/reviews/:id', ['admin', 'vendeur'], ({ params }) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/messages', ['admin', 'vendeur'], () => db.prepare('SELECT * FROM messages ORDER BY handled, id DESC').all());
admin('PUT', '/api/admin/messages/:id', ['admin', 'vendeur'], ({ params, body }) => {
  db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(body.handled ? 1 : 0, int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/banners', ['admin'], () => db.prepare('SELECT * FROM banners ORDER BY sort').all());
admin('PUT', '/api/admin/banners/:id', ['admin'], ({ params, body }) => {
  db.prepare('UPDATE banners SET title = ?, subtitle = ?, cta = ?, link = ?, image = COALESCE(?, image), active = ? WHERE id = ?')
    .run(str(body.title, 120), str(body.subtitle, 300), str(body.cta, 60), str(body.link, 200),
      isImageUrl(body.image) ? body.image : null, body.active === false ? 0 : 1, int(params.id));
  return { ok: true };
});

admin('GET', '/api/admin/export/orders.csv', ['admin', 'vendeur'], ({ res }) => {
  const rows = db.prepare('SELECT code, created_at, name, phone, commune, mode, payment, payment_status, status, subtotal, discount, delivery_fee, total FROM orders ORDER BY id DESC').all();
  const head = ['Commande', 'Date', 'Client', 'Téléphone', 'Commune', 'Mode', 'Paiement', 'Statut paiement', 'Statut', 'Sous-total', 'Remise', 'Livraison', 'Total (GNF)'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [head, ...rows.map(r => Object.values(r))].map(r => r.map(esc).join(';')).join('\r\n');
  send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="commandes-lenoshop.csv"' });
  return undefined;
});

// ---------- fichiers statiques ----------
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/admin' || rel.startsWith('/admin/') && !path.extname(rel)) rel = '/admin/index.html';
  const isUpload = rel.startsWith('/uploads/');
  const base = path.resolve(isUpload ? UPLOADS : PUBLIC);
  let file = path.normalize(path.join(base, isUpload ? rel.slice('/uploads'.length) : rel));
  if (!file.startsWith(base)) return send(res, 403, 'Interdit');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel) || isUpload) return send(res, 404, 'Fichier introuvable');
    file = path.join(PUBLIC, 'index.html'); // routage côté navigateur
  }
  const ext = path.extname(file).toLowerCase();
  // Code et styles revalidés à chaque visite (304 si inchangés) ; images mises en cache une semaine.
  const cache = rel.startsWith('/uploads/') || rel.startsWith('/icons/') ? 'public, max-age=604800' : 'no-cache';
  const mtime = fs.statSync(file).mtime;
  mtime.setMilliseconds(0);
  const since = req.headers['if-modified-since'];
  const headers = { ...SECURITY_HEADERS, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, 'Last-Modified': mtime.toUTCString() };
  if (since && new Date(since) >= mtime) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!r) throw new HttpError(404, 'Route inconnue');
      const m = r.re.exec(url.pathname);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const result = await r.handler({ req, res, params, body, query: Object.fromEntries(url.searchParams), user: currentUser(req) });
      if (result !== undefined && !res.headersSent) send(res, 200, result ?? null);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Méthode non autorisée');
    serveStatic(req, res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Erreur interne du serveur' : err.message });
  }
});

server.listen(config.port, () => {
  console.log(`LENO SHOP en ligne sur http://localhost:${config.port}`);
  console.log(`Back-office : http://localhost:${config.port}/admin`);
});
