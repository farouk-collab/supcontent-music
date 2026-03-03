# Fonctionnalites Par Page

## Global (toutes les pages)
- Footer mobile: navigation rapide (`Accueil`, `Recherche`, `Swipe`, `Chat`, `Bibliotheque`, `Profil`).
- Header simplifie: liens utiles hors footer (actuellement `Utilisateurs` + `Connexion`).
- `Connexion` s'affiche seulement si l'utilisateur n'est pas connecte.
- Protection de fonctionnalites: certaines actions exigent une connexion (`requireLogin`), sinon redirection vers `/connexion/connexion.html`.

## Accueil
- Affichage d'un feed principal.
- CTA de navigation vers recherche/profil.
- Redirection vers connexion pour actions reservees.

## Recherche
- Barre de recherche musique (Spotify/YouTube).
- Filtres de type (`Titres`, `Artistes`, `Albums`).
- Import de playlist:
- Choix de source `YouTube` ou `Spotify`.
- Champ URL + bouton `Charger la playlist`.
- Liste `Playlists importees`.
- Actions (cote a cote): `Fusionner playlists`, `Lire les musiques`, `Synchroniser plateformes`, `Favoris uniquement`.
- Actions d'import protegees par connexion.

## Utilisateurs
- Recherche de comptes par nom / username.
- Affichage profil utilisateur.
- Actions sociales selon statut de connexion (follow, navigation profil).

## Profil
- Affichage profil perso ou visiteur.
- Publications / stories.
- Upload media (image/video), edition et suppression.
- Actions follow/unfollow.
- Boutons compte (deconnexion, suppression compte).
- Actions sensibles reservees a l'utilisateur connecte.

## Profil Modifier
- Edition des informations de profil.
- Upload avatar/cover.
- Sauvegarde profil via API.
- Acces reserve a l'utilisateur connecte.

## Bibliotheque
- Collections utilisateur via API.
- Filtres (`all`, `track`, `artist`, `album`).
- Creation playlist.
- Lecture d'un media depuis la collection.
- Favoris locaux.
- Actions: fusion, sync, favoris uniquement.
- Actions reservees a l'utilisateur connecte.

## Swipe
- Swipe profils et swipe musique.
- Actions follow/invitation/chat selon match.
- Filtres swipe (age, distance, genres, etc.).
- Geolocalisation optionnelle.
- Fonctionnalites swipe reservees a l'utilisateur connecte.

## Discussion (Chat)
- Zone chat (WIP selon etat du projet).
- Invitations recues depuis swipe.
- Affichage conditionne par connexion.

## Media
- Page de detail media (track/artist/album).
- Lecture/affichage details.
- Navigation vers sections associees.

## Connexion
- Connexion email/mot de passe.
- OAuth (selon variables configurees: Google, etc.).
- Inscription.
- Gestion tokens (`access`, `refresh`).
- Redirection vers page precedente possible via `next`.

## Parametres
- Page de reglages utilisateur.
- Liens de retour vers profil.

## API (resume)
- Auth: login/register/refresh/logout/reset.
- Users: search/update profile.
- Follows: follow/unfollow/list/block/swipe preferences.
- Profile posts: CRUD + endpoint `popular`.
- Collections: CRUD collections/items.
- Social/feed/notifications: endpoints associes.
