# US-005 - Bibliotheque et collections

## Story
En tant qu'utilisateur connecte, je veux gerer ma bibliotheque musicale (collections/statuts) pour organiser mes contenus.

## Criteres d'acceptation
1. L'ouverture de la page Bibliotheque charge les collections utilisateur sans erreur SQL.
2. Les identifiants utilises dans les routes SQL respectent les types attendus (UUID).
3. Les actions de statut/collection mettent a jour la base Postgres et l'interface.
4. Les erreurs backend sont exploitablement journalisees pour debug.

## Notes techniques
- Front: `apps/web/public/library.js`
- API/routes DB: `apps/api/src/routes/collections.ts`, `apps/api/src/db/collections.ts`
