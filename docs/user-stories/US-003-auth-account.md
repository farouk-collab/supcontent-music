# US-003 - Authentification et compte

## Story
En tant qu'utilisateur, je veux creer un compte, me connecter et gerer mon profil.

## Criteres d'acceptation
1. Un utilisateur peut s'inscrire avec email/mot de passe.
2. Si l'email existe deja, l'API renvoie une erreur metier claire (409).
3. Un utilisateur peut se connecter et obtenir une session/token.
4. Un utilisateur peut se deconnecter.
5. Un utilisateur peut supprimer son compte depuis l'espace profil.

## Notes techniques
- Front principal: `apps/web/public/auth.html`, `apps/web/public/profile.html`, `apps/web/public/profile.js`
- API auth: `apps/api/src/routes/auth.ts`
