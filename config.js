// Informations de la boutique, modifiables sans toucher au reste du code.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  shop: {
    name: 'LENO SHOP',
    slogan: "L'informatique et la mode, livrées chez vous à Conakry",
    address: 'Foula Madina, Commune de Matoto, Conakry, Guinée',
    phone: '+224 620 00 00 00',
    whatsapp: '224620000000',
    email: 'contact@lenoshop.gn',
    hours: 'Lundi - Samedi : 8h30 - 20h00 · Dimanche : 10h00 - 18h00',
    currency: 'GNF',
    mapQuery: 'Foula Madina, Conakry, Guinée',
    socials: {
      facebook: 'https://facebook.com/',
      instagram: 'https://instagram.com/',
      tiktok: 'https://tiktok.com/'
    }
  },
  // Compte administrateur créé au premier démarrage (à changer après la première connexion).
  admin: {
    name: 'Administrateur LENO',
    email: process.env.ADMIN_EMAIL || 'admin@lenoshop.gn',
    password: process.env.ADMIN_PASSWORD || 'LenoAdmin2026!'
  }
};
