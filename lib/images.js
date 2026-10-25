// Photos d'illustration du catalogue de démonstration, hébergées par Unsplash
// (licence Unsplash : usage commercial gratuit, sans attribution obligatoire).
// À remplacer par les vraies photos des produits depuis le back-office.

const photo = (id, w = 800, h = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const PRODUCT_PHOTOS = {
  'HP 15 Core i5 12e gén. 8 Go / 512 Go SSD': ['1593642702821-c8da6771f0c6', '1593642632823-8f785ba67e45'],
  'Lenovo IdeaPad 3 Ryzen 5 16 Go / 512 Go': ['1593642633279-1796119d5482', '1593642634524-b40b5baae6bb'],
  'Dell Latitude 5490 Core i7 reconditionné': ['1588872657578-7efd1f1555ed', '1604684768394-52a862c2955a'],
  'Apple MacBook Air M2 13" 8 Go / 256 Go': ['1541807084-5c52b6b3adef', '1611186871348-b1ce696e52c9'],
  'HP EliteBook 840 G5 Core i5 reconditionné': ['1593642532744-d377ab507dc8', '1542393545-10f5cde2c810'],
  'PC de bureau HP ProDesk Core i5 + écran 22"': ['1619597455322-4fbbd820250a', '1764588029885-d115de3bda1e'],
  'Écran Samsung 24" Full HD IPS': ['1547658718-1cdaa0852790', '1762983870490-63e5ba07105b'],
  'Écran Dell 27" QHD': ['1646771032500-27b440b2d947', '1666771410140-0573b232426e'],
  'Imprimante HP LaserJet Pro M15w Wi-Fi': ['1612815154858-60aa4c59eaa6', '1650696868612-4b836291b323'],
  'Imprimante multifonction Epson EcoTank L3250': ['1650094980833-7373de26feb6'],
  'Samsung Galaxy A35 128 Go': ['1772182129439-7ab29e9d154c', '1772182092777-6b1bf0a362fe'],
  'iPhone 13 128 Go reconditionné': ['1591337676887-a217a6970a8a', '1616410011236-7a42121dd981'],
  'Tablette Samsung Galaxy Tab A9+ 11"': ['1628866971124-5d506bf12915', '1561154464-82e9adf32764'],
  'Disque dur externe Seagate 1 To USB 3.0': ['1601737487795-dab272f52420', '1581725645226-92ad3b4c16d8'],
  'Clé USB SanDisk Ultra 64 Go': ['1587145820098-23e484e69816', '1551818014-7c8ace9c1b5c'],
  'Routeur Wi-Fi TP-Link Archer C6 AC1200': ['1606904825846-647eb07f5be2', '1516044734145-07ca8eef8731'],
  'Souris sans fil Logitech M185': ['1527864550417-7fd91fc51a46', '1615663245857-ac93bb7c39e7'],
  'Clavier AZERTY Logitech K120': ['1587829741301-dc798b83add3', '1574012716378-0ca6f4c18c08'],
  'Casque Bluetooth JBL Tune 520BT': ['1552585140-bdeefd6b9d6a', '1622473776277-c57c423daf63'],
  'Sacoche ordinateur 15,6" imperméable': ['1763034179057-acad3a072568', '1553062407-98eeb64c6a62'],
  'Chemise en lin manches longues': ['1617117475026-2eb3e68b63cf', '1591357037205-166318b51afd'],
  'T-shirt coton premium col rond': ['1583743814966-8936f5b7be1a', '1581655353564-df123a1eb820'],
  'Pantalon chino slim': ['1473966968600-fa801b869a1a', '1791573391881-98b6b072e7ff'],
  'Robe longue fluide imprimée': ['1696962678565-bee84e6b9cb6', '1709809081557-78f803ce93a0'],
  'Ensemble pagne wax haut + jupe': ['1687052093309-7a14efa58ecb', '1768212565424-efa3a3852b81'],
  'T-shirt enfant coton imprimé': ['1620905385976-9f191e837efd', '1622290291468-a28f7a7dc6a8'],
  'Baskets sport légères': ['1544441892-794166f1e3be'],
  'Sandales femme en cuir': ['1613662632164-7f2b081a5b46', '1732708862549-714f7478ca31'],
  'Grand boubou brodé bazin riche': ['1731595758871-35a1d0a4b1ba', '1731595758951-d7f852342113'],
  'Kaftan femme brodé': ['1649109670237-31fcefbac2b6', '1555885424-fcb5134e4bee'],
  'Sac à main en cuir synthétique': ['1624687943971-e86af76d57de', '1691480150204-66dd1eb77391'],
  'Montre homme acier inoxydable': ['1557531365-e8b22d93dbd0', '1622434641406-a158123450f9'],
  'Casquette brodée LENO': ['1588850561407-ed78c282e89b', '1521369909029-2afed882baee']
};

// Bannières de l'accueil, dans l'ordre du carrousel.
const BANNER_PHOTOS = [
  '1604933762021-54a5858c9832', // femme travaillant sur un ordinateur portable
  '1681545303529-b6beb2e19f02', // groupe de femmes en tenues wax
  '1648394794449-5dbe63f6a8b5' // livreur à scooter
];

const productPhotos = name => (PRODUCT_PHOTOS[name] || []).map(id => photo(id));
const bannerPhoto = i => (BANNER_PHOTOS[i] ? photo(BANNER_PHOTOS[i], 1600, 667) + '&crop=faces,entropy' : null);

module.exports = { productPhotos, bannerPhoto, PRODUCT_PHOTOS };
