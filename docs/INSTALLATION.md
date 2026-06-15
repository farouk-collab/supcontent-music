# Installation et déploiement

## Prérequis

- Node.js 20 ;
- npm 10 ou version compatible ;
- Docker Desktop avec Compose v2 ;
- Android Studio et JDK 17 pour produire l'APK ;
- clés Spotify et OAuth pour activer les services externes.

## Installation locale

```powershell
git clone https://github.com/farouk-collab/supcontent-music.git
cd supcontent-music
npm ci
Copy-Item apps/api/.env.example apps/api/.env
```

Compléter ensuite `apps/api/.env` avec les clés du projet.

Lancer le web et l'API :

```powershell
npm run dev
```

Services locaux :

| Service | Adresse |
|---|---|
| Web | `http://localhost:4173` |
| API | `http://localhost:1234` |
| Swagger/OpenAPI | `http://localhost:1234/docs` |

## Docker Compose

Pour une démonstration locale sans installation manuelle de PostgreSQL et
Redis :

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Le compose démarre :

- API sur le port `1234` ;
- web sur le port `4173` ;
- PostgreSQL sur le port `5432` ;
- Redis sur le port `6379` ;
- pgAdmin sur le port `5050`.

Arrêt :

```powershell
docker compose down
```

## Application mobile

Lancer Expo sur le réseau local :

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://ADRESSE_IP_DU_PC:1234"
npm --workspace apps/mobile run start -- --lan
```

Le téléphone et le PC doivent être connectés au même réseau Wi-Fi.

Adresses habituelles :

- émulateur Android : `http://10.0.2.2:1234` ;
- téléphone physique : `http://192.168.x.x:1234` ;
- web/iOS local : `http://localhost:1234`.

## APK et AAB

```powershell
npm --workspace apps/mobile run android:apk
npm --workspace apps/mobile run android:aab
```

Sorties :

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

## Variables principales

| Variable | Description |
|---|---|
| `DATABASE_URL` | connexion PostgreSQL |
| `REDIS_URL` | connexion Redis |
| `SPOTIFY_CLIENT_ID` | identifiant Spotify |
| `SPOTIFY_CLIENT_SECRET` | secret Spotify |
| `GOOGLE_CLIENT_ID` | identifiant Google OAuth |
| `GOOGLE_CLIENT_SECRET` | secret Google OAuth |
| `GITHUB_CLIENT_ID` | identifiant GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | secret GitHub OAuth |
| `JWT_ACCESS_SECRET` | signature des access tokens |
| `JWT_REFRESH_SECRET` | signature des refresh tokens |
| `FRONTEND_URL` | URL utilisée pour les redirections |
| `CORS_ORIGINS` | origines web autorisées, séparées par des virgules |
| `EXPO_PUBLIC_API_BASE_URL` | URL API utilisée par le mobile |

Les secrets réels ne doivent jamais être ajoutés au dépôt Git.

