# US-008 - News et categories musique

## Story
En tant qu'utilisateur, je veux voir des categories musicales et des news musique avec des donnees exploitables pour decouvrir des titres, albums et activites pertinentes depuis l'accueil.

## Criteres d'acceptation
1. L'accueil charge des categories musique via `GET /music/categories` quand aucun flux personnalise Spotify n'est disponible.
2. Si Spotify est connecte, l'application tente d'abord de charger `GET /music/personalized` puis retombe proprement sur `GET /music/categories` en cas d'echec.
3. Les categories exposees contiennent au minimum `trending`, `rap`, `afro` et `pop`, avec des items exploitables pour affichage de tuiles.
4. Un item de categorie exploitable contient un identifiant, un nom, un type coherent et une image exploitable cote front.
5. Le bloc news charge `GET /music/news` et separe les nouvelles sorties des activites communaute.
6. Les releases renvoyees par `music/news` contiennent des informations exploitables comme le nom, les artistes, le type media, l'image et un lien Spotify quand disponible.
7. Les items communaute renvoyes par `music/news` permettent d'afficher une activite lisible avec media cible, auteur et texte ou meta associee.
8. En cas de limitation Spotify ou d'erreur distante, les endpoints conservent un comportement degrade explicite via cache, fallback de recherche ou items vides documentes, sans casser l'accueil.
9. Le front accueil n'affiche pas un simple "API vivante" mais transforme reellement les donnees recues en cartes et listes consultables.
10. Le bouton de refresh des news recharge immediatement les donnees `music/news` sans recharger toute la page.

## Notes techniques
- Front accueil: `apps/web/public/accueil/accueil.html`, `apps/web/public/accueil/accueil.js`
- Styles accueil/news: `apps/web/public/noyau/styles.css`
- API musique: `apps/api/src/index.ts`
