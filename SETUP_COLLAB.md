# Setup Collaborateurs (SUPCONTENT)

Guide rapide pour lancer le projet localement et pouvoir creer/se connecter a un compte.

## 1) Prerequis

- Node.js 18+ (ou 20+ recommande)
- npm
- PostgreSQL
- Redis

## 2) Installer les dependances

```bash
npm install
```

## 3) Configurer l'API (`apps/api/.env`)

Copier `apps/api/.env.example` vers `apps/api/.env` puis completer:

```env
PORT=1234
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/supcontent
REDIS_URL=redis://localhost:6379

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:1234/auth/oauth/spotify/callback
FRONTEND_URL=http://localhost:4173

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

GITHUB_CLIENT_ID=...            # si OAuth GitHub utilise
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:1234/auth/oauth/github/callback
```

Important:
- Le backend lit **`apps/api/.env`**, pas un `.env` a la racine.
- Si OAuth Spotify est utilise, verifier la redirect URI en Dashboard Spotify.

## 4) Demarrer PostgreSQL + Redis

Verifier que les deux services sont UP avant de lancer l'app.

## 5) Lancer le projet

```bash
npm run dev
```

Attendu:
- API: `http://localhost:1234`
- Web: `http://localhost:4173`

## 6) URL a utiliser

- Connexion/inscription: `http://localhost:4173/auth/auth.html`
- Feed: `http://localhost:4173/feed/feed`

Ne pas utiliser `/auth/auth` directement si rewrite indisponible.

## 7) Verification rapide (si login/inscription ne marche pas)

1. API repond:
```bash
curl http://localhost:1234/health
```

2. Env charge:
```bash
curl http://localhost:1234/env-check
```

3. DB/Redis OK:
```bash
curl http://localhost:1234/db-test
curl http://localhost:1234/redis-test
```

4. Browser:
- vider cache (`Ctrl+F5`)
- verifier Console + Network sur `auth.html`

## 8) Erreurs frequentes

- `404 /auth/auth`: ouvrir `.../auth/auth.html`
- `INVALID_CLIENT: Invalid redirect URI`: mismatch OAuth Spotify/GitHub
- `Token manquant`: non connecte, ou token local absent/expire
- `Could not read ... serve.json`: verifier script `dev:web` et chemin config

