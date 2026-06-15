# Diagrammes UML et données

## Cas d'utilisation

```mermaid
flowchart LR
  VIS["Visiteur"]
  USER["Utilisateur"]
  ADMIN["Administrateur"]
  OAUTH["Fournisseur OAuth"]

  subgraph APP["SUPCONTENT Music"]
    UC1["Consulter les contenus publics"]
    UC2["Créer un compte / se connecter"]
    UC3["Rechercher une œuvre"]
    UC4["Gérer la bibliothèque"]
    UC5["Publier une critique"]
    UC6["Suivre des membres"]
    UC7["Consulter le fil et les notifications"]
    UC8["Utiliser le chat"]
    UC9["Utiliser la boutique"]
    UC10["Configurer le compte"]
    UC11["Modérer les contenus"]
    UC12["Gérer les utilisateurs"]
  end

  VIS --> UC1
  VIS --> UC2
  VIS --> UC3
  USER --> UC3
  USER --> UC4
  USER --> UC5
  USER --> UC6
  USER --> UC7
  USER --> UC8
  USER --> UC9
  USER --> UC10
  ADMIN --> UC11
  ADMIN --> UC12
  OAUTH --> UC2
```

## Diagramme de composants

```mermaid
flowchart TB
  subgraph CLIENTS["Clients"]
    WEB["Web HTML/JS + Vite"]
    MOBILE["React Native / Expo"]
  end

  subgraph SERVER["Serveur"]
    REST["API REST Express"]
    AUTH["JWT / OAuth"]
    DOMAIN["Services métier"]
    CACHE["Adaptateur cache"]
    DATA["Accès PostgreSQL"]
  end

  SPOTIFY["Spotify Web API"]
  GOOGLE["Google OAuth"]
  GITHUB["GitHub OAuth"]
  REDIS[("Redis")]
  PG[("PostgreSQL")]

  WEB --> REST
  MOBILE --> REST
  REST --> AUTH
  REST --> DOMAIN
  AUTH --> GOOGLE
  AUTH --> GITHUB
  DOMAIN --> CACHE
  DOMAIN --> DATA
  CACHE --> REDIS
  DOMAIN --> SPOTIFY
  DATA --> PG
```

## Diagramme de déploiement

```mermaid
flowchart LR
  PHONE["Téléphone Android/iOS"]
  BROWSER["Navigateur"]

  subgraph HOST["Hôte Docker / Cloud"]
    WEB["Conteneur Web :4173"]
    API["Conteneur API :1234"]
    PG[("PostgreSQL :5432")]
    REDIS[("Redis :6379")]
  end

  SPOTIFY["Spotify"]
  OAUTH["Google / GitHub"]

  PHONE --> API
  BROWSER --> WEB
  WEB --> API
  API --> PG
  API --> REDIS
  API --> SPOTIFY
  API --> OAUTH
```

## Diagramme de classes métier

```mermaid
classDiagram
  class User {
    UUID id
    string email
    string username
    string displayName
    string role
    bool banned
  }

  class Collection {
    UUID id
    string name
    bool isPublic
    string statusCode
  }

  class CollectionItem {
    string mediaType
    string mediaId
  }

  class Review {
    UUID id
    string mediaType
    string mediaId
    int rating
    string body
  }

  class ReviewComment {
    UUID id
    string body
  }

  class Follow {
    datetime createdAt
  }

  class ChatThread {
    UUID id
  }

  class ChatMessage {
    UUID id
    string body
    datetime createdAt
  }

  class ShopProduct {
    UUID id
    string title
    decimal price
    string license
  }

  class ShopOrder {
    UUID id
    decimal total
    string status
  }

  User "1" --> "*" Collection
  Collection "1" --> "*" CollectionItem
  User "1" --> "*" Review
  Review "1" --> "*" ReviewComment
  User "1" --> "*" ReviewComment
  User "*" --> "*" User : Follow
  ChatThread "*" --> "2" User
  ChatThread "1" --> "*" ChatMessage
  User "1" --> "*" ShopProduct
  User "1" --> "*" ShopOrder
```

## Modèle de données

