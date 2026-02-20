# US-002 - Espace commentaires social

## Story
En tant qu'utilisateur connecte, je veux publier des avis et des reponses, voter et gerer mes contenus sur une musique.

## Criteres d'acceptation
1. Je peux publier un avis principal (note + texte + image/sticker).
2. Je peux repondre a un avis via un commentaire imbrique.
3. Je peux voter `👍` ou `👎` sur un avis et sur un commentaire.
4. Je peux modifier mon propre commentaire/reponse.
5. Je peux supprimer:
- mon commentaire/reponse
- mon avis principal
6. Le tri des avis supporte `populaires` et `recents`.
7. Si je ne suis pas connecte, je vois un message invitant a se connecter.

## Notes techniques
- Front: `apps/web/public/media/social.js`
- API:
  - `GET /social/media/:mediaType/:mediaId`
  - `POST /social/media/:mediaType/:mediaId/reviews`
  - `DELETE /social/reviews/:reviewId`
  - `POST /social/reviews/:reviewId/comments`
  - `PATCH /social/comments/:commentId`
  - `DELETE /social/comments/:commentId`
  - votes review/comment
