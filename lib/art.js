// Génère des visuels produits en SVG pour le catalogue de démonstration.
// À remplacer par de vraies photos depuis le back-office (Produits > Photos).

const W = 'rgba(255,255,255,0.92)';
const S = 'rgba(255,255,255,0.55)';

const icons = {
  laptop: `<rect x="110" y="120" width="180" height="120" rx="10" fill="${W}"/><rect x="122" y="132" width="156" height="96" rx="4" fill="rgba(0,0,0,0.18)"/><path d="M80 252h240l-18 26H98z" fill="${W}"/><rect x="180" y="256" width="40" height="6" rx="3" fill="rgba(0,0,0,0.15)"/>`,
  desktop: `<rect x="90" y="110" width="170" height="115" rx="10" fill="${W}"/><rect x="101" y="121" width="148" height="88" rx="4" fill="rgba(0,0,0,0.18)"/><rect x="160" y="225" width="30" height="30" fill="${S}"/><rect x="130" y="255" width="90" height="10" rx="5" fill="${W}"/><rect x="275" y="120" width="45" height="145" rx="8" fill="${W}"/><circle cx="297" cy="140" r="6" fill="rgba(0,0,0,0.2)"/>`,
  monitor: `<rect x="80" y="105" width="240" height="150" rx="12" fill="${W}"/><rect x="93" y="118" width="214" height="118" rx="4" fill="rgba(0,0,0,0.18)"/><path d="M185 255h30l10 30h-50z" fill="${S}"/><rect x="150" y="285" width="100" height="10" rx="5" fill="${W}"/>`,
  printer: `<rect x="130" y="100" width="140" height="70" rx="6" fill="${S}"/><rect x="90" y="160" width="220" height="100" rx="14" fill="${W}"/><rect x="130" y="230" width="140" height="70" rx="4" fill="${S}"/><circle cx="280" cy="190" r="7" fill="rgba(0,0,0,0.2)"/>`,
  phone: `<rect x="150" y="90" width="100" height="210" rx="18" fill="${W}"/><rect x="160" y="110" width="80" height="165" rx="6" fill="rgba(0,0,0,0.18)"/><rect x="185" y="283" width="30" height="5" rx="2.5" fill="rgba(0,0,0,0.2)"/>`,
  tablet: `<rect x="115" y="90" width="170" height="220" rx="18" fill="${W}"/><rect x="128" y="106" width="144" height="182" rx="6" fill="rgba(0,0,0,0.18)"/><circle cx="200" cy="298" r="5" fill="rgba(0,0,0,0.2)"/>`,
  mouse: `<rect x="150" y="110" width="100" height="170" rx="50" fill="${W}"/><path d="M200 110v60" stroke="rgba(0,0,0,0.2)" stroke-width="4"/><rect x="194" y="130" width="12" height="24" rx="6" fill="rgba(0,0,0,0.25)"/>`,
  keyboard: `<rect x="60" y="150" width="280" height="100" rx="12" fill="${W}"/>${[0, 1, 2].map(r => Array.from({ length: 10 }, (_, c) => `<rect x="${76 + c * 25.5}" y="${166 + r * 24}" width="19" height="17" rx="3" fill="rgba(0,0,0,0.15)"/>`).join('')).join('')}`,
  headphones: `<path d="M110 220v-30a90 90 0 0 1 180 0v30" fill="none" stroke="${W}" stroke-width="18" stroke-linecap="round"/><rect x="92" y="205" width="50" height="80" rx="20" fill="${W}"/><rect x="258" y="205" width="50" height="80" rx="20" fill="${W}"/>`,
  storage: `<rect x="120" y="110" width="160" height="190" rx="16" fill="${W}"/><circle cx="200" cy="190" r="50" fill="rgba(0,0,0,0.14)"/><circle cx="200" cy="190" r="10" fill="${W}"/><rect x="140" y="265" width="120" height="10" rx="5" fill="rgba(0,0,0,0.15)"/>`,
  usb: `<rect x="160" y="160" width="80" height="140" rx="14" fill="${W}"/><rect x="175" y="110" width="50" height="55" rx="4" fill="${S}"/><rect x="187" y="125" width="9" height="9" fill="rgba(0,0,0,0.2)"/><rect x="204" y="125" width="9" height="9" fill="rgba(0,0,0,0.2)"/>`,
  router: `<rect x="80" y="200" width="240" height="70" rx="16" fill="${W}"/><rect x="120" y="110" width="10" height="95" rx="5" fill="${W}"/><rect x="270" y="110" width="10" height="95" rx="5" fill="${W}"/>${[0, 1, 2, 3].map(i => `<circle cx="${140 + i * 30}" cy="235" r="6" fill="rgba(0,0,0,0.2)"/>`).join('')}`,
  bag_laptop: `<rect x="90" y="140" width="220" height="150" rx="18" fill="${W}"/><path d="M160 140v-20a15 15 0 0 1 15-15h50a15 15 0 0 1 15 15v20" fill="none" stroke="${W}" stroke-width="12"/><rect x="90" y="190" width="220" height="10" fill="rgba(0,0,0,0.12)"/>`,
  tshirt: `<path d="M150 95l-70 35 25 55 30-14v134h130V171l30 14 25-55-70-35c-5 20-25 32-50 32s-45-12-50-32z" fill="${W}"/>`,
  shirt: `<path d="M150 95l-70 35 25 55 30-14v134h130V171l30 14 25-55-70-35-50 40z" fill="${W}"/><path d="M200 135v150" stroke="rgba(0,0,0,0.18)" stroke-width="3"/>${[0, 1, 2, 3].map(i => `<circle cx="200" cy="${160 + i * 30}" r="4" fill="rgba(0,0,0,0.25)"/>`).join('')}`,
  dress: `<path d="M170 85h60l-8 55 23 30 50 135H105l50-135 23-30z" fill="${W}"/><path d="M155 170h90" stroke="rgba(0,0,0,0.15)" stroke-width="6"/>`,
  boubou: `<path d="M140 90h120l90 70-30 30-40-25 20 140H100l20-140-40 25-30-30z" fill="${W}"/><path d="M175 90q25 50 50 0" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="5"/><path d="M160 200h80M150 240h100" stroke="rgba(0,0,0,0.12)" stroke-width="5"/>`,
  pants: `<path d="M140 90h120l15 220h-55l-20-150-20 150h-55z" fill="${W}"/><rect x="140" y="90" width="120" height="16" fill="rgba(0,0,0,0.15)"/>`,
  shoe: `<path d="M70 250c0-40 20-80 40-90 30 20 70 25 100 15l60 40c25 10 60 15 60 40v15H70z" fill="${W}"/><rect x="70" y="270" width="260" height="14" rx="7" fill="rgba(0,0,0,0.18)"/>`,
  handbag: `<path d="M150 160v-25a50 50 0 0 1 100 0v25" fill="none" stroke="${W}" stroke-width="14"/><path d="M100 160h200l-20 140H120z" fill="${W}"/><rect x="185" y="195" width="30" height="16" rx="4" fill="rgba(0,0,0,0.2)"/>`,
  watch: `<rect x="170" y="70" width="60" height="70" rx="10" fill="${S}"/><rect x="170" y="260" width="60" height="70" rx="10" fill="${S}"/><circle cx="200" cy="200" r="75" fill="${W}"/><circle cx="200" cy="200" r="60" fill="rgba(0,0,0,0.12)"/><path d="M200 200v-38M200 200l26 16" stroke="${W}" stroke-width="6" stroke-linecap="round"/>`,
  cap: `<path d="M100 230a100 90 0 0 1 200 0z" fill="${W}"/><path d="M90 230h250c0 18-40 28-120 28s-130-10-130-28z" fill="${S}"/>`
};

