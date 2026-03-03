# Mobile App

Client mobile Expo/React Native pour SUPCONTENT Music.

## Fonctionnel (MVP)
- Auth: register/login/logout
- Recherche media: `/search`
- Detail media: `/media/:type/:id`
- Profil: lecture + edition via `/auth/me`
- Session persistante (access + refresh token)

Le client mobile appelle uniquement l'API backend (`apps/api`) et jamais Spotify directement.

## Lancement
1. Installer les dependances a la racine:
   - `npm install`
2. Lancer l'API (port 1234):
   - `npm run dev:api`
3. Lancer le mobile:
   - `npm --workspace apps/mobile run start`

## URL API
Par defaut:
- Android emulator: `http://10.0.2.2:1234`
- iOS simulator / Web: `http://localhost:1234`

Pour forcer l'URL:
- PowerShell: `$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.20:1234"`
- puis relancer `npm --workspace apps/mobile run start`
