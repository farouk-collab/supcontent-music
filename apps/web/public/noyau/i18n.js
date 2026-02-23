const LANG_KEY = "supcontent_language";

const DICT = {
  fr: {
    home: "Accueil",
    search: "Recherche",
    swipe: "Swipe",
    chat: "Chat",
    library: "Biblio",
    profile: "Profil",
    settings_activity: "Parametres et activite",
    back: "Retour",
    who_can_see: "Qui peut voir ton contenu",
    account_privacy: "Confidentialite du compte",
    hide_location: "Masquer ma localisation",
    interact_with_you: "Moyens d'interagir avec toi",
    messages: "Messages",
    comments: "Commentaires",
    new_followers: "Nouveaux followers",
    interactions: "Interactions",
    hidden_words: "Mots masques (separes par des virgules)",
    swipe_profiles: "Swipe profils",
    filter_distance: "Filtrer par distance",
    live_location: "Localisation live",
    max_distance: "Distance max (km)",
    genders_to_show: "Sexes a afficher",
    use_my_position: "Utiliser ma position",
    clear_position: "Effacer position",
    app_preferences: "Preference d'application",
    language: "Langue",
    blocked: "Bloque",
    block_account_uuid: "Bloquer un compte (UUID)",
    save_all: "Enregistrer tout",
    french: "Francais",
    english: "English",
    swipe_title: "Swipes",
    profiles: "Profils",
    musics: "Musiques",
    swipe_intro: "Like profil = follow automatique. Chat direct seulement si follow mutuel.",
    invite_placeholder: "Message d'invitation (optionnel, 180 max)",
    filters_profiles: "Filtres profils",
    close_filters: "Fermer les filtres",
    distance: "distance",
    my_position: "Ma position",
    clear: "Effacer",
    position_undefined: "Position: non definie",
    apply: "Appliquer",
    age_min: "age min",
    age_max: "age max",
    minors_protection_adult: "Protection mineurs active: en etant majeur, plage autorisee 18-99.",
    minors_protection_minor: "Protection mineurs active: plage autorisee 13-17.",
    chats: "Chats",
    chat_wip: "Espace chat en cours de construction.",
    open_swipes: "Ouvrir Swipes",
    invitations: "Invitations",
    loading_invitations: "Chargement invitations...",
    view_profile: "Voir profil",
    find_music: "Trouver de la musique",
    my_profile: "Mon profil",
    refresh: "Rafraichir",
    logout_local: "Deconnexion (local)",
    delete_account: "Supprimer mon compte",
    logout_note: "Note: la deconnexion supprime seulement les tokens du navigateur.",
    delete_warning: "Attention: suppression definitive du compte.",
    diagnostics: "Diagnostic",
    new_story_post: "Nouvelle story / publication",
    close: "Fermer",
    type: "Type",
    media: "Media",
    text: "Texte",
    publish: "Publier",
    location: "Lieu",
    tags_csv: "Tags (separes par virgule)",
    visibility: "Visibilite",
    likes_enabled: "Likes actifs",
    comments_enabled: "Commentaires actifs",
    no_message: "(sans message)",
    chat_direct_allowed: "Chat direct autorise (follow mutuel).",
    invite_pending_chat_blocked: "Invitation recue. Chat direct bloque tant que le follow n'est pas mutuel.",
    login_to_see_invites: "Connecte-toi pour voir les invitations.",
    no_invites: "Aucune invitation pour le moment.",
    invite_error: "Erreur invitations",
  },
  en: {
    home: "Home",
    search: "Search",
    swipe: "Swipe",
    chat: "Chat",
    library: "Library",
    profile: "Profile",
    settings_activity: "Settings and activity",
    back: "Back",
    who_can_see: "Who can see your content",
    account_privacy: "Account privacy",
    hide_location: "Hide my location",
    interact_with_you: "Ways people can interact with you",
    messages: "Messages",
    comments: "Comments",
    new_followers: "New followers",
    interactions: "Interactions",
    hidden_words: "Hidden words (comma-separated)",
    swipe_profiles: "Swipe profiles",
    filter_distance: "Filter by distance",
    live_location: "Live location",
    max_distance: "Max distance (km)",
    genders_to_show: "Genders to show",
    use_my_position: "Use my location",
    clear_position: "Clear location",
    app_preferences: "App preferences",
    language: "Language",
    blocked: "Blocked",
    block_account_uuid: "Block an account (UUID)",
    save_all: "Save all",
    french: "French",
    english: "English",
    swipe_title: "Swipes",
    profiles: "Profiles",
    musics: "Music",
    swipe_intro: "Liking a profile sends a follow. Direct chat is allowed only after mutual follow.",
    invite_placeholder: "Invitation message (optional, 180 max)",
    filters_profiles: "Profile filters",
    close_filters: "Close filters",
    distance: "distance",
    my_position: "My location",
    clear: "Clear",
    position_undefined: "Location: undefined",
    apply: "Apply",
    age_min: "min age",
    age_max: "max age",
    minors_protection_adult: "Minor protection active: as an adult, allowed range is 18-99.",
    minors_protection_minor: "Minor protection active: allowed range is 13-17.",
    chats: "Chats",
    chat_wip: "Chat area is under construction.",
    open_swipes: "Open Swipes",
    invitations: "Invitations",
    loading_invitations: "Loading invitations...",
    view_profile: "View profile",
    find_music: "Find music",
    my_profile: "My profile",
    refresh: "Refresh",
    logout_local: "Log out (local)",
    delete_account: "Delete my account",
    logout_note: "Note: log out only removes browser tokens.",
    delete_warning: "Warning: permanent account deletion.",
    diagnostics: "Diagnostics",
    new_story_post: "New story / post",
    close: "Close",
    type: "Type",
    media: "Media",
    text: "Text",
    publish: "Publish",
    location: "Location",
    tags_csv: "Tags (comma-separated)",
    visibility: "Visibility",
    likes_enabled: "Likes enabled",
    comments_enabled: "Comments enabled",
    no_message: "(no message)",
    chat_direct_allowed: "Direct chat allowed (mutual follow).",
    invite_pending_chat_blocked: "Invitation received. Direct chat is blocked until follow is mutual.",
    login_to_see_invites: "Log in to view invitations.",
    no_invites: "No invitations for now.",
    invite_error: "Invitation error",
  },
};

export function getLanguage() {
  const raw = String(localStorage.getItem(LANG_KEY) || "fr").toLowerCase();
  return raw === "en" ? "en" : "fr";
}

export function setLanguage(lang) {
  const next = String(lang || "").toLowerCase() === "en" ? "en" : "fr";
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next;
}

export function t(key) {
  const lang = getLanguage();
  return DICT[lang]?.[key] || DICT.fr[key] || key;
}

export function applyI18n(root = document) {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", t(key));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    el.setAttribute("aria-label", t(key));
  });
}
