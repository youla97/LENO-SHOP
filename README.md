# LENO SHOP — boutique en ligne

Application web de vente en ligne de **matériel informatique** et d'**habits** pour LENO SHOP, Foula Madina (Conakry), réalisée d'après le cahier des charges.

## Démarrer

Prérequis : [Node.js](https://nodejs.org) **22.5 ou plus récent** (aucune autre installation : pas de `npm install`, la base SQLite est intégrée à Node).

```bash
node server.js
```

- Boutique : http://localhost:3000
- Back-office : http://localhost:3000/admin

Au premier démarrage, la base `data/lenoshop.db` est créée avec un catalogue de démonstration (33 produits, 14 catégories, 7 zones de livraison, 2 codes promo).

**Compte administrateur de démonstration** (défini dans `config.js`, à changer avant la mise en ligne) :

- E-mail : `admin@lenoshop.gn`
- Mot de passe : `LenoAdmin2026!`

On peut aussi le définir par variables d'environnement : `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`.

Repartir d'une base vierge (efface commandes, clients et produits ajoutés) :

```bash
node server.js --reset
```

Codes promo de démonstration : `BIENVENUE10` (−10 %) et `LENO50K` (−50 000 GNF dès 500 000 GNF d'achat).

## Fonctionnalités

**Boutique (clients)**
- Accueil avec carrousel, univers Informatique / Mode, catégories, coups de cœur, promotions, nouveautés
- Catalogue avec filtres (catégorie, prix, marque, taille, couleur, état neuf/reconditionné, stock, promo), tri et pagination
- Recherche instantanée avec suggestions (clavier ↑ ↓ Entrée)
- Fiche produit : galerie avec zoom, choix taille/couleur, stock en temps réel, caractéristiques, avis clients, produits similaires, bouton WhatsApp
- Panier sans rechargement (tiroir latéral), code promo, favoris, comparateur d'ordinateurs (jusqu'à 4)
- Commande sans compte ou avec compte : livraison par commune (frais automatiques) ou retrait gratuit en boutique
- Paiement Orange Money, MTN MoMo, à la livraison ou en boutique
- Confirmation, suivi de commande (numéro + téléphone), facture imprimable / PDF
- Compte client : inscription par e-mail ou téléphone, historique des commandes, changement de mot de passe
- Contact (carte Google Maps, WhatsApp), demande de devis entreprise, FAQ, CGV, à propos
- Mode clair / sombre, design mobile d'abord (barre de navigation en bas), installable sur téléphone (PWA)

**Back-office (équipe)**
- Tableau de bord : ventes du jour / semaine / mois, graphique 14 jours, ventes par univers, alertes de stock, meilleures ventes
- Commandes : filtres, changement de statut (l'annulation remet en stock), statut de paiement, facture, contact WhatsApp, export Excel (CSV)
- Produits : création / modification, photos (allégées automatiquement), variantes, caractéristiques, mise en avant, visibilité
- Stock : entrées / sorties avec motif, historique, décrément automatique à chaque vente
- Catégories, codes promo, zones et tarifs de livraison, modération des avis, messages et devis, bannières de l'accueil
- Rôles : administrateur, vendeur, gestionnaire de stock, livreur (chacun ne voit que ce qui le concerne)

## Déployer sur Render

L'application doit être créée comme **Web Service** (et non *Static Site*, qui répond « Not Found » car le serveur Node n'est jamais lancé).

Méthode la plus simple : dans Render, **New > Blueprint**, choisir le dépôt `youla97/LENO-SHOP` : le fichier `render.yaml` configure tout (Node 22.14, commande `node server.js`, mot de passe admin généré).

Méthode manuelle : **New > Web Service**, dépôt `youla97/LENO-SHOP`, puis :

| Réglage | Valeur |
| --- | --- |
| Runtime | Node |
| Build Command | `echo ok` |
| Start Command | `node server.js` |
| Variable `NODE_VERSION` | `22.14.0` |
| Variable `ADMIN_PASSWORD` | votre mot de passe administrateur |

Le mot de passe généré par le Blueprint se lit dans Render, onglet *Environment* du service.

Sur le plan gratuit, le disque est effacé à chaque redéploiement ou mise en veille longue : les commandes et photos ajoutées sont perdues. Pour la production, ajoutez un disque persistant (plan payant) et les variables `DATA_DIR=/var/data/db` et `UPLOADS_DIR=/var/data/uploads` (voir les commentaires de `render.yaml`).

## Avant la mise en ligne

1. **Informations boutique** : téléphone, WhatsApp, e-mail, horaires et réseaux sociaux dans `config.js`.
2. **Mot de passe administrateur** : changez-le (variable `ADMIN_PASSWORD` avant le premier démarrage, ou créez un nouvel admin dans *Clients & équipe*).
3. **Paiement mobile money** : le paiement Orange Money / MTN MoMo fonctionne en **mode démonstration** (le client clique « J'ai validé »). Pour encaisser réellement, il faut un contrat avec Orange Money, MTN MoMo ou un agrégateur, puis remplacer la route `POST /api/orders/:code/pay` dans `server.js` par l'appel à leur API (avec confirmation par webhook).
4. **Photos** : les produits et bannières de démonstration utilisent des photos d'illustration [Unsplash](https://unsplash.com/license) (gratuites, usage commercial autorisé), listées dans `lib/images.js`. Elles montrent un produit du même type, pas toujours le modèle exact : remplacez-les par vos propres photos depuis *Produits & stock* (envoi de fichier ou lien Unsplash) et *Bannières accueil*.
5. **Hébergement** : un VPS (OVH, DigitalOcean…) avec Node.js, derrière Nginx ou Caddy pour le HTTPS, et un nom de domaine (ex. lenoshop.gn). Sauvegardez chaque jour le dossier `data/` et `public/uploads/`.
6. **CGV** : faites valider le modèle de la page `/cgv` par un juriste.

Prévu en version 2 (hors périmètre du cahier des charges) : notifications SMS automatiques, application mobile Android / iOS, programme de fidélité.

## Structure

```
server.js          serveur HTTP + API REST (Node, sans dépendance)
config.js          informations de la boutique et compte admin initial
lib/db.js          schéma SQLite et catalogue de démonstration
lib/art.js         visuels SVG des produits de démonstration
public/            boutique (HTML, CSS, JavaScript modules)
public/admin/      back-office
data/              base de données (créée au démarrage)
```
