import { useEffect, useMemo, useState } from "react";
import {
  Bell as BellIcon,
  Heart as HeartIcon,
  Disc as DiscIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Flame as FlameIcon,
  MessageSquare as MessageSquareIcon,
  Library as LibraryIcon,
  User as UserIcon,
  Plus as PlusIcon,
  Pencil as PencilIcon,
  Trash2 as TrashIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  SkipBack as PrevIcon,
  SkipForward as NextIcon,
  ExternalLink as ExternalLinkIcon,
  FolderPlus as FolderPlusIcon,
  Sparkles as SparklesIcon,
  ShieldCheck as ShieldCheckIcon,
  RefreshCw as RefreshIcon,
  Layers as DedupIcon,
  MessageCircle as MessageCircleIcon,
  Merge as MergeIcon,
  MonitorPlay as VideoIcon,
  Headphones as AudioIcon,
  Volume2 as VolumeIcon,
  Shuffle as ShuffleIcon,
  Repeat as RepeatIcon,
  Clock3 as ClockIcon,
  ListMusic as QueueIcon,
  Users as UsersIcon,
  Share2 as ShareIcon,
  GripVertical as DragIcon,
  Radio as RadioIcon,
  Zap as BoostIcon,
  Star as StarIcon,
  ShoppingBag as ShopIcon,
} from "lucide-react";

const FAVORITES_STORAGE_KEY = "supcontent-library-favorites-v5";
const VIEW_STORAGE_KEY = "supcontent-library-view-v5";
const PLAYER_MODE_STORAGE_KEY = "supcontent-library-player-mode-v2";
const PLAYER_STATE_STORAGE_KEY = "supcontent-library-player-state-v1";

const DEFAULT_NOTIFICATIONS = [
  {
    id: 1,
    type: "playlist",
    user: "Bibliothèque",
    text: "ta collection Night Drive a été synchronisée",
    time: "Il y a 4 min",
    read: false,
  },
  {
    id: 2,
    type: "comment",
    user: "Global Player",
    text: "lecture prête pour ton dernier média",
    time: "Il y a 12 min",
    read: false,
  },
  {
    id: 3,
    type: "community",
    user: "Collections",
    text: "2 doublons détectés dans Afro Sunset",
    time: "Il y a 1 h",
    read: true,
  },
];

const INITIAL_COLLECTIONS = [
  {
    id: "col-1",
    name: "Night Drive",
    description: "Synthwave, rap et pop nocturne",
    color: "from-fuchsia-500/40 via-zinc-800 to-emerald-400/30",
    socials: { likes: 182, comments: 24, listeners: 12 },
    medias: [
      {
        id: "m-1",
        title: "Timeless",
        subtitle: "The Weeknd · Single",
        type: "track",
        source: "Spotify",
        isYoutube: false,
        duplicateKey: "timeless-the-weeknd",
        mood: "night",
        energy: "medium",
      },
      {
        id: "m-2",
        title: "After Hours",
        subtitle: "The Weeknd · Album",
        type: "album",
        source: "Spotify",
        isYoutube: false,
        duplicateKey: "after-hours-the-weeknd",
        mood: "night",
        energy: "medium",
      },
      {
        id: "m-3",
        title: "Late Night Session",
        subtitle: "YouTube Mix · DJ Nova",
        type: "playlist",
        source: "YouTube",
        isYoutube: true,
        canPlayVideo: true,
        duplicateKey: "late-night-session-dj-nova",
        mood: "night",
        energy: "low",
      },
      {
        id: "m-4",
        title: "Timeless",
        subtitle: "The Weeknd · Live Cut",
        type: "track",
        source: "YouTube",
        isYoutube: true,
        canPlayVideo: true,
        duplicateKey: "timeless-the-weeknd",
        mood: "night",
        energy: "medium",
      },
    ],
  },
  {
    id: "col-2",
    name: "Afro Sunset",
    description: "Afro chill, amapiano et summer mood",
    color: "from-emerald-500/40 via-zinc-800 to-yellow-300/30",
    socials: { likes: 246, comments: 37, listeners: 20 },
    medias: [
      {
        id: "m-5",
        title: "DND",
        subtitle: "Rema · Track",
        type: "track",
        source: "Spotify",
        isYoutube: false,
        duplicateKey: "dnd-rema",
        mood: "sunset",
        energy: "medium",
      },
      {
        id: "m-6",
        title: "Love Me Jeje",
        subtitle: "Tems · Track",
        type: "track",
        source: "Spotify",
        isYoutube: false,
        duplicateKey: "love-me-jeje-tems",
        mood: "sunset",
        energy: "low",
      },
      {
        id: "m-7",
        title: "Sunset Vibes",
        subtitle: "YouTube Playlist · Afro Mood",
        type: "playlist",
        source: "YouTube",
        isYoutube: true,
        canPlayVideo: true,
        duplicateKey: "sunset-vibes-afro-mood",
        mood: "sunset",
        energy: "low",
      },
    ],
  },
  {
    id: "col-3",
    name: "Gym Charge",
    description: "Énergie rapide pour sport et focus",
    color: "from-red-500/40 via-zinc-800 to-orange-300/30",
    socials: { likes: 98, comments: 11, listeners: 8 },
    medias: [
      {
        id: "m-8",
        title: "Street Charge",
        subtitle: "Gazo · Rap FR mix",
        type: "playlist",
        source: "YouTube",
        isYoutube: true,
        canPlayVideo: true,
        duplicateKey: "street-charge-gazo",
        mood: "workout",
        energy: "high",
      },
      {
        id: "m-9",
        title: "FE!N",
        subtitle: "Travis Scott · Track",
        type: "track",
        source: "Spotify",
        isYoutube: false,
        duplicateKey: "fein-travis-scott",
        mood: "workout",
        energy: "high",
      },
    ],
  },
];

