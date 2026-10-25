const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const { productSvg, bannerSvg } = require('./art');

const ROOT = path.join(__dirname, '..');
// DATA_DIR et UPLOADS_DIR permettent de placer la base et les photos sur un disque persistant (ex. Render).
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'lenoshop.db');
const UPLOADS = process.env.UPLOADS_DIR || path.join(ROOT, 'public', 'uploads');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  univers TEXT NOT NULL CHECK (univers IN ('informatique','mode')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'tshirt',
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  univers TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT DEFAULT '',
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  old_price INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  specs TEXT NOT NULL DEFAULT '{}',
  sizes TEXT NOT NULL DEFAULT '[]',
  colors TEXT NOT NULL DEFAULT '[]',
  condition TEXT DEFAULT 'neuf',
  gender TEXT DEFAULT '',
  warranty TEXT DEFAULT '',
  featured INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  sold INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commune TEXT NOT NULL,
  fee INTEGER NOT NULL,
  delay TEXT DEFAULT '24h'
);
CREATE TABLE IF NOT EXISTS promos (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent','amount')),
  value INTEGER NOT NULL,
  min_total INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  expires TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  mode TEXT NOT NULL,
  zone_id INTEGER,
  commune TEXT,
  address TEXT,
  note TEXT,
  payment TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'en_attente',
  status TEXT NOT NULL DEFAULT 'recue',
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  promo_code TEXT,
  history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  approved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'contact',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  message TEXT NOT NULL,
  handled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  cta TEXT,
  link TEXT,
  image TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
`;

const CATEGORIES = [
  ['informatique', 'Ordinateurs portables', 'laptop'],
  ['informatique', 'Ordinateurs de bureau', 'desktop'],
  ['informatique', 'Écrans', 'monitor'],
  ['informatique', 'Imprimantes & consommables', 'printer'],
  ['informatique', 'Smartphones & tablettes', 'phone'],
  ['informatique', 'Stockage', 'storage'],
  ['informatique', 'Réseau', 'router'],
  ['informatique', 'Accessoires', 'mouse'],
  ['mode', 'Homme', 'shirt'],
  ['mode', 'Femme', 'dress'],
  ['mode', 'Enfant', 'tshirt'],
  ['mode', 'Chaussures', 'shoe'],
  ['mode', 'Tenues traditionnelles', 'boubou'],
  ['mode', 'Accessoires de mode', 'handbag']
];

// [catégorie, nom, marque, prix, ancien prix, stock, icône, specs, tailles, couleurs, état, genre, vedette]
const PRODUCTS = [
  ['Ordinateurs portables', 'HP 15 Core i5 12e gén. 8 Go / 512 Go SSD', 'HP', 6450000, 6900000, 12, 'laptop', { Processeur: 'Intel Core i5-1235U', RAM: '8 Go DDR4', Stockage: '512 Go SSD', Écran: '15,6" Full HD', Système: 'Windows 11' }, [], ['Argent', 'Noir'], 'neuf', '', 1],
  ['Ordinateurs portables', 'Lenovo IdeaPad 3 Ryzen 5 16 Go / 512 Go', 'Lenovo', 6950000, null, 8, 'laptop', { Processeur: 'AMD Ryzen 5 7520U', RAM: '16 Go', Stockage: '512 Go SSD', Écran: '15,6" Full HD', Système: 'Windows 11' }, [], ['Gris'], 'neuf', '', 1],
  ['Ordinateurs portables', 'Dell Latitude 5490 Core i7 reconditionné', 'Dell', 3950000, 4600000, 6, 'laptop', { Processeur: 'Intel Core i7-8650U', RAM: '16 Go', Stockage: '256 Go SSD', Écran: '14" Full HD', Système: 'Windows 10 Pro' }, [], ['Noir'], 'reconditionné', '', 0],
  ['Ordinateurs portables', 'Apple MacBook Air M2 13" 8 Go / 256 Go', 'Apple', 11900000, 12500000, 4, 'laptop', { Processeur: 'Apple M2', RAM: '8 Go', Stockage: '256 Go SSD', Écran: '13,6" Liquid Retina', Système: 'macOS' }, [], ['Minuit', 'Argent', 'Lumière stellaire'], 'neuf', '', 1],
  ['Ordinateurs portables', 'HP EliteBook 840 G5 Core i5 reconditionné', 'HP', 3450000, null, 10, 'laptop', { Processeur: 'Intel Core i5-8350U', RAM: '8 Go', Stockage: '256 Go SSD', Écran: '14" Full HD', Système: 'Windows 10 Pro' }, [], ['Argent'], 'reconditionné', '', 0],
  ['Ordinateurs de bureau', 'PC de bureau HP ProDesk Core i5 + écran 22"', 'HP', 5200000, 5600000, 5, 'desktop', { Processeur: 'Intel Core i5 10e gén.', RAM: '8 Go', Stockage: '256 Go SSD + 1 To HDD', Écran: '22" inclus' }, [], ['Noir'], 'neuf', '', 0],
  ['Écrans', 'Écran Samsung 24" Full HD IPS', 'Samsung', 1350000, 1500000, 15, 'monitor', { Taille: '24"', Résolution: '1920 x 1080', Dalle: 'IPS', Connectique: 'HDMI, VGA' }, [], ['Noir'], 'neuf', '', 0],
  ['Écrans', 'Écran Dell 27" QHD', 'Dell', 2450000, null, 7, 'monitor', { Taille: '27"', Résolution: '2560 x 1440', Dalle: 'IPS', Connectique: 'HDMI, DisplayPort' }, [], ['Noir'], 'neuf', '', 0],
  ['Imprimantes & consommables', 'Imprimante HP LaserJet Pro M15w Wi-Fi', 'HP', 1650000, null, 9, 'printer', { Type: 'Laser monochrome', Connexion: 'Wi-Fi, USB', Vitesse: '19 pages/min' }, [], ['Blanc'], 'neuf', '', 0],
  ['Imprimantes & consommables', 'Imprimante multifonction Epson EcoTank L3250', 'Epson', 2350000, 2550000, 6, 'printer', { Type: 'Jet d\'encre couleur à réservoirs', Fonctions: 'Impression, copie, scan', Connexion: 'Wi-Fi' }, [], ['Noir'], 'neuf', '', 1],
  ['Smartphones & tablettes', 'Samsung Galaxy A35 128 Go', 'Samsung', 3150000, 3400000, 14, 'phone', { Écran: '6,6" Super AMOLED', Stockage: '128 Go', RAM: '6 Go', Batterie: '5000 mAh' }, [], ['Bleu', 'Noir', 'Lilas'], 'neuf', '', 1],
  ['Smartphones & tablettes', 'iPhone 13 128 Go reconditionné', 'Apple', 4950000, null, 5, 'phone', { Écran: '6,1" OLED', Stockage: '128 Go', Batterie: '≥ 85 %' }, [], ['Minuit', 'Bleu'], 'reconditionné', '', 0],
  ['Smartphones & tablettes', 'Tablette Samsung Galaxy Tab A9+ 11"', 'Samsung', 2650000, null, 8, 'tablet', { Écran: '11"', Stockage: '64 Go', RAM: '4 Go' }, [], ['Gris'], 'neuf', '', 0],
  ['Stockage', 'Disque dur externe Seagate 1 To USB 3.0', 'Seagate', 650000, 720000, 25, 'storage', { Capacité: '1 To', Interface: 'USB 3.0' }, [], ['Noir'], 'neuf', '', 0],
  ['Stockage', 'Clé USB SanDisk Ultra 64 Go', 'SanDisk', 95000, null, 60, 'usb', { Capacité: '64 Go', Interface: 'USB 3.0' }, [], ['Noir'], 'neuf', '', 0],
  ['Réseau', 'Routeur Wi-Fi TP-Link Archer C6 AC1200', 'TP-Link', 450000, null, 18, 'router', { Norme: 'Wi-Fi 5 AC1200', Ports: '4 x Gigabit' }, [], ['Noir'], 'neuf', '', 0],
  ['Accessoires', 'Souris sans fil Logitech M185', 'Logitech', 120000, 150000, 40, 'mouse', { Connexion: 'Récepteur USB 2,4 GHz', Autonomie: '12 mois' }, [], ['Gris', 'Bleu', 'Rouge'], 'neuf', '', 0],
  ['Accessoires', 'Clavier AZERTY Logitech K120', 'Logitech', 110000, null, 30, 'keyboard', { Disposition: 'AZERTY', Connexion: 'USB' }, [], ['Noir'], 'neuf', '', 0],
  ['Accessoires', 'Casque Bluetooth JBL Tune 520BT', 'JBL', 480000, 550000, 16, 'headphones', { Connexion: 'Bluetooth 5.3', Autonomie: '57 h' }, [], ['Noir', 'Blanc', 'Bleu'], 'neuf', '', 1],
  ['Accessoires', 'Sacoche ordinateur 15,6" imperméable', 'LENO', 185000, null, 22, 'bag_laptop', { Compatibilité: 'Jusqu\'à 15,6"', Matière: 'Polyester imperméable' }, [], ['Noir', 'Gris'], 'neuf', '', 0],
  ['Homme', 'Chemise en lin manches longues', 'LENO Wear', 175000, 220000, 30, 'shirt', { Matière: '100 % lin', Coupe: 'Regular' }, ['S', 'M', 'L', 'XL', 'XXL'], ['Blanc', 'Bleu ciel', 'Beige'], 'neuf', 'homme', 1],
  ['Homme', 'T-shirt coton premium col rond', 'LENO Wear', 85000, null, 80, 'tshirt', { Matière: '100 % coton peigné', Grammage: '180 g/m²' }, ['S', 'M', 'L', 'XL', 'XXL'], ['Noir', 'Blanc', 'Vert', 'Bordeaux'], 'neuf', 'homme', 0],
  ['Homme', 'Pantalon chino slim', 'LENO Wear', 195000, null, 35, 'pants', { Matière: 'Coton stretch', Coupe: 'Slim' }, ['38', '40', '42', '44', '46'], ['Beige', 'Bleu marine', 'Noir'], 'neuf', 'homme', 0],
  ['Femme', 'Robe longue fluide imprimée', 'LENO Wear', 265000, 320000, 20, 'dress', { Matière: 'Viscose', Longueur: 'Longue' }, ['S', 'M', 'L', 'XL'], ['Rouge', 'Vert émeraude', 'Jaune moutarde'], 'neuf', 'femme', 1],
  ['Femme', 'Ensemble pagne wax haut + jupe', 'LENO Wear', 310000, null, 15, 'dress', { Matière: 'Wax 100 % coton', Pièces: '2' }, ['S', 'M', 'L', 'XL'], ['Multicolore'], 'neuf', 'femme', 0],
  ['Enfant', 'T-shirt enfant coton imprimé', 'LENO Kids', 55000, null, 50, 'tshirt', { Matière: '100 % coton' }, ['2 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans'], ['Jaune', 'Bleu', 'Rose'], 'neuf', 'enfant', 0],
  ['Chaussures', 'Baskets sport légères', 'LENO Move', 295000, 350000, 25, 'shoe', { Semelle: 'EVA amortissante', Usage: 'Sport et ville' }, ['39', '40', '41', '42', '43', '44', '45'], ['Blanc', 'Noir'], 'neuf', 'homme', 1],
  ['Chaussures', 'Sandales femme en cuir', 'LENO Move', 165000, null, 18, 'shoe', { Matière: 'Cuir véritable' }, ['36', '37', '38', '39', '40', '41'], ['Marron', 'Noir', 'Doré'], 'neuf', 'femme', 0],
  ['Tenues traditionnelles', 'Grand boubou brodé bazin riche', 'LENO Tradition', 650000, 750000, 10, 'boubou', { Tissu: 'Bazin riche', Finition: 'Broderie main' }, ['M', 'L', 'XL', 'XXL'], ['Blanc', 'Bleu roi', 'Bordeaux'], 'neuf', 'homme', 1],
  ['Tenues traditionnelles', 'Kaftan femme brodé', 'LENO Tradition', 420000, null, 12, 'boubou', { Tissu: 'Satin brodé' }, ['S', 'M', 'L', 'XL'], ['Or', 'Vert', 'Rose poudré'], 'neuf', 'femme', 0],
  ['Accessoires de mode', 'Sac à main en cuir synthétique', 'LENO Wear', 245000, 290000, 14, 'handbag', { Matière: 'Cuir synthétique', Fermeture: 'Zip' }, [], ['Noir', 'Camel', 'Rouge'], 'neuf', 'femme', 0],
  ['Accessoires de mode', 'Montre homme acier inoxydable', 'LENO Time', 380000, null, 9, 'watch', { Boîtier: 'Acier inoxydable', Étanchéité: '3 ATM' }, [], ['Argent', 'Noir', 'Or'], 'neuf', 'homme', 0],
  ['Accessoires de mode', 'Casquette brodée LENO', 'LENO Wear', 65000, null, 45, 'cap', { Matière: 'Coton', Taille: 'Réglable' }, [], ['Noir', 'Blanc', 'Vert'], 'neuf', '', 0]
];

const ZONES = [
  ['Matoto (Foula Madina et environs)', 15000, 'Le jour même'],
  ['Matam', 20000, '24h'],
  ['Ratoma', 25000, '24h'],
  ['Dixinn', 25000, '24h'],
  ['Kaloum', 30000, '24h'],
  ['Coyah', 40000, '24 à 48h'],
  ['Dubréka', 40000, '24 à 48h']
];

function writeFile(rel, content) {
  const full = path.join(UPLOADS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return `/uploads/${rel.replace(/\\/g, '/')}`;
}

function seed(db) {
  const insCat = db.prepare('INSERT INTO categories (univers, name, slug, icon, sort) VALUES (?, ?, ?, ?, ?)');
  const catIds = {};
  CATEGORIES.forEach(([univers, name, icon], i) => {
    catIds[name] = insCat.run(univers, name, slugify(name), icon, i).lastInsertRowid;
  });

  const insProd = db.prepare(`INSERT INTO products
    (univers, category_id, name, slug, brand, description, price, old_price, stock, images, specs, sizes, colors, condition, gender, warranty, featured, sold, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);
  PRODUCTS.forEach((p, i) => {
    const [cat, name, brand, price, oldPrice, stock, icon, specs, sizes, colors, condition, gender, featured] = p;
    const univers = CATEGORIES.find(c => c[1] === cat)[0];
    const slug = slugify(name);
    const images = [0, 1, 2].map(v => writeFile(`seed/${slug}-${v + 1}.svg`, productSvg(icon, i + v * 3, v === 0 ? brand.toUpperCase() : '')));
    const description = univers === 'informatique'
      ? `${name}. Produit ${condition === 'neuf' ? 'neuf, sous emballage d\'origine' : 'reconditionné et testé par nos techniciens'}, disponible dans notre boutique de Foula Madina ou livré partout à Conakry. Installation et conseils offerts.`
      : `${name}. Pièce sélectionnée par LENO SHOP pour sa qualité et son confort. Échange de taille possible sous 7 jours en boutique.`;
    const warranty = univers === 'informatique' ? (condition === 'neuf' ? '12 mois' : '6 mois') : '';
    insProd.run(univers, catIds[cat], name, slug, brand, description, price, oldPrice, stock,
      JSON.stringify(images), JSON.stringify(specs), JSON.stringify(sizes), JSON.stringify(colors),
      condition, gender, warranty, featured, Math.floor(Math.random() * 60), `-${PRODUCTS.length - i} days`);
  });

  const insZone = db.prepare('INSERT INTO zones (commune, fee, delay) VALUES (?, ?, ?)');
  ZONES.forEach(z => insZone.run(...z));

  const insPromo = db.prepare('INSERT INTO promos (code, type, value, min_total, active) VALUES (?, ?, ?, ?, 1)');
  insPromo.run('BIENVENUE10', 'percent', 10, 0);
  insPromo.run('LENO50K', 'amount', 50000, 500000);

  const insBanner = db.prepare('INSERT INTO banners (title, subtitle, cta, link, image, sort) VALUES (?, ?, ?, ?, ?, ?)');
  insBanner.run('Rentrée high-tech', 'Ordinateurs portables neufs et reconditionnés, garantis jusqu\'à 12 mois.', 'Voir les ordinateurs', '/boutique/informatique/ordinateurs-portables',
    writeFile('seed/banner-1.svg', bannerSvg('', '#312e81', '#0891b2', 'laptop')), 0);
  insBanner.run('Nouvelle collection mode', 'Chemises en lin, robes fluides et boubous brodés pour toutes les occasions.', 'Découvrir la mode', '/boutique/mode',
    writeFile('seed/banner-2.svg', bannerSvg('', '#9d174d', '#f97316', 'dress')), 1);
  insBanner.run('Livraison le jour même', 'À Foula Madina et dans toute la commune de Matoto. Paiement Orange Money, MTN MoMo ou à la livraison.', 'Commander maintenant', '/boutique',
    writeFile('seed/banner-3.svg', bannerSvg('', '#065f46', '#0ea5e9', 'bag_laptop')), 2);

  const insReview = db.prepare('INSERT INTO reviews (product_id, author, rating, comment, approved) VALUES (?, ?, ?, ?, 1)');
  insReview.run(1, 'Mamadou D.', 5, 'Livré en 3 heures à Foula Madina, ordinateur parfait pour mes études.');
  insReview.run(1, 'Fatoumata B.', 4, 'Bon rapport qualité-prix, le vendeur m\'a aidé à tout installer.');
  insReview.run(21, 'Ibrahima S.', 5, 'Très belle chemise, tissu agréable même avec la chaleur.');
  insReview.run(24, 'Aïssatou C.', 5, 'La robe est magnifique, taille conforme.');
  insReview.run(11, 'Ousmane K.', 4, 'Téléphone reçu rapidement, payé par Orange Money sans souci.');

  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(config.admin.name, config.admin.email, hashPassword(config.admin.password), 'admin');
}

function open({ reset = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (reset && fs.existsSync(DB_FILE)) {
    fs.rmSync(DB_FILE);
    fs.rmSync(path.join(UPLOADS, 'seed'), { recursive: true, force: true });
  }
  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const count = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (count === 0) {
    db.exec('BEGIN');
    try { seed(db); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    console.log('Base de données initialisée avec le catalogue de démonstration.');
  }
  return db;
}

module.exports = { open, hashPassword, verifyPassword, slugify, UPLOADS };
