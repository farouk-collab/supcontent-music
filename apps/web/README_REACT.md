# 🎵 SUPCONTENT Music - Bibliothèque React

Version React modernisée de la page Bibliothèque avec gestion complète des collections, player audio/vidéo global et recommandations intelligentes.

## 🚀 Quick Start

### Installation

```bash
# Installation des dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build pour la production
npm run build
```

La page sera accessible sur `http://localhost:5173`

## 📦 Stack Technique

- **React 18** - Framework UI
- **Vite** - Bundler et dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## 📁 Structure du Projet

```
apps/web/
├── src/
│   ├── components/
│   │   └── MusicLibraryPagePreview.jsx    # Composant principal
│   ├── App.jsx                             # App root
│   ├── main.jsx                            # Entry point React
│   └── index.css                           # Tailwind imports
├── index.html                              # HTML root
├── package.json                            # Dépendances
├── vite.config.js                          # Config Vite
├── tailwind.config.js                      # Config Tailwind
└── postcss.config.js                       # Config PostCSS
```

## ✨ Fonctionnalités

### 📚 Collections
- Créer, renommer, supprimer des collections
- Gérer les médias dans les collections (ajouter/retirer)
- Fusionner des collections
- Vue Favoris

### 🎵 Lecteur Audio/Vidéo
- Mode Audio et Vidéo
- Contrôles de lecture (Play, Pause, Suivant, Précédent)
- Shuffle et Repeat
- Barre de progression
- Contrôle du volume
- Affichage dynamique du titre, artiste et durée

### 📋 File d'Attente
- Ajouter des médias à la queue
- Réordonner les éléments (monter/descendre)
- Lecture séquentielle

### 💡 Recommandations
- Algorithme de scoring basé sur mood/energy/favoris
- Recommandations intelligentes en temps réel
- Médias similaires au titre en cours

### ⭐ Favoris
- Sauvegarde locale en localStorage
- Gestion des doublons
- Vue Favoris dédiée

### 🔐 Gestion des Utilisateurs
- Authentification simulée
- Contrôle d'accès aux actions

### 🔔 Notifications
- Centre d'activité avec notifications types
- Marquer comme lu
- Tests intégrés pour la validation

## 💾 Persistance

- **Collections dynamiques** : Simulées localement
- **Favoris** : Stockés en localStorage (clé: `supcontent-library-favorites-v5`)
- **Player state** : Sauvegardé en localStorage (`supcontent-library-player-state-v1`)
- **View mode** : Mémorisé (`supcontent-library-view-v5`)
- **Player mode** : Persistant (`supcontent-library-player-mode-v2`)

## 🎯 API Intégration

Le composant prépare l'intégration avec :
- **Backend collections** : `/collections/me` (actuellement simulé)
- **Backend sync** : Requête synchronisation prête
- **Player global** : Architecture pour un player partagé

## 🧪 Tests Intégrés

Deux suites de tests automatiques :
1. **Tests Notifications** - Validation des notifications et sanitization
2. **Tests Bibliothèque** - Validation structure collections et collections uniques

Les résultats s'affichent dans le centre de notifications.

## 🛠️ Développement

### Ajouter une nouvelle collection

```javascript
const newCollection = {
  id: `col-${Date.now()}`,
  name: "Ma collection",
  description: "Description",
  color: "from-purple-500/40 via-zinc-800 to-emerald-400/30",
  socials: { likes: 0, comments: 0, listeners: 0 },
  medias: []
};
```

### Ajouter un média

```javascript
const media = {
  id: "m-123",
  title: "Titre",
  subtitle: "Artiste · Type",
  type: "track", // track | album | playlist
  source: "Spotify", // Spotify | YouTube
  isYoutube: false,
  duplicateKey: "unique-key-for-dedup",
  mood: "night", // night | sunset | workout
  energy: "medium" // high | medium | low
};
```

## 🎨 Design

- **Thème sombre** : Gradients verts et magentas dominants
- **Responsive** : Mobile-first, adapté tablettes et desktop
- **Glassmorphism** : Effets blur et transparence
- **Accessibility** : Contraste et navigation au clavier

## 📝 Notes Importantes

- Le player audio/vidéo est simulé pour le développement
- Les données collections sont immobiles (state React) - À connecter avec un vrai backend
- localStorage remplace la persistance côté serveur (favoris)
- Tests en temps réel dans le centre notifications

## 🔄 Prochaines Étapes

1. Connecter l'API `/collections/me` au backend réel
2. Implémenter la persistance serveur pour les collections
3. Intégrer un vrai player audio (Spotify SDK, YouTube player)
4. Ajouter la synchronisation multi-appareils
5. Implémenter les actions sociales (likes, comments, share)

## 📞 Support

Pour des questions sur la structure React ou l'intégration, consulte le composant principal en [src/components/MusicLibraryPagePreview.jsx](src/components/MusicLibraryPagePreview.jsx).

---

**Version** : React 18.3.1 + Vite 5.0 + Tailwind 3.3.6
**Last updated** : April 2026