const palettes = [
  ['#4f46e5', '#06b6d4'], ['#0ea5e9', '#6366f1'], ['#7c3aed', '#ec4899'],
  ['#f97316', '#ef4444'], ['#10b981', '#0ea5e9'], ['#e11d48', '#f59e0b'],
  ['#334155', '#64748b'], ['#db2777', '#9333ea'], ['#0f766e', '#22c55e']
];

function productSvg(icon, seed = 0, label = '') {
  const [a, b] = palettes[seed % palettes.length];
  const art = icons[icon] || icons.tshirt;
  const id = `g${seed}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#${id})"/>
<circle cx="340" cy="60" r="90" fill="rgba(255,255,255,0.08)"/><circle cx="40" cy="360" r="110" fill="rgba(255,255,255,0.06)"/>
<g>${art}</g>
${label ? `<text x="200" y="370" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="rgba(255,255,255,0.85)" letter-spacing="2">${label}</text>` : ''}
</svg>`;
}

function bannerSvg(title, from, to, icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" width="1200" height="500">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="1200" height="500" fill="url(#b)"/>
<circle cx="1050" cy="80" r="220" fill="rgba(255,255,255,0.08)"/><circle cx="700" cy="520" r="200" fill="rgba(255,255,255,0.06)"/>
<g transform="translate(720 50) scale(1)">${icons[icon] || ''}</g>
</svg>`;
}

module.exports = { productSvg, bannerSvg, icons };
