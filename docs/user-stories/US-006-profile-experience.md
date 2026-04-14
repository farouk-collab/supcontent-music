# US-006 - Profil utilisateur

## Story
En tant qu'utilisateur, je veux consulter mon profil et celui des autres, modifier mes informations, suivre des profils et publier du contenu pour presenter mon identite musicale dans l'application.

## Criteres d'acceptation
1. L'ouverture de `profil.html` charge soit le profil connecte, soit un profil public cible via `?user=...`.
2. Un utilisateur non connecte voit un etat "connexion requise" pour son propre profil au lieu d'un faux contenu local.
3. Le profil affiche les informations principales: avatar, cover, display name, username, bio, email, localisation, genre, date de naissance, site web et compteurs sociaux.
4. Depuis un profil public, un utilisateur connecte peut suivre ou ne plus suivre le profil via l'API, et l'etat du bouton est rafraichi apres l'action.
5. Depuis son propre profil, un utilisateur peut creer une publication, un reel ou une story avec media, description et meta associees.
6. Les stories actives disparaissent du flux apres 24 h, sauf si elles sont enregistrees dans le profil en highlights.
7. Le profil permet de filtrer les contenus par onglet `Publications`, `Reels` et `Stories`.
8. Un utilisateur peut modifier ou supprimer ses propres publications depuis la vue detail d'un media.
9. Les contenus du profil sont persistés cote API via les routes `profile-posts` et recharges depuis le backend.
10. L'acces a l'edition du profil et a la gestion du compte reste reserve au proprietaire du profil.

## Notes techniques
- Front profil: `apps/web/public/profil/profil.html`, `apps/web/public/profil/profil.js`
- Front edition profil: `apps/web/public/profil/profil-modifier.html`, `apps/web/public/profil/profil-modifier.js`
- API auth/profil: `apps/api/src/routes/auth.ts`
- API follows: `apps/api/src/routes/follows.ts`
- API posts profil: `apps/api/src/routes/profilePosts.ts`
- DB posts profil: `apps/api/src/db/profilePosts.ts`