const MEDIA_CATALOG = [
  {
    id: "cat-1",
    title: "Blinding Lights",
    subtitle: "The Weeknd · Track",
    type: "track",
    source: "Spotify",
    isYoutube: false,
    duplicateKey: "blinding-lights-the-weeknd",
    mood: "night",
    energy: "high",
  },
  {
    id: "cat-2",
    title: "Calm Down",
    subtitle: "Rema · Track",
    type: "track",
    source: "Spotify",
    isYoutube: false,
    duplicateKey: "calm-down-rema",
    mood: "sunset",
    energy: "low",
  },
  {
    id: "cat-3",
    title: "Sunset Ride",
    subtitle: "YouTube Mix · Nova",
    type: "playlist",
    source: "YouTube",
    isYoutube: true,
    canPlayVideo: true,
    duplicateKey: "sunset-ride-nova",
    mood: "sunset",
    energy: "medium",
  },
  {
    id: "cat-4",
    title: "Nightcall Echo",
    subtitle: "Kavinsky style · Track",
    type: "track",
    source: "Spotify",
    isYoutube: false,
    duplicateKey: "nightcall-echo",
    mood: "night",
    energy: "medium",
  },
  {
    id: "cat-5",
    title: "Workout Rush",
    subtitle: "YouTube Mix · Energy Lab",
    type: "playlist",
    source: "YouTube",
    isYoutube: true,
    canPlayVideo: true,
    duplicateKey: "workout-rush",
    mood: "workout",
    energy: "high",
  },
];

function sanitizeNotification(item, fallbackIndex = 0) {
  if (!item || typeof item !== "object") {
    return {
      id: `fallback-${fallbackIndex}`,
      type: "system",
      user: "Système",
      text: "Notification indisponible",
      time: "Maintenant",
      read: true,
    };
  }

  return {
    id: item.id ?? `generated-${fallbackIndex}`,
    type: item.type ?? "system",
    user: item.user ?? "Système",
    text: item.text ?? "Nouvelle activité",
    time: item.time ?? "Maintenant",
    read: Boolean(item.read),
  };
}

function sanitizeNotifications(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => sanitizeNotification(item, index));
}

function runNotificationTests() {
  const cases = [
    {
      name: "notification valide conservée",
      input: [{ id: 1, user: "A", text: "ok", time: "now", read: false }],
      check: (result) => result.length === 1 && result[0].read === false,
    },
    {
      name: "undefined géré",
      input: [undefined],
      check: (result) => result.length === 1 && result[0].user === "Système",
    },
    {
      name: "liste invalide gérée",
      input: null,
      check: (result) => Array.isArray(result) && result.length === 0,
    },
  ];

  return cases.map((test) => ({ name: test.name, passed: test.check(sanitizeNotifications(test.input)) }));
}

function runLibraryTests() {
  const cases = [
    {
      name: "ids collections uniques",
      check: () => new Set(INITIAL_COLLECTIONS.map((c) => c.id)).size === INITIAL_COLLECTIONS.length,
    },
    {
      name: "chaque collection a une liste medias",
      check: () => INITIAL_COLLECTIONS.every((c) => Array.isArray(c.medias)),
    },
    {
      name: "au moins un média YouTube existe",
      check: () => INITIAL_COLLECTIONS.some((c) => c.medias.some((m) => m.isYoutube)),
    },
    {
      name: "un doublon existe pour tester le nettoyage",
      check: () => INITIAL_COLLECTIONS[0].medias.filter((m) => m.duplicateKey === "timeless-the-weeknd").length === 2,
    },
    {
      name: "catalogue média non vide",
      check: () => MEDIA_CATALOG.length > 0,
    },
    {
      name: "des moods existent pour les recommandations",
      check: () => MEDIA_CATALOG.some((m) => Boolean(m.mood)),
    },
  ];

  return cases.map((test) => ({ name: test.name, passed: test.check() }));
}

function loadFavorites() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadView() {
  if (typeof window === "undefined") return "collections";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "collections";
  } catch {
    return "collections";
  }
}

function loadPlayerMode() {
  if (typeof window === "undefined") return "audio";
  try {
    const raw = window.localStorage.getItem(PLAYER_MODE_STORAGE_KEY);
    return raw === "video" ? "video" : "audio";
  } catch {
    return "audio";
  }
}

