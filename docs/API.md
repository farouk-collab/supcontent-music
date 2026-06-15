# API REST

## Principes

L'API répond en JSON. Les routes protégées utilisent :

```http
Authorization: Bearer ACCESS_TOKEN
```

La documentation interactive complète est exposée sur :

```text
GET /docs
GET /openapi.json
```

## Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | créer un compte |
| POST | `/auth/login` | ouvrir une session |
| POST | `/auth/refresh` | renouveler l'access token |
| POST | `/auth/logout` | révoquer le refresh token |
| GET | `/auth/me` | récupérer le profil courant |
| PATCH | `/auth/me` | modifier son profil |
| POST | `/auth/password/forgot` | demander une réinitialisation |
| POST | `/auth/password/reset` | définir un nouveau mot de passe |
| GET | `/auth/oauth/google/start` | démarrer Google OAuth |
| GET | `/auth/oauth/github/start` | démarrer GitHub OAuth |

Exemple :

```json
{
  "email": "demo@supcontent.local",
  "password": "DemoPass!2026"
}
```

## Catalogue musical

| Méthode | Route | Description |
|---|---|---|
| GET | `/search?q=...&type=track` | rechercher sur Spotify |
| GET | `/media/:type/:id` | récupérer une fiche média |
| GET | `/spotify/playlist` | résoudre une playlist |

## Bibliothèque

| Méthode | Route | Description |
|---|---|---|
| GET | `/collections/me` | collections de l'utilisateur |
| POST | `/collections` | créer une collection |
| PATCH | `/collections/:id` | modifier une collection |
| DELETE | `/collections/:id` | supprimer une collection |
| POST | `/collections/:id/items` | ajouter une œuvre |
| DELETE | `/collections/:id/items/:type/:mediaId` | retirer une œuvre |
| POST | `/collections/status/:status/items` | changer le statut |

## Critiques

| Méthode | Route | Description |
|---|---|---|
| GET | `/social/media/:type/:id` | critiques et statistiques |
| POST | `/social/media/:type/:id/reviews` | publier une critique |
| PATCH | `/social/reviews/:id` | modifier sa critique |
| DELETE | `/social/reviews/:id` | supprimer sa critique |
| POST | `/social/reviews/:id/vote` | voter |
| POST | `/social/reviews/:id/comments` | commenter |

## Social

| Méthode | Route | Description |
|---|---|---|
| GET | `/users/search` | rechercher des membres |
| POST | `/follows/:userId` | suivre |
| DELETE | `/follows/:userId` | ne plus suivre |
| GET | `/follows/me` | abonnés et abonnements |
| GET | `/feed/me` | fil chronologique |
| GET | `/notifications/me` | notifications |
| GET | `/notifications/stream` | flux temps réel SSE authentifié |
| GET | `/chat/threads` | conversations |
| POST | `/chat/threads/:id/messages` | envoyer un message |

Le flux `/notifications/stream` émet un événement `notification` lors d'un
nouvel abonnement, d'une réponse à un commentaire ou d'un message reçu. Le
client recharge ensuite les données détaillées via `/notifications/me`.

## Boutique et administration

| Méthode | Route | Description |
|---|---|---|
| GET | `/shop/products` | catalogue |
| GET | `/shop/cart` | panier |
| POST | `/shop/cart/items` | ajouter au panier |
| POST | `/shop/checkout` | confirmer une commande |
| POST | `/shop/products` | publier un produit |
| GET | `/admin/reports` | signalements |
| POST | `/admin/users/:id/ban` | bannir un membre |

## Codes HTTP

- `200` lecture ou modification réussie ;
- `201` ressource créée ;
- `400` données invalides ;
- `401` authentification requise ;
- `403` action interdite ;
- `404` ressource absente ;
- `409` conflit ou doublon ;
- `500` erreur serveur.
