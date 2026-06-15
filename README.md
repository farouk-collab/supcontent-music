# SUPCONTENT Music

Réseau social musical basé sur l'API Spotify. Projet scolaire — SUPCONTENT.

## Documentation du projet

La documentation complète, les procédures de validation et les diagrammes UML
sont regroupés dans [docs/README.md](docs/README.md).

- [Architecture technique](docs/ARCHITECTURE.md)
- [Installation et déploiement](docs/INSTALLATION.md)
- [Guide utilisateur](docs/GUIDE_UTILISATEUR.md)
- [Référence API](docs/API.md)
- [Tests et recette](docs/VALIDATION.md)
- [Diagrammes UML](docs/uml/DIAGRAMMES.md)
- [Guide de soutenance](docs/SOUTENANCE.md)

---

## Table des matières

1. [Présentation](#présentation)
2. [Architecture](#architecture)
3. [Technologies](#technologies)
4. [Schéma de base de données](#schéma-de-base-de-données)
5. [Installation locale (développement)](#installation-locale-développement)
6. [Déploiement Docker](#déploiement-docker)
7. [Variables d'environnement](#variables-denvironnement)
8. [Fonctionnalités implémentées](#fonctionnalités-implémentées)
9. [Manuel utilisateur](#manuel-utilisateur)
10. [API — Endpoints principaux](#api--endpoints-principaux)

---

## Présentation

SUPCONTENT Music est une application full-stack permettant à ses utilisateurs de :

- Rechercher des musiques, albums et artistes via Spotify
- Gérer une bibliothèque personnelle (collections, statuts d'écoute)
- Publier des critiques et notes sur les médias musicaux
- Suivre d'autres utilisateurs et consulter un fil d'actualité
- Discuter via un système de chat
- Découvrir de nouveaux profils via le swipe de compatibilité musicale
- Accéder à l'application via navigateur web **et** application mobile (React Native / Expo)

---

## Architecture

```
supcontent-music/           ← Monorepo racine
├── apps/
│   ├── api/                ← Serveur Express + TypeScript
│   ├── web/                ← Client web (HTML/JS vanilla + Vite/Tailwind)
│   └── mobile/             ← Client mobile (React Native / Expo)
├── docs/                   ← Documentation & user stories
└── docker-compose.yml      ← Orchestration des services
```

### Flux de données

```
Navigateur / App Mobile
        │
        ▼
  [ API Express :1234 ]
        │         │
        ▼         ▼
  PostgreSQL    Redis
   (données)   (cache Spotify)
        │
        ▼
  API Spotify (proxy)
```

Le client web et le client mobile communiquent exclusivement avec l'API REST. L'API proxifie les requêtes vers Spotify, met en cache les réponses dans Redis (TTL 300-900s) et gère un pool de secours en cas de rate-limiting.

---

## Technologies

| Couche | Technologie | Justification |
|--------|------------|---------------|
| **API** | Express + TypeScript | Typage fort, middlewares légers, grande communauté |
| **Base de données** | PostgreSQL 15 | Relationnelle, ACID, UUID natif, JSON support |
| **Cache** | Redis 7 | Réponses Spotify en cache, évite les 429 |
| **Auth** | JWT (access 15min + refresh 7j) | Stateless, scalable, refresh token en cookie HttpOnly |
| **OAuth** | Google + GitHub OAuth 2.0 | Connexion sociale simple |
| **Web** | Vanilla JS + Vite + Tailwind CSS | Pas de framework lourd, pages indépendantes, CSS utilitaire |
| **Mobile** | React Native (Expo) | Cross-platform iOS/Android depuis une base commune |
| **Docker** | Docker Compose | Déploiement reproductible en une commande |

---

## Schéma de base de données

Les tables sont créées automatiquement au démarrage de l'API via des fonctions `ensureXxxTables()`.

### Tables principales

```sql
-- Authentification
users (
  id UUID PK,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  password_hash TEXT,         -- null si OAuth
  role TEXT DEFAULT 'user',   -- 'user' | 'admin' | 'moderator'
  banned BOOLEAN DEFAULT false,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ
)

refresh_tokens (
  id UUID PK,
  user_id UUID FK → users,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ
)

github_oauth (
  id UUID PK,
  user_id UUID FK → users,
  github_id TEXT UNIQUE,
  username TEXT,
  access_token TEXT
)

-- Collections / Bibliothèque
collections (
  id UUID PK,
  user_id UUID FK → users,
  name TEXT,
  is_default BOOLEAN,
  slug TEXT,                  -- 'a-ecouter' | 'en-cours' | 'termine' | 'abandonne'
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
)

collection_items (
  id UUID PK,
  collection_id UUID FK → collections,
  media_type TEXT,            -- 'track' | 'album' | 'artist'
  media_id TEXT,
  added_at TIMESTAMPTZ
)

-- Social
reviews (
  id UUID PK,
  user_id UUID FK → users,
  media_type TEXT,
  media_id TEXT,
  rating INTEGER,             -- 1..5
  body TEXT,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

review_votes (
  id UUID PK,
  review_id UUID FK → reviews,
  user_id UUID FK → users,
  vote TEXT                   -- 'up' | 'down'
)

review_comments (
  id UUID PK,
  review_id UUID FK → reviews,
  user_id UUID FK → users,
  body TEXT,
  created_at TIMESTAMPTZ
)

-- Réseau social
follows (
  follower_id UUID FK → users,
  following_id UUID FK → users,
  created_at TIMESTAMPTZ,
  PRIMARY KEY (follower_id, following_id)
)

-- Modération
content_reports (
  id UUID PK,
  reporter_id UUID FK → users,
  review_id UUID FK → reviews,
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ
)

-- Chat
chat_threads (
  id UUID PK,
  participant_1 UUID FK → users,
  participant_2 UUID FK → users,
  created_at TIMESTAMPTZ
)

chat_messages (
  id UUID PK,
  thread_id UUID FK → chat_threads,
  sender_id UUID FK → users,
  body TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Installation locale (développement)

### Prérequis

- Node.js ≥ 20
- PostgreSQL 15 (ou Docker)
- Redis (ou Docker, ou `REDIS_DISABLED=1` dans `.env`)
- Expo CLI (`npm install -g expo-cli`) pour le mobile

### 1. Cloner le projet

```bash
git clone <URL_DU_REPO>
cd supcontent-music
```

### 2. Installer les dépendances

```bash
npm install          # dépendances racine
npm install --workspace apps/api
npm install --workspace apps/web
npm install --workspace apps/mobile
```

Ou en une commande depuis la racine (workspaces) :

```bash
npm install
```

### 3. Configurer l'environnement

```bash
cp apps/api/.env.example apps/api/.env
# Éditez apps/api/.env avec vos clés Spotify, GitHub et l'URL de votre base PostgreSQL
```

### 4. Lancer l'API

```bash
npm --workspace apps/api run dev
# API disponible sur http://localhost:1234
```

### 5. Lancer le client web

```bash
npm --workspace apps/web run dev
# Web disponible sur http://localhost:5173
```

### 6. Lancer l'application mobile

```bash
cd apps/mobile
npx expo start
# Scannez le QR code avec Expo Go (iOS/Android)
```

---

## Déploiement Docker

### Prérequis

- Docker Desktop ou Docker Engine + Compose v2
- Fichier `.env` à la racine du projet (voir section Variables d'environnement)

### Lancer tous les services

```bash
# À la racine du projet
docker compose up --build
```

Cela démarre :

| Service | Port | Description |
|---------|------|-------------|
| `supcontent-api` | 1234 | API REST Express |
| `supcontent-web` | 4173 | Client web (nginx) |
| `supcontent-db` | 5432 | PostgreSQL 15 |
| `supcontent-redis` | 6379 | Redis 7 |
| `supcontent-pgadmin` | 5050 | Interface pgAdmin |

### Accès

- **Web** : http://localhost:4173
- **API** : http://localhost:1234
- **API Docs** : http://localhost:1234/docs
- **pgAdmin** : http://localhost:5050 (admin@admin.com / admin)

### Arrêter les services

```bash
docker compose down
# Pour supprimer aussi les volumes :
docker compose down -v
```

---

## Variables d'environnement

Le fichier `apps/api/.env.example` liste toutes les variables requises.

| Variable | Obligatoire | Description |
|----------|------------|-------------|
| `PORT` | Non (défaut: 1234) | Port d'écoute de l'API |
| `DATABASE_URL` | **Oui** | URL de connexion PostgreSQL |
| `REDIS_URL` | Non | URL Redis (ex: `redis://localhost:6379`) |
| `REDIS_DISABLED` | Non | Mettre `1` pour désactiver le cache Redis |
| `SPOTIFY_CLIENT_ID` | **Oui** | ID de l'app Spotify Developer |
| `SPOTIFY_CLIENT_SECRET` | **Oui** | Secret de l'app Spotify Developer |
| `SPOTIFY_REDIRECT_URI` | **Oui** | URI de callback OAuth Spotify |
| `GOOGLE_CLIENT_ID` | Non | ID de l'app Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Non | Secret de l'app Google OAuth |
| `GOOGLE_REDIRECT_URI` | Non | URI de callback OAuth Google |
| `GITHUB_CLIENT_ID` | Non | ID de l'app GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Non | Secret de l'app GitHub OAuth |
| `GITHUB_REDIRECT_URI` | Non | URI de callback OAuth GitHub |
| `JWT_ACCESS_SECRET` | **Oui** | Clé secrète pour les access tokens (≥32 chars) |
| `JWT_REFRESH_SECRET` | **Oui** | Clé secrète pour les refresh tokens (≥32 chars) |
| `ACCESS_TOKEN_TTL` | Non (défaut: 15m) | Durée de vie de l'access token |
| `REFRESH_TOKEN_TTL` | Non (défaut: 7d) | Durée de vie du refresh token |
| `FRONTEND_URL` | Non | URL du frontend (redirections OAuth) |

> Les secrets ne doivent **jamais** être commités dans le dépôt. Le fichier `.env` est ignoré par `.gitignore`.

---

## Fonctionnalités implémentées

### Authentification (web + mobile)
- Inscription email/mot de passe
- Connexion email/mot de passe
- Connexion via Google OAuth (web + mobile)
- Connexion via GitHub OAuth (web)
- Liaison compte Spotify (écoute personnalisée)
- Flux sécurisé de réinitialisation du mot de passe
- Refresh automatique des tokens JWT
- Déconnexion (invalidation du refresh token)
- Suppression de compte (RGPD)

### Recherche Spotify (web + mobile)
- Recherche par titre, artiste, album
- Filtres par type (titres / artistes / albums)
- Filtre par année (web)
- Tri par pertinence, popularité ou nom (web)
- Cache Redis des résultats (TTL 300s)
- Pool de secours en cas de rate-limiting Spotify

### Bibliothèque / Collections (web + mobile)
- Collections par défaut : À écouter, En cours, Terminé, Abandonné
- Listes personnalisées (nom, visibilité publique/privée)
- Ajout/suppression de médias dans les collections
- Changement de statut d'un média

### Social — Critiques (web + mobile)
- Publication de critiques avec note (1–5 étoiles) et texte
- Modification et suppression de ses critiques
- Vote pour/contre (👍/👎) sur les critiques
- Commentaires sur les critiques
- Détail d'un média avec stats communautaires (note moyenne, nombre d'avis)

### Réseau social (web + mobile)
- Suivre / ne plus suivre des utilisateurs
- Fil d'actualité personnalisé (activités des personnes suivies)
- Notifications (nouveaux abonnés, réponses aux commentaires)
- Profil public avec statistiques

### Swipe de compatibilité musicale (web)
- Découverte de profils selon goûts musicaux
- Système de match / invitation

### Chat (web)
- Messagerie directe entre utilisateurs connectés

### Modération (web — admin uniquement)
- Tableau de bord des signalements
- Suppression de critiques signalées
- Mise en avant de critiques (coup de cœur)
- Gestion des utilisateurs (bannir, promouvoir admin)
- Recherche d'utilisateurs

### Profil et paramètres
- Modification du profil (pseudo, bio, avatar) sur web et mobile
- Thème (sombre/clair/custom) sur le web
- Préférences de notifications sur le web
- Exportation des données RGPD (JSON / CSV) sur le web
- Gestion des utilisateurs bloqués sur le web

---

## Manuel utilisateur

### Création de compte

1. Accédez à `/connexion/connexion.html` (web) ou lancez l'app mobile
2. Cliquez sur **"Créer un compte"**
3. Renseignez votre email, pseudo et mot de passe
4. Validez — vous êtes connecté automatiquement

Pour utiliser Google ou GitHub : cliquez **"Continuer avec Google"** / **"Continuer avec GitHub"** et autorisez l'application.

### Rechercher de la musique

1. Cliquez sur **Recherche** dans la navigation
2. Tapez un titre, artiste ou album dans la barre de recherche
3. Filtrez par **type** (Titres / Artistes / Albums), **année** ou **tri** selon vos préférences
4. Cliquez sur un résultat pour voir le détail du média

### Ajouter un média à votre bibliothèque

1. Ouvrez le détail d'un média (titre, album ou artiste)
2. Cliquez **"+ Collection"**
3. Choisissez un statut : *À écouter*, *En cours*, *Terminé*, *Abandonné*
4. Ou sélectionnez une liste personnalisée

### Écrire une critique

1. Depuis le détail d'un média, cliquez **"Donner un avis"**
2. Attribuez une note (1 à 5 étoiles) et rédigez votre critique
3. Validez — votre avis apparaît dans le fil de la communauté

### Suivre un utilisateur

1. Accédez au profil d'un utilisateur (via la recherche d'utilisateurs ou une critique)
2. Cliquez **"Suivre"** — vous verrez ses activités dans votre fil d'actualité

### Exporter ses données (RGPD)

1. Allez dans **Paramètres**
2. Section *Mes données personnelles*
3. Cliquez **"Exporter JSON"** ou **"Exporter CSV"**
4. Le fichier est téléchargé automatiquement

### Accès administration (rôle admin)

1. Votre compte doit avoir le rôle `admin` (modifiable en base de données)
2. Accédez à `/moderation/moderation-advanced.html`
3. Gérez les signalements et les utilisateurs

---

## API — Endpoints principaux

La documentation interactive complète est disponible sur `http://localhost:1234/docs` (Swagger UI).

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/health` | — | Santé de l'API |
| GET | `/search?q=&type=` | — | Recherche Spotify |
| GET | `/media/:type/:id` | — | Détail d'un média |
| POST | `/auth/register` | — | Inscription |
| POST | `/auth/login` | — | Connexion |
| GET | `/auth/me` | ✓ | Profil connecté |
| GET | `/collections/me` | ✓ | Mes collections |
| POST | `/collections` | ✓ | Créer une collection |
| POST | `/collections/status/:status/items` | ✓ | Ajouter à un statut |
| GET | `/social/media/:type/:id` | — | Critiques d'un média |
| POST | `/social/media/:type/:id/reviews` | ✓ | Publier une critique |
| POST | `/social/reviews/:id/vote` | ✓ | Voter pour une critique |
| GET | `/feed/me` | ✓ | Fil d'actualité |
| GET | `/notifications/me` | ✓ | Notifications |
| POST | `/follows/:userId` | ✓ | Suivre un utilisateur |
| GET | `/admin/reports` | ✓ admin | Liste des signalements |
| DELETE | `/admin/reviews/:id` | ✓ admin | Supprimer une critique |
| POST | `/admin/users/:id/ban` | ✓ admin | Bannir un utilisateur |

---

## Équipe

Projet réalisé dans le cadre du cours SUPCONTENT.
