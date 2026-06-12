# Mobile App

Client mobile Expo/React Native pour SUPCONTENT Music.

## Fonctionnel (MVP)
- Auth: register/login/logout + Google OAuth
- Recherche media: `/search`
- Detail media: `/media/:type/:id`
- Profil: lecture + edition via `/auth/me`
- Boutique mobile: catalogue, preview, favoris, panier, checkout, publication
- Session persistante (access + refresh token)

Le client mobile appelle uniquement l'API backend (`apps/api`) et jamais Spotify directement.

## Google OAuth

Le flux mobile Google repasse par le backend puis revient dans l'app avec le deep link :

- `supcontentmusic://auth/callback`

Variables backend obligatoires :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Lancement
1. Installer les dependances a la racine:
   - `npm install`
2. Lancer l'API (port 1234):
   - `npm run dev:api`
3. Lancer le mobile:
   - `npm --workspace apps/mobile run start`

## Branding mobile
- Nom app: `SUPCONTENT Music`
- Android package: `com.supcontent.music`
- Assets mobile:
  - `apps/mobile/assets/icon.png`
  - `apps/mobile/assets/adaptive-icon.png`
  - `apps/mobile/assets/splash-icon.png`

Pour regenerer ces assets:
- `npm --workspace apps/mobile run assets:generate`

## Android Studio
Pour generer la vraie base Android native:
1. Depuis la racine, lancer:
   - `npm --workspace apps/mobile run android:native`
2. Un dossier `apps/mobile/android` sera genere.
3. Ouvrir ensuite ce dossier dans Android Studio.
4. Tu pourras alors compiler une vraie app Android, gerer les signatures et produire un APK/AAB.

## Builds release Android
- APK release:
  - `npm --workspace apps/mobile run android:apk`
- AAB release:
  - `npm --workspace apps/mobile run android:aab`

Sorties attendues:
- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

Prerequis release:
- Android Studio + Android SDK
- JDK installe
- Signature release Android a configurer si tu veux publier sur le Play Store

## URL API
Par defaut:
- Android emulator: `http://10.0.2.2:1234`
- iOS simulator / Web: `http://localhost:1234`

Pour forcer l'URL:
- PowerShell: `$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.20:1234"`
- puis relancer `npm --workspace apps/mobile run start`
