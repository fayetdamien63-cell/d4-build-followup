# D4 Build Tracker

Application locale pour suivre sa progression sur un build Diablo IV importé depuis **Maxroll** :
compétences, parangon et équipement deviennent une checklist visuelle, étape par étape.

## Démarrage

Prérequis : **Node.js 22.13+** (le module SQLite natif `node:sqlite` est utilisé, aucune compilation nécessaire).

```bash
npm install
npm run dev        # API sur :5174 + interface sur http://localhost:5173
```

Pour un usage quotidien (un seul port, sans rechargement à chaud) :

```bash
npm run build
npm start          # http://localhost:5174
```

Pour l'ouvrir aussi sur ton téléphone (même Wi-Fi) :

```bash
npm run build
npm run start:lan  # affiche l'adresse réseau ; bouton « Téléphone » dans l'app pour le QR code
```

> ⚠️ En mode `start:lan`, l'app n'a pas d'authentification : tout appareil du réseau local peut l'ouvrir.

Colle ensuite l'URL d'un guide (`https://maxroll.gg/d4/build-guides/…`), d'un planner
(`https://maxroll.gg/d4/planner/xxxx#5`) ou directement un ID de planner.

## Fonctionnalités (phase 1)

- **Import Maxroll** depuis un guide ou un planner. Toutes les variantes sont récupérées (Leveling, Starter, Endgame, Push…),
  la variante active suit le lien collé.
- **Prochaines étapes** : l'étape de compétences en cours, les plateaux de parangon à compléter et les objectifs d'équipement
  par priorité (obtenir l'objet → aspect → affixes → trempe → châsses → masterwork).
- **Équipement** : une carte par emplacement, couleurs de rareté du jeu, affixes cochables avec badges *Greater Affix* et
  *Masterwork*, trempes, gemmes/runes.
- **Compétences** : la barre de compétences et la frise des étapes du guide (seules les nouveautés de chaque étape sont listées).
- **Parangon** : chaque plateau est dessiné. On clique sur les cases pour les valider, et les glyphes et nœuds rares/légendaires sont listés à part.
- Valider le rang 15 d'une compétence valide aussi les rangs inférieurs, et inversement pour l'invalidation.
- **Mettre à jour** re-télécharge le build depuis Maxroll en conservant la progression.

## Phase 2

- **Journal** : chaque action est horodatée (onglet *Journal*, groupé par jour). On y trouve les jalons ★ (objets uniques ou
  mythiques, plateaux, nœuds légendaires), le détail des validations en masse et des statistiques (validations, 7 derniers jours, jours actifs).
  Les objets affichent leur date d'obtention.
- **Mises à jour du guide** : à l'ouverture d'un build (et sur l'accueil), l'app compare avec Maxroll (résultat gardé en cache 30 min).
  Si le guide a changé, un bandeau propose le **diff** : ajouts, retraits et modifications par variante et catégorie, avec
  une alerte sur les éléments déjà validés. On l'applique en un clic, sans perdre sa progression.
- **PWA** : l'app s'installe comme une application (Chrome/Edge sur PC : icône « Installer ») et reste consultable hors ligne
  (dernière version connue, en lecture seule).
- **Téléphone** : mode `start:lan` et QR code. Sur le téléphone, « Ajouter à l'écran d'accueil » l'ouvre en plein écran.
  Le cache hors ligne (service worker) n'est disponible que sur `localhost` ou en HTTPS : via l'adresse IP locale, le téléphone
  a besoin du PC allumé.

## Valeurs obtenues

Dans l'onglet **Équipement**, « + valeur » à côté d'un affixe (aspect, affixe, trempe) permet de saisir la valeur obtenue en jeu,
au format du jeu ou français (`1,900`, `1 900`, `9,75`, `15%`…). L'app la compare à la cible du guide :

- une pastille verte (cible atteinte), dorée (≥ 90 %) ou rouge, avec le pourcentage ;
- une **note de qualité** par objet (moyenne des affixes renseignés) ;
- un panneau **« À améliorer en priorité »** qui classe les objets du plus faible au plus fort et montre leur pire affixe.

Saisir une valeur coche aussi l'affixe (et l'inscrit au journal).

## Liste de farm

L'onglet **Farm** indique où trouver chaque unique, mythique et rune du build encore manquant. Pour chaque source, il donne le boss,
la clé d'invocation, l'activité à faire, le lieu et l'élément. La meilleure prochaine cible est mise en avant, et
« Prochaines étapes » indique la source de chaque objet. Les données viennent de la page Maxroll
[Boss Loot Table Cheat Sheet](https://maxroll.gg/d4/resources/boss-loot-table-cheat-sheet), analysée et mise en cache 3 jours.

## Architecture

```
shared/   Modèle normalisé (types), logique de progression, libellés et diff de builds, partagés serveur/front
server/   Fastify + SQLite (data/tracker.db)
  src/maxroll/client.ts     Résolution URL → planner, appel de l'endpoint profil
  src/maxroll/gameData.ts   Données de jeu Maxroll (~12 Mo), en cache disque 7 jours
  src/maxroll/normalize.ts  JSON Maxroll → modèle lisible (noms, affixes, grilles de parangon)
  src/maxroll/text.ts       Rendu des gabarits de texte du jeu ([{value}*100|%|], {if:…}, …)
  src/maxroll/loot.ts       Table de loot des boss (page Maxroll) → sources et objets
  src/farm.ts               Croisement build × table de loot → plan de farm
web/      React + Vite
```

Sources de données (endpoints publics non documentés, utilisés pour un usage personnel et mis en cache) :

- `https://planners.maxroll.gg/profiles/d4/{id}` : le build
- `https://assets-ng.maxroll.gg/d4-tools/game/data.min.json` : noms et descriptions du jeu

Chaque élément cochable a une clé stable (`v4:gear:14:affix:2`, `v4:para:Paragon_Warlock_07:131`…). La progression est
stockée par clé et survit donc aux mises à jour du build.

## Commandes utiles

```bash
npm test           # tests serveur (vitest)
npm run typecheck  # TypeScript serveur + front
```

Les données locales (base SQLite et cache) sont dans `data/`. Le dossier peut être changé avec `D4_DATA_DIR`, le port avec `PORT`.
