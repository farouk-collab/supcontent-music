# US-007 - Swipe, likes et matchs

## Story
En tant qu'utilisateur connecte, je veux swiper des profils et des musiques, voir qui m'a like, utiliser un vrai superlike et retrouver mes matchs persistants pour decouvrir des personnes compatibles musicalement.

## Criteres d'acceptation
1. La page `swipe.html` charge des cartes profil depuis `GET /follows/swipe/profiles` et des cartes musique depuis `GET /follows/swipe/music`.
2. Un swipe profil accepte les directions `like`, `pass` et `superlike`, et le superlike est persiste cote API.
3. Si deux utilisateurs se likent mutuellement, un match persistant est cree cote backend et rechargé via `GET /follows/swipe/matches/me`.
4. L'onglet `Ils t'ont like` affiche uniquement les donnees de `GET /follows/swipe/likes-you` pour un utilisateur connecte, sans fallback mock.
5. L'onglet `Matchs` affiche les matchs reellement persistés par l'API et propose l'ouverture du chat quand la relation le permet.
6. Un superlike recu est identifiable dans l'interface et priorise dans la liste `Ils t'ont like`.
7. Les invitations de chat issues du swipe sont chargees depuis `GET /follows/swipe/invitations/me`.
8. Les preferences de swipe permettent de filtrer les profils selon l'age, le genre et la distance quand ces informations sont disponibles.
9. Les protections mineur/majeur empechent un swipe profil non autorise entre cohortes incompatibles.
10. En mode connecte, une erreur de chargement sur `likes-you` ou `matches` n'affiche pas de faux resultats locaux.

## Notes techniques
- Front swipe: `apps/web/public/swipe/swipe.html`, `apps/web/public/swipe/swipe.js`
- API swipe/follows: `apps/api/src/routes/follows.ts`
- DB swipe/matchs: `apps/api/src/db/follows.ts`
- Catalogue API: `apps/api/src/index.ts`
