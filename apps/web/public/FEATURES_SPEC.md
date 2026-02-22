# SUPCONTENT - Spec Equipe (Version Appel d'Offres)

Ce document aligne le projet avec le cahier des charges officiel et le bareme.
Media retenu: **Musique (Spotify)**.

## 1) Perimetre produit

SUPCONTENT est un reseau social niche musique avec:
- decouverte d'oeuvres musicales (tracks/albums/artists),
- bibliotheque perso (statuts + listes),
- critiques/notes/interactions sociales,
- fil d'actualite et notifications,
- integration API tierce via **backend uniquement**.

## 2) Architecture imposee (obligatoire)

- Serveur API: `apps/api`
- Client web: `apps/web/public`
- Client mobile: **a livrer** (actuellement manquant/partiel selon l'equipe)
- Base de donnees: PostgreSQL + Redis cache
- API tierce: Spotify (aucun appel direct Spotify depuis clients)

## 3) Regles de dev (importantes)

- Pas de logique metier critique dans le front.
- Aucun secret en clair dans le code versionne.
- Toute feature "notee" doit etre fonctionnelle backend + web + mobile pour marquer tous les points.

## 4) Mapping bareme -> fonctionnalites

## 4.1 Connexion (30 pts)

### Obligatoire
- Email/mot de passe (register/login/logout)
- OAuth2 provider (GitHub deja present)

### Statut cible
- `DONE`: auth classique + GitHub OAuth
- `TODO`: ajouter au moins un 2e provider (optionnel mais utile robustesse demo)

## 4.2 Integration API tierce & recherche (50 pts)

### Obligatoire
- Recherche dynamique + visuels + pagination
- Fiche detaillee oeuvre
- Cache intelligent
- Filtrage/tri

### Statut cible
- `DONE`: `/search`, `/media/:type/:id`, cache + fallback, page recherche
- `TODO`: filtres avances (genre/annee/tri popularite/date) dans UI recherche

## 4.3 Bibliotheque & listes (40 pts)

### Obligatoire
- Statuts: a voir/en cours/termine/abandonne
- Listes perso (create/edit/delete)
- Confidentialite public/prive

### Statut cible
- `DONE`: collections + status + listes + visibilite
- `TODO`: dashboard stats collection plus complet (temps passe, etc.)

## 4.4 Social & critiques (40 pts)

### Obligatoire
- Notation + critique textuelle + edit/delete
- Likes + commentaires
- Follow/unfollow + followers/following

### Statut cible
- `DONE`: reviews/comments/votes/follows
- `TODO`: UX moderation spoilers + meilleurs garde-fous anti-abus

## 4.5 Fil d'actualite & notifications (30 pts)

### Obligatoire
- Feed chronologique des follows
- Notifs lues/non lues + maj reguliere/temps reel

### Statut cible
- `DONE`: feed + notifications + refresh
- `TODO`: vrai temps reel (SSE/WebSocket) + indicateur non lu robuste

## 5) Nouvelles fonctionnalites (dossiers crees)

Ces dossiers sont des placeholders a implementer:

- `apps/web/public/radio-artist/`
  - `radio-artist.html`, `radio-artist.js`
  - Objectif: radio basee artiste

- `apps/web/public/music-profile/`
  - `music-profile.html`, `music-profile.js`
  - `apps/web/public/profile/music-profile.widgets.js`
  - Objectif: profil musical avance (stats)

- `apps/web/public/release-alerts/`
  - `release-alerts.html`, `release-alerts.js`
  - `apps/web/public/notifications/release-alerts.feed.js`
  - Objectif: alertes sorties artistes suivis

- `apps/web/public/social-recommendations/`
  - `social-recommendations.html`, `social-recommendations.js`
  - `apps/web/public/recommendations/social-recommendations.feed.js`
  - Objectif: reco sociales basees gouts communs

- `apps/web/public/moderation/moderation-advanced.html`
- `apps/web/public/moderation/moderation-advanced.js`
  - Objectif: moderation avancee (reports/actions)

- `apps/web/public/calls/`
  - `calls.html`, `calls.js`
  - Objectif: appel audio/video simple (mutual follow)

- `apps/web/public/suggestions/`
  - `suggestions.html`, `suggestions.js`
  - Objectif: page dediee suggestions "compatibilite musicale"

## 6) Contrat API propose pour les nouvelles features

- `GET /radio/artist/:spotifyArtistId`
- `GET /music-profile/me`
- `GET /release-alerts/me`
- `POST /release-alerts/:id/read`
- `GET /social-recommendations/me`
- `GET /suggestions/me`
- `POST /calls/start`
- `POST /calls/:id/accept`
- `POST /calls/:id/end`
- `GET /moderation/reports`
- `POST /moderation/reports/:id/action`

## 7) Priorites implementation (ordre recommande)

1. **Filtrage/tri recherche** (points rapides + demo forte)
2. **Notifications temps reel** (SSE simple)
3. **Moderation avancee** (report + action admin)
4. **Suggestions musicales** (valeur produit differenciante)
5. **Profil musical avance** (analytics + engagement)
6. **Alertes sorties**
7. **Radio artiste**
8. **Calls audio/video** (plus risquee techniquement)

## 8) Checklist rendu (obligatoire)

### Technique
- [ ] `docker-compose.yml` lance au moins: API + web + DB
- [ ] commande unique: `docker compose up`
- [ ] migrations/init DB automatiques ou documentees

### Documentation
- [ ] installation + prerequis + cles API
- [ ] guide de deploiement
- [ ] choix technos justifies
- [ ] UML (use case + sequence API tierce)
- [ ] schema BDD
- [ ] manuel utilisateur

### Securite
- [ ] aucun secret en clair dans git
- [ ] `.env.example` propre
- [ ] mots de passe hashes
- [ ] tokens/sessions valides et invalidation logout

### Git
- [ ] historique coherent (commits lisibles)
- [ ] depot prive avant deadline

## 9) Definition of Done (pour chaque feature)

- backend route(s) fonctionnelles,
- web fonctionnel sans erreur console bloquante,
- mobile implemente (si feature comptee dans bareme final),
- cas d'erreur geres,
- tests manuels minimum notes dans la PR.

