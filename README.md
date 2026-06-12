# SUPCONTENT Music

Monorepo SUPCONTENT Music avec trois surfaces principales :

- `apps/api`: backend Express + TypeScript
- `apps/web`: frontend web Vite/React et pages publiques
- `apps/mobile`: client Expo/React Native

## Etat actuel

Le projet couvre deja les flux principaux :

- authentification email + OAuth
- recherche Spotify/YouTube
- import de playlists et medias
- bibliotheque et collections
- profils et publications
- boutique
- swipe, live, notifications

Les points encore a considerer comme evolutifs restent surtout autour du chat WIP, de la qualification produit finale et des recettes fonctionnelles completes.

## Prerequis

- Node.js 20+
- npm 10+
- PostgreSQL si vous utilisez le backend complet
- Redis facultatif en local
- Android Studio / Expo pour le mobile natif

## Installation

```bash
npm install
```

## Lancement local

### API + Web

```bash
npm run dev
```

- API: `http://localhost:1234`
- Web: `http://localhost:4173`

Chaque app peut aussi tourner separement :

```bash
npm --workspace apps/api run dev
npm --workspace apps/web run dev:static
```

### Mobile

Dans un second terminal :

```bash
npm --workspace apps/mobile run start
```

## Variables d'environnement

Exemples disponibles :

- [`.env.example`](./.env.example)
- [`.env.production.example`](./.env.production.example)
- [`apps/api/.env.example`](./apps/api/.env.example)

Les variables backend les plus importantes :

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Variable frontend utile en local :

- `SUPCONTENT_API_BASE`

## Scripts utiles

```bash
npm run build
npm run test
npm run lint:web
npm run check
```

### Detail

- `npm run build`: build API + web
- `npm run test`: smoke tests API + tests utilitaires web
- `npm run lint:web`: lint ESLint du frontend web
- `npm run check`: lint + build + tests

## Mobile

Scripts principaux :

```bash
npm --workspace apps/mobile run start
npm --workspace apps/mobile run android
npm --workspace apps/mobile run android:apk
npm --workspace apps/mobile run android:aab
```

Le script `build` mobile exporte maintenant la cible web Expo et regenere les assets :

```bash
npm --workspace apps/mobile run build
```

## CI

Une pipeline GitHub Actions est fournie dans [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

Elle execute :

- installation des dependances
- lint web
- build du monorepo
- tests automatises

## Documentation connexe

- [`docs/FONCTIONNALITES_PAR_PAGE.md`](./docs/FONCTIONNALITES_PAR_PAGE.md)
- [`apps/api/README.md`](./apps/api/README.md)
- [`apps/web/README.md`](./apps/web/README.md)
- [`docs/user-stories/README.md`](./docs/user-stories/README.md)
- [`docs/setup/SEPARATION_FRONT_BACK.md`](./docs/setup/SEPARATION_FRONT_BACK.md)
- [`docs/setup/SETUP_COLLAB.md`](./docs/setup/SETUP_COLLAB.md)

## Definition d'un projet "pret"

Avant publication, verifier au minimum :

1. `npm run check`
2. configuration des vraies variables d'environnement
3. validation manuelle auth / recherche / import / boutique / profil / swipe
4. generation du build mobile cible si publication Android

## OAuth Google

Le web utilise la page `connexion.html` apres retour OAuth.

Le mobile Expo supporte aussi Google via deep link :

- schema: `supcontentmusic://auth/callback`
- endpoint backend utilise: `/auth/oauth/google/start`
- variables requises cote API: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