function loadPlayerState() {
  if (typeof window === "undefined") {
    return {
      id: "m-3",
      title: "Late Night Session",
      subtitle: "YouTube Mix · DJ Nova",
      source: "YouTube",
      isYoutube: true,
      canPlayVideo: true,
      progress: 38,
      collection: "Night Drive",
      duration: "42:18",
      artist: "DJ Nova",
      isPlaying: true,
      volume: 72,
      shuffle: false,
      repeat: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_STATE_STORAGE_KEY);
    if (!raw) throw new Error("missing");
    return JSON.parse(raw);
  } catch {
    return {
      id: "m-3",
      title: "Late Night Session",
      subtitle: "YouTube Mix · DJ Nova",
      source: "YouTube",
      isYoutube: true,
      canPlayVideo: true,
      progress: 38,
      collection: "Night Drive",
      duration: "42:18",
      artist: "DJ Nova",
      isPlaying: true,
      volume: 72,
      shuffle: false,
      repeat: false,
    };
  }
}

function requireLogin(isAuthenticated, setFeedback) {
  if (isAuthenticated) return true;
  setFeedback("Connexion requise via requireLogin() pour gérer les collections");
  return false;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MediaBadge({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}

export default function MusicLibraryPagePreview({ onNavigate = () => {} }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => sanitizeNotifications(DEFAULT_NOTIFICATIONS));
  const [viewMode, setViewMode] = useState(() => loadView());
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [collections, setCollections] = useState(INITIAL_COLLECTIONS);
  const [selectedCollectionId, setSelectedCollectionId] = useState(INITIAL_COLLECTIONS[0].id);
  const [feedback, setFeedback] = useState("Bibliothèque premium prête · /collections/me simulé");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [playerMode, setPlayerMode] = useState(() => loadPlayerMode());
  const [nowPlaying, setNowPlaying] = useState(() => loadPlayerState());
  const [recentlyPlayed, setRecentlyPlayed] = useState([loadPlayerState()]);
  const [queue, setQueue] = useState([
    {
      id: "q-1",
      title: "After Hours",
      subtitle: "The Weeknd · Album",
      source: "Spotify",
      isYoutube: false,
      canPlayVideo: false,
      duration: "4:01",
      artist: "The Weeknd",
    },
    {
      id: "q-2",
      title: "DND",
      subtitle: "Rema · Track",
      source: "Spotify",
      isYoutube: false,
      canPlayVideo: false,
      duration: "2:58",
      artist: "Rema",
    },
    {
      id: "q-3",
      title: "Sunset Vibes",
      subtitle: "YouTube Playlist · Afro Mood",
      source: "YouTube",
      isYoutube: true,
      canPlayVideo: true,
      duration: "18:45",
      artist: "Afro Mood",
    },
  ]);

  const safeNotifications = useMemo(() => sanitizeNotifications(notifications), [notifications]);
  const unreadCount = useMemo(() => safeNotifications.filter((item) => !item.read).length, [safeNotifications]);
  const notificationTests = useMemo(() => runNotificationTests(), []);
  const libraryTests = useMemo(() => runLibraryTests(), []);
  const allNotificationTestsPassed = notificationTests.every((test) => test.passed);
  const allLibraryTestsPassed = libraryTests.every((test) => test.passed);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0],
    [collections, selectedCollectionId]
  );

  const allMedias = useMemo(() => collections.flatMap((collection) => collection.medias), [collections]);

  const favoriteMedias = useMemo(
    () => allMedias.filter((media) => favorites.includes(media.id)),
    [allMedias, favorites]
  );

  const duplicateItems = useMemo(() => {
    const medias = selectedCollection?.medias ?? [];
    const counts = medias.reduce((acc, media) => {
      acc[media.duplicateKey] = (acc[media.duplicateKey] || 0) + 1;
      return acc;
    }, {});
    return medias.filter((media) => counts[media.duplicateKey] > 1);
  }, [selectedCollection]);

  const similarSongs = useMemo(() => {
    const currentMood = allMedias.find((m) => m.id === nowPlaying.id)?.mood;
    return [...allMedias, ...MEDIA_CATALOG]
      .filter((media) => media.id !== nowPlaying.id)
      .filter((media, index, arr) => arr.findIndex((m) => m.duplicateKey === media.duplicateKey) === index)
      .filter((media) => (currentMood ? media.mood === currentMood : true))
      .slice(0, 4);
  }, [allMedias, nowPlaying.id]);

  const recommendations = useMemo(() => {
    const moods = recentlyPlayed.map((item) => item.mood).filter(Boolean);
    const dominantMood = moods[0] ?? allMedias.find((m) => m.id === nowPlaying.id)?.mood;
    return [...MEDIA_CATALOG, ...allMedias]
      .filter((media) => media.id !== nowPlaying.id)
      .filter((media, index, arr) => arr.findIndex((m) => m.duplicateKey === media.duplicateKey) === index)
      .map((media) => ({
        ...media,
        score:
          (media.mood === dominantMood ? 40 : 0) +
          (media.energy === "high" ? 12 : media.energy === "medium" ? 8 : 5) +
          (favorites.includes(media.id) ? 15 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [allMedias, favorites, nowPlaying.id, recentlyPlayed]);

  const autoCollections = useMemo(() => {
    const mostPlayed = [...recentlyPlayed]
      .reduce((acc, item) => {
        const key = item.title;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    return {
      recent: recentlyPlayed.slice(0, 4),
      top: Object.entries(mostPlayed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
      discovered: recommendations.slice(0, 3),
    };
  }, [recentlyPlayed, recommendations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLAYER_MODE_STORAGE_KEY, playerMode);
  }, [playerMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLAYER_STATE_STORAGE_KEY, JSON.stringify(nowPlaying));
  }, [nowPlaying]);

  const markAllAsRead = () => {
    setNotifications((prev) => sanitizeNotifications(prev).map((item) => ({ ...item, read: true })));
  };

  const markOneAsRead = (id) => {
    setNotifications((prev) => sanitizeNotifications(prev).map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "playlist":
        return <DiscIcon size={18} />;
      case "comment":
        return <MessageCircleIcon size={18} />;
      case "community":
        return <SparklesIcon size={18} />;
      default:
        return <BellIcon size={18} />;
    }
  };

  const createCollection = () => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    const id = `col-${Date.now()}`;
    const newCollection = {
      id,
      name: "Nouvelle collection",
      description: "À organiser",
      color: "from-sky-500/40 via-zinc-800 to-violet-400/30",
      socials: { likes: 0, comments: 0, listeners: 0 },
      medias: [],
    };
    setCollections((prev) => [newCollection, ...prev]);
    setSelectedCollectionId(id);
    setFeedback("Collection créée via /collections/me");
  };

  const renameCollection = (collectionId) => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId ? { ...collection, name: `${collection.name} · éditée` } : collection
      )
    );
    setFeedback("Collection renommée côté backend");
  };

  const deleteCollection = (collectionId) => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    const nextCollections = collections.filter((collection) => collection.id !== collectionId);
    if (nextCollections.length === 0) {
      setFeedback("Impossible de supprimer la dernière collection de la démo");
      return;
    }
    setCollections(nextCollections);
    if (selectedCollectionId === collectionId) setSelectedCollectionId(nextCollections[0].id);
    setFeedback("Collection supprimée côté backend");
  };

  const addMediaToCollection = (collectionId) => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    const existingIds = new Set(allMedias.map((m) => m.id));
    const candidate = MEDIA_CATALOG.find((media) => !existingIds.has(media.id)) ?? {
      id: `media-${Date.now()}`,
      title: "Nouveau média",
      subtitle: "Source simulée",
      type: "track",
      source: "Spotify",
      isYoutube: false,
      duplicateKey: `generated-${Date.now()}`,
      mood: "night",
      energy: "medium",
    };

    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId ? { ...collection, medias: [...collection.medias, candidate] } : collection
      )
    );
    setFeedback("Média ajouté à la collection via le backend");
  };

  const removeMediaFromCollection = (collectionId, mediaId) => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? { ...collection, medias: collection.medias.filter((media) => media.id !== mediaId) }
          : collection
      )
    );
    setFeedback("Média retiré de la collection");
  };

  const toggleFavorite = (mediaId) => {
    setFavorites((prev) => (prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]));
    setFeedback("Favoris mis à jour dans localStorage");
  };

  const pushRecentlyPlayed = (entry) => {
    setRecentlyPlayed((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 8));
  };

  const playMedia = (media, forcedMode) => {
    const desiredMode = forcedMode ?? (media.canPlayVideo ? playerMode : "audio");
    const nextMode = desiredMode === "video" && media.canPlayVideo ? "video" : "audio";
    const nextPlayer = {
      id: media.id,
      title: media.title,
      subtitle: media.subtitle,
      source: media.source,
      isYoutube: media.isYoutube,
      canPlayVideo: Boolean(media.canPlayVideo),
      progress: Math.floor(Math.random() * 55) + 20,
      collection: selectedCollection?.name ?? "Bibliothèque",
      duration: media.isYoutube ? "12:44" : media.type === "album" ? "42:18" : "3:24",
      artist: media.subtitle.split("·")[0]?.trim() || "Artiste inconnu",
      isPlaying: true,
      volume: nowPlaying.volume ?? 72,
      shuffle: nowPlaying.shuffle ?? false,
      repeat: nowPlaying.repeat ?? false,
      mood: media.mood,
      energy: media.energy,
    };

    setNowPlaying(nextPlayer);
    pushRecentlyPlayed(nextPlayer);
    setPlayerMode(nextMode);
    setFeedback(
      nextMode === "video"
        ? "Lecture vidéo lancée depuis la bibliothèque"
        : media.isYoutube
          ? "Lecture audio lancée via player global YouTube si disponible"
          : "Lecture audio lancée depuis la bibliothèque"
    );
  };

  const openMedia = (media) => {
    setFeedback(`Ouverture de la page détail pour ${media.title}`);
  };

  const deduplicateSelectedCollection = () => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    setCollections((prev) =>
      prev.map((collection) => {
        if (collection.id !== selectedCollectionId) return collection;
        const seen = new Set();
        return {
          ...collection,
          medias: collection.medias.filter((media) => {
            if (seen.has(media.duplicateKey)) return false;
            seen.add(media.duplicateKey);
            return true;
          }),
        };
      })
    );
    setFeedback("Liste dédoublonnée");
  };

  const mergeCollections = () => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    if (collections.length < 2) {
      setFeedback("Pas assez de collections à fusionner");
      return;
    }

    const first = collections[0];
    const second = collections[1];
    const merged = {
      id: `merged-${Date.now()}`,
      name: `${first.name} + ${second.name}`,
      description: "Collection fusionnée",
      color: "from-violet-500/40 via-zinc-800 to-emerald-400/30",
      socials: {
        likes: first.socials.likes + second.socials.likes,
        comments: first.socials.comments + second.socials.comments,
        listeners: Math.max(first.socials.listeners, second.socials.listeners),
      },
      medias: [...first.medias, ...second.medias],
    };
    setCollections((prev) => [merged, ...prev]);
    setSelectedCollectionId(merged.id);
    setFeedback("Collections fusionnées via les outils bibliothèque");
  };

  const syncCollections = () => {
    if (!requireLogin(isAuthenticated, setFeedback)) return;
    setFeedback("Synchronisation des collections demandée");
  };

  const addToQueue = (media) => {
    const item = {
      id: `q-${media.id}-${Date.now()}`,
      title: media.title,
      subtitle: media.subtitle,
      source: media.source,
      isYoutube: media.isYoutube,
      canPlayVideo: Boolean(media.canPlayVideo),
      duration: media.isYoutube ? "12:44" : media.type === "album" ? "42:18" : "3:24",
      artist: media.subtitle.split("·")[0]?.trim() || "Artiste inconnu",
      mood: media.mood,
      energy: media.energy,
    };
    setQueue((prev) => [...prev, item]);
    setFeedback(`${media.title} ajouté à la file d'attente`);
  };

  const playNextFromQueue = () => {
    if (queue.length === 0) {
      setFeedback("La file d'attente est vide");
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    playMedia(next, next.canPlayVideo ? playerMode : "audio");
  };

  const moveQueueItem = (index, direction) => {
    setQueue((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const footerItems = [
    { label: "Accueil", icon: <HomeIcon size={20} />, active: false },
    { label: "Recherche", icon: <SearchIcon size={20} />, active: false },
    { label: "Swipe", icon: <FlameIcon size={20} />, active: false },
    { label: "Chat", icon: <MessageSquareIcon size={20} />, active: false },
    { label: "Boutique", icon: <ShopIcon size={20} />, active: false },
    { label: "Biblio", icon: <LibraryIcon size={20} />, active: true },
    { label: "Profil", icon: <UserIcon size={20} />, active: false },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_20%),radial-gradient(circle_at_right,_rgba(168,85,247,0.14),_transparent_20%),linear-gradient(180deg,_#050505,_#0d0d0d)] pb-40 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <header className="relative z-40 mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Bibliothèque</p>
            <h1 className="mt-1 text-3xl font-semibold">Collections, player global et recommandations</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Gestion connectée sur /collections/me, favoris locaux, queue, suggestions intelligentes et blocs sociaux.
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsAuthenticated((prev) => !prev)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${isAuthenticated ? "bg-emerald-400 text-black" : "bg-white/10 text-white"}`}
            >
              {isAuthenticated ? "Connecté" : "Déconnecté"}
            </button>
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className={`relative rounded-full px-4 py-2 text-sm font-semibold ${notificationsOpen ? "bg-yellow-400 text-black" : "bg-emerald-400 text-black"}`}
            >
              {notificationsOpen ? "⭐ Notifications" : "Notifications"}
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-fuchsia-500 px-1 text-xs font-bold text-white shadow-lg">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] z-[120] w-[360px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl max-md:left-0 max-md:right-auto">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Notifications</p>
                    <h3 className="mt-1 text-base font-semibold">Centre d'activité</h3>
                  </div>
                  <button onClick={markAllAsRead} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                    Tout marquer comme lu
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-3">
                  <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${allNotificationTestsPassed ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>
                    {allNotificationTestsPassed ? "Tests notifications passés" : "Un test notifications a échoué"}
                  </div>
                  <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${allLibraryTestsPassed ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>
                    {allLibraryTestsPassed ? "Tests bibliothèque passés" : "Un test bibliothèque a échoué"}
                  </div>
                  <div className="space-y-2">
                    {safeNotifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => markOneAsRead(item.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${item.read ? "border-white/5 bg-white/[0.03]" : "border-fuchsia-400/20 bg-fuchsia-500/10"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg">
                            {getNotificationIcon(item.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-white"><span className="font-semibold">{item.user}</span> {item.text}</p>
                              {!item.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />}
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">{item.time}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Mes collections</h2>
              <button onClick={createCollection} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">
                <PlusIcon size={16} className="mr-1 inline-block" /> Créer
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {[
                { key: "collections", label: "Collections" },
                { key: "favorites", label: "Favoris" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setViewMode(item.key)}
                  className={`rounded-full px-4 py-2 text-sm transition ${viewMode === item.key ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/5 text-zinc-300"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => setSelectedCollectionId(collection.id)}
                  className={`w-full rounded-[1.5rem] border p-4 text-left transition ${selectedCollectionId === collection.id ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{collection.name}</p>
                      <p className="mt-1 text-sm text-zinc-400">{collection.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {collection.medias.length} médias
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{collection.socials.likes} likes</span>
                    <span>•</span>
                    <span>{collection.socials.comments} commentaires</span>
                    <span>•</span>
                    <span>{collection.socials.listeners} écoutent</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Collections automatiques</p>
              <div className="mt-3 space-y-3 text-sm text-zinc-300">
                <div>
                  <p className="font-medium">Récemment joués</p>
                  <p className="text-zinc-500">{autoCollections.recent.length} éléments</p>
                </div>
                <div>
                  <p className="font-medium">Les plus écoutés</p>
                  <p className="text-zinc-500">{autoCollections.top.map(([title]) => title).join(" · ") || "Aucun"}</p>
                </div>
                <div>
                  <p className="font-medium">Découverts récemment</p>
                  <p className="text-zinc-500">{autoCollections.discovered.map((m) => m.title).join(" · ") || "Aucun"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-2xl">
            {viewMode === "collections" ? (
              <>
                <div className={`mb-5 rounded-[1.75rem] bg-gradient-to-br ${selectedCollection.color} p-5`}>
                  <p className="text-sm uppercase tracking-[0.22em] text-white/80">Collection ouverte</p>
                  <h2 className="mt-2 text-3xl font-semibold">{selectedCollection.name}</h2>
                  <p className="mt-2 text-sm text-zinc-200">{selectedCollection.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <MediaBadge>{selectedCollection.socials.likes} likes</MediaBadge>
                    <MediaBadge>{selectedCollection.socials.comments} commentaires</MediaBadge>
                    <MediaBadge>{selectedCollection.socials.listeners} écoutent</MediaBadge>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => addMediaToCollection(selectedCollection.id)} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">
                      <FolderPlusIcon size={16} className="mr-1 inline-block" /> Ajouter média
                    </button>
                    <button onClick={() => renameCollection(selectedCollection.id)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                      <PencilIcon size={16} className="mr-1 inline-block" /> Renommer
                    </button>
                    <button onClick={() => deleteCollection(selectedCollection.id)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                      <TrashIcon size={16} className="mr-1 inline-block" /> Supprimer
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap gap-2">
                  <button onClick={mergeCollections} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    <MergeIcon size={16} className="mr-1 inline-block" /> Fusionner
                  </button>
                  <button onClick={deduplicateSelectedCollection} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    <DedupIcon size={16} className="mr-1 inline-block" /> Dédoublonner
                  </button>
                  <button onClick={syncCollections} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    <RefreshIcon size={16} className="mr-1 inline-block" /> Synchroniser
                  </button>
                  <button className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    <ShareIcon size={16} className="mr-1 inline-block" /> Partager
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedCollection.medias.map((media) => (
                    <article key={media.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{media.title}</p>
                          <p className="mt-1 text-sm text-zinc-400">{media.subtitle}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <MediaBadge>{media.type}</MediaBadge>
                            <MediaBadge>{media.source}</MediaBadge>
                            <MediaBadge>{media.mood}</MediaBadge>
                            {favorites.includes(media.id) && <MediaBadge>favori</MediaBadge>}
                          </div>
                        </div>
                        <button onClick={() => toggleFavorite(media.id)} className="rounded-full border border-white/10 bg-white/10 p-2">
                          <HeartIcon size={16} className={favorites.includes(media.id) ? "fill-current text-emerald-300" : ""} />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => playMedia(media, "audio")} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">
                          <AudioIcon size={16} className="mr-1 inline-block" /> Audio
                        </button>
                        <button onClick={() => playMedia(media, media.canPlayVideo ? "video" : "audio")} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                          <VideoIcon size={16} className="mr-1 inline-block" /> Vidéo
                        </button>
                        <button onClick={() => addToQueue(media)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                          <QueueIcon size={16} className="mr-1 inline-block" /> Jouer après
                        </button>
                        <button onClick={() => openMedia(media)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                          <ExternalLinkIcon size={16} className="mr-1 inline-block" /> Ouvrir
                        </button>
                        <button onClick={() => removeMediaFromCollection(selectedCollection.id, media.id)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                          <TrashIcon size={16} className="mr-1 inline-block" /> Retirer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Mes favoris</h2>
                    <p className="text-sm text-zinc-400">Stockés en localStorage pour un accès rapide</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                    {favoriteMedias.length} éléments
                  </span>
                </div>

                <div className="space-y-3">
                  {favoriteMedias.length > 0 ? (
                    favoriteMedias.map((media) => (
                      <article key={media.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                        <p className="font-medium">{media.title}</p>
                        <p className="mt-1 text-sm text-zinc-400">{media.subtitle}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button onClick={() => playMedia(media, "audio")} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">
                            Audio
                          </button>
                          <button onClick={() => addToQueue(media)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                            Jouer après
                          </button>
                          <button onClick={() => openMedia(media)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                            Ouvrir
                          </button>
                          <button onClick={() => toggleFavorite(media.id)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                            Retirer des favoris
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-8 text-center">
                      <p className="text-lg font-semibold">Aucun favori pour le moment</p>
                      <p className="mt-2 text-sm text-zinc-400">Ajoute des médias à tes favoris pour les retrouver ici.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h2 className="text-xl font-semibold">Résumé bibliothèque</h2>
            <div className="mt-4 grid gap-3">
              <StatCard label="Collections" value={collections.length} />
              <StatCard label="Favoris" value={favorites.length} />
              <StatCard label="Doublons détectés" value={duplicateItems.length} />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Now playing</p>
                <div className="flex gap-2">
                  <button onClick={() => setPlayerMode("audio")} className={`rounded-full px-3 py-1.5 text-xs ${playerMode === "audio" ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
                    <AudioIcon size={14} className="mr-1 inline-block" /> Audio
                  </button>
                  <button onClick={() => setPlayerMode("video")} className={`rounded-full px-3 py-1.5 text-xs ${playerMode === "video" ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
                    <VideoIcon size={14} className="mr-1 inline-block" /> Vidéo
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-black/30 to-fuchsia-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      {playerMode === "video" && nowPlaying.canPlayVideo ? <VideoIcon size={24} className="text-emerald-300" /> : <DiscIcon size={24} className="text-emerald-300" />}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{nowPlaying.title}</p>
                      <p className="mt-1 text-sm text-zinc-300">{nowPlaying.artist}</p>
                      <p className="mt-1 text-xs text-zinc-500">Depuis {nowPlaying.collection}</p>
                    </div>
                  </div>
                  <MediaBadge>{nowPlaying.duration}</MediaBadge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <MediaBadge>{nowPlaying.source}</MediaBadge>
                  <MediaBadge>{playerMode === "video" && nowPlaying.canPlayVideo ? "vidéo" : "audio"}</MediaBadge>
                  <MediaBadge>{nowPlaying.canPlayVideo ? "clip dispo" : "audio seul"}</MediaBadge>
                </div>

                {playerMode === "video" && nowPlaying.canPlayVideo ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-zinc-800">
                      <div className="text-center">
                        <VideoIcon size={30} className="mx-auto text-emerald-300" />
                        <p className="mt-2 text-sm text-zinc-200">Lecteur vidéo simulé</p>
                        <p className="text-xs text-zinc-500">Clip / live session / vidéo YouTube</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-200">Lecture audio en cours</p>
                        <p className="text-xs text-zinc-500">Player global / audio bibliothèque</p>
                      </div>
                      <button
                        onClick={() => setNowPlaying((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
                        className="rounded-full bg-emerald-400 px-3 py-2 text-sm font-semibold text-black"
                      >
                        {nowPlaying.isPlaying ? <PauseIcon size={14} className="mr-1 inline-block" /> : <PlayIcon size={14} className="mr-1 inline-block" />}
                        {nowPlaying.isPlaying ? "Pause" : "Play"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>00:{String(Math.floor((nowPlaying.progress / 100) * 59)).padStart(2, "0")}</span>
                    <span>{nowPlaying.duration}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${nowPlaying.progress}%` }} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => setNowPlaying((prev) => ({ ...prev, progress: Math.max(0, prev.progress - 12) }))} className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-zinc-200">
                    <PrevIcon size={14} className="mr-1 inline-block" /> Précédent
                  </button>
                  <button onClick={playNextFromQueue} className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold text-black">
                    <NextIcon size={14} className="mr-1 inline-block" /> Suivant
                  </button>
                  <button onClick={() => setNowPlaying((prev) => ({ ...prev, progress: Math.min(100, prev.progress + 14) }))} className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-zinc-200">
                    Avancer
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => setNowPlaying((prev) => ({ ...prev, shuffle: !prev.shuffle }))} className={`rounded-full px-3 py-2 text-xs ${nowPlaying.shuffle ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/10 text-zinc-200"}`}>
                    <ShuffleIcon size={14} className="mr-1 inline-block" /> Shuffle
                  </button>
                  <button onClick={() => setNowPlaying((prev) => ({ ...prev, repeat: !prev.repeat }))} className={`rounded-full px-3 py-2 text-xs ${nowPlaying.repeat ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/10 text-zinc-200"}`}>
                    <RepeatIcon size={14} className="mr-1 inline-block" /> Repeat
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                    <VolumeIcon size={14} /> Volume
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={nowPlaying.volume}
                    onChange={(e) => setNowPlaying((prev) => ({ ...prev, volume: Number(e.target.value) }))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <QueueIcon size={16} className="text-emerald-300" />
                <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">File d'attente</p>
              </div>
              <div className="mt-3 space-y-2">
                {queue.length > 0 ? (
                  queue.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-2">
                          <DragIcon size={14} className="mt-1 text-zinc-500" />
                          <div>
                            <p className="font-medium text-white">{item.title}</p>
                            <p className="mt-1 text-xs text-zinc-400">{item.artist}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => moveQueueItem(index, "up")} className="rounded-full border border-white/10 px-2 py-1 text-xs">↑</button>
                          <button onClick={() => moveQueueItem(index, "down")} className="rounded-full border border-white/10 px-2 py-1 text-xs">↓</button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-400">Aucun morceau dans la queue.</p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <BoostIcon size={16} className="text-emerald-300" />
                <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Recommandé pour toi</p>
              </div>
              <div className="mt-3 space-y-2">
                {recommendations.map((media) => (
                  <button key={media.id} onClick={() => playMedia(media, media.canPlayVideo ? playerMode : "audio")} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10">
                    <div>
                      <p className="font-medium text-white">{media.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">Score {media.score} · {media.mood}</p>
                    </div>
                    <PlayIcon size={14} className="text-emerald-300" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <UsersIcon size={16} className="text-emerald-300" />
                <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Social</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">❤️ Liker la collection</button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">💬 Commenter</button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">📤 Partager</button>
              </div>
              <p className="mt-3 text-sm text-zinc-400">Tes amis écoutent surtout Night Drive et Afro Sunset cette semaine.</p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">Connexion et droits</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-zinc-200">
                <ShieldCheckIcon size={16} className="text-emerald-300" />
                <span>{isAuthenticated ? "Actions de gestion autorisées" : "Actions de gestion bloquées"}</span>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-sm uppercase tracking-[0.22em] text-zinc-400">État visuel / technique</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                <SparklesIcon size={14} />
                backend principal : /collections/me · favoris : localStorage · player global persistant simulé
              </div>
              <p className="mt-3 text-sm text-zinc-300">{feedback}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ClockIcon size={16} className="text-emerald-300" />
              <h2 className="text-xl font-semibold">Recently played</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recentlyPlayed.map((item) => (
                <button key={`${item.id}-${item.progress}`} onClick={() => playMedia(item, item.canPlayVideo ? playerMode : "audio")} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-left hover:bg-black/30">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.artist}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MediaBadge>{item.source}</MediaBadge>
                    <MediaBadge>{item.collection}</MediaBadge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <RadioIcon size={16} className="text-emerald-300" />
              <h2 className="text-xl font-semibold">Similaire au titre en cours</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {similarSongs.map((media) => (
                <button key={media.id} onClick={() => playMedia(media, media.canPlayVideo ? playerMode : "audio")} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-left hover:bg-black/30">
                  <p className="font-medium text-white">{media.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{media.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MediaBadge>{media.mood}</MediaBadge>
                    <MediaBadge>{media.energy}</MediaBadge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-14 left-1/2 z-40 w-[min(980px,calc(100%-24px))] -translate-x-1/2 rounded-[1.75rem] border border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              {playerMode === "video" && nowPlaying.canPlayVideo ? <VideoIcon size={20} className="text-emerald-300" /> : <DiscIcon size={20} className="text-emerald-300" />}
            </div>
            <div>
              <p className="font-medium text-white">{nowPlaying.title}</p>
              <p className="text-xs text-zinc-400">{nowPlaying.artist} · {playerMode === "video" && nowPlaying.canPlayVideo ? "vidéo" : "audio"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNowPlaying((prev) => ({ ...prev, shuffle: !prev.shuffle }))} className={`rounded-full p-2 ${nowPlaying.shuffle ? "bg-emerald-400 text-black" : "bg-white/10 text-zinc-200"}`}>
              <ShuffleIcon size={16} />
            </button>
            <button onClick={() => setNowPlaying((prev) => ({ ...prev, progress: Math.max(0, prev.progress - 10) }))} className="rounded-full bg-white/10 p-2 text-zinc-200">
              <PrevIcon size={16} />
            </button>
            <button onClick={() => setNowPlaying((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))} className="rounded-full bg-emerald-400 p-2 text-black">
              {nowPlaying.isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <button onClick={playNextFromQueue} className="rounded-full bg-white/10 p-2 text-zinc-200">
              <NextIcon size={16} />
            </button>
            <button onClick={() => setNowPlaying((prev) => ({ ...prev, repeat: !prev.repeat }))} className={`rounded-full p-2 ${nowPlaying.repeat ? "bg-emerald-400 text-black" : "bg-white/10 text-zinc-200"}`}>
              <RepeatIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2 text-xs">
          {footerItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.label === "Biblio") onNavigate("library");
                if (item.label === "Boutique") onNavigate("shop");
                if (item.label === "Profil") onNavigate("profil");
              }}
              className={`flex flex-col items-center justify-center gap-1 transition ${item.active ? "text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