```mermaid
erDiagram
  USERS ||--o{ REFRESH_TOKENS : owns
  USERS ||--o{ COLLECTIONS : creates
  COLLECTIONS ||--o{ COLLECTION_ITEMS : contains
  USERS ||--o{ REVIEWS : writes
  REVIEWS ||--o{ REVIEW_COMMENTS : receives
  USERS ||--o{ REVIEW_COMMENTS : writes
  USERS ||--o{ FOLLOWS : follower
  USERS ||--o{ FOLLOWS : followed
  USERS ||--o{ PROFILE_POSTS : publishes
  USERS ||--o{ CHAT_MESSAGES : sends
  CHAT_THREADS ||--o{ CHAT_MESSAGES : contains
  USERS ||--o{ SHOP_PRODUCTS : creates
  USERS ||--o{ SHOP_ORDERS : places
  SHOP_ORDERS ||--o{ SHOP_ORDER_ITEMS : contains
  SHOP_PRODUCTS ||--o{ SHOP_ORDER_ITEMS : references

  USERS {
    uuid id PK
    text email UK
    text username UK
    text password_hash
    text role
    boolean banned
  }
  COLLECTIONS {
    uuid id PK
    uuid user_id FK
    text name
    boolean is_public
    text status_code
  }
  COLLECTION_ITEMS {
    uuid collection_id FK
    text media_type
    text media_id
  }
  REVIEWS {
    uuid id PK
    uuid user_id FK
    text media_type
    text media_id
    int rating
    text body
  }
  REVIEW_COMMENTS {
    uuid id PK
    uuid review_id FK
    uuid user_id FK
    text body
  }
  FOLLOWS {
    uuid follower_id FK
    uuid following_id FK
  }
  CHAT_THREADS {
    uuid id PK
    uuid user_a_id FK
    uuid user_b_id FK
  }
  CHAT_MESSAGES {
    uuid id PK
    uuid thread_id FK
    uuid sender_id FK
    text body
  }
  SHOP_PRODUCTS {
    uuid id PK
    uuid creator_user_id FK
    text title
    numeric price
  }
  SHOP_ORDERS {
    uuid id PK
    uuid user_id FK
    numeric total_amount
    text status
  }
  SHOP_ORDER_ITEMS {
    uuid order_id FK
    uuid product_id FK
    numeric unit_price
  }
  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    text token_hash
  }
  PROFILE_POSTS {
    uuid id PK
    uuid user_id FK
    text body
  }
```

## Séquence de connexion OAuth

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client Web/Mobile
  participant A as API
  participant O as Google/GitHub
  participant D as PostgreSQL

  U->>C: Choisit un fournisseur OAuth
  C->>A: GET /auth/oauth/provider/start
  A-->>C: Redirection vers le fournisseur
  C->>O: Autorisation
  O-->>A: Callback avec code
  A->>O: Échange du code contre un token
  O-->>A: Profil et email
  A->>D: Création ou lecture du compte
  D-->>A: Utilisateur
  A-->>C: Access token + refresh token
  C-->>U: Session ouverte
```

## Séquence de recherche Spotify

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client
  participant A as API
  participant R as Redis
  participant S as Spotify

  U->>C: Recherche un titre
  C->>A: GET /search
  A->>R: Lecture de la clé de cache
  alt Résultat en cache
    R-->>A: Résultats
  else Cache absent
    A->>S: Requête Spotify
    S-->>A: Catalogue
    A->>R: Mise en cache avec TTL
  end
  A-->>C: Résultats normalisés
  C-->>U: Liste affichée
```

## Séquence bibliothèque et critique

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client
  participant A as API
  participant D as PostgreSQL

  U->>C: Ajoute une œuvre à une collection
  C->>A: POST /collections/:id/items
  A->>D: Vérifie propriétaire et insère
  D-->>A: Élément créé
  A-->>C: 201 Created

  U->>C: Publie une critique
  C->>A: POST /social/media/:type/:id/reviews
  A->>D: Insère note et texte
  D-->>A: Critique créée
  A-->>C: 201 Created
  C-->>U: Fiche communautaire actualisée
```

