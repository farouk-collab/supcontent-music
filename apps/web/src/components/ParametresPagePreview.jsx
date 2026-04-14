import { useMemo, useState } from "react";
import {
  ArrowLeft as BackIcon,
  Shield as PrivacyIcon,
  MapPinOff as HideLocationIcon,
  MessageSquare as MessagesIcon,
  MessageCircle as CommentsIcon,
  UserPlus as FollowersIcon,
  Eye as VisibilityIcon,
  Filter as FilterIcon,
  MapPinned as PositionIcon,
  Languages as LanguageIcon,
  SlidersHorizontal as SettingsIcon,
  CircleCheck as CheckIcon,
  Moon as DarkModeIcon,
  Sun as LightModeIcon,
  Palette as PaletteIcon,
  Volume2 as SoundIcon,
  Smartphone as AppIcon,
  ShieldAlert as SafetyIcon,
  Wifi as DataIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Flame as FlameIcon,
  Library as LibraryIcon,
  ShoppingBag as ShopIcon,
  User as UserIcon,
} from "lucide-react";

const DEFAULT_SETTINGS = {
  profileVisibility: "followers",
  hideLocation: true,
  messages: true,
  comments: true,
  newFollowers: true,
  mutedWords: "insulte1, insulte2, spoiler...",
  distanceFilter: true,
  liveLocation: false,
  maxDistance: 50,
  minAge: 17,
  maxAge: 99,
  genders: {
    male: true,
    female: true,
    other: true,
    discret: false,
  },
  useMyPosition: true,
  position: "48.74959, 2.40675",
  language: "Français",
  theme: "Sombre",
  accentColor: "Vert émeraude",
  autoplayVideo: true,
  reducedDataMode: false,
  soundEffects: true,
  safeMode: true,
  compactMode: false,
};

function runSettingsTests(state) {
  const cases = [
    {
      name: "âge min inférieur à âge max",
      check: () => Number(state.minAge) <= Number(state.maxAge),
    },
    {
      name: "distance max positive",
      check: () => Number(state.maxDistance) >= 0,
    },
    {
      name: "au moins un sexe coché",
      check: () => Object.values(state.genders).some(Boolean),
    },
    {
      name: "thème valide",
      check: () => ["Sombre", "Clair"].includes(state.theme),
    },
    {
      name: "langue définie",
      check: () => Boolean(state.language),
    },
  ];

  return cases.map((test) => ({ name: test.name, passed: test.check() }));
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
          <Icon size={18} />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-sm text-zinc-200">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-7 w-14 rounded-full transition ${checked ? "bg-emerald-400" : "bg-zinc-700"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-8" : "left-1"}`}
        />
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
      />
    </label>
  );
}

function ChoicePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition ${
        active ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/5 text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function ParametresPagePreview({ onNavigate = () => {} }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState("Paramètres prêts");

  const tests = useMemo(() => runSettingsTests(settings), [settings]);
  const allTestsPassed = tests.every((test) => test.passed);

  const setGender = (key) => {
    setSettings((prev) => ({
      ...prev,
      genders: {
        ...prev.genders,
        [key]: !prev.genders[key],
      },
    }));
  };

  const saveSettings = () => {
    setFeedback("Paramètres mis à jour");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.15),_transparent_18%),linear-gradient(180deg,_#050505,_#0d0d0d)] px-4 py-8 text-white md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button type="button" className="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                <BackIcon size={16} /> Retour
              </button>
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">Paramètres</p>
              <h1 className="mt-2 text-3xl font-semibold">Paramètres et activité</h1>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-black"
            >
              Enregistrer
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-6">
            <SectionCard title="Qui peut voir ton contenu" icon={VisibilityIcon}>
              <label className="grid gap-2 text-sm">
                <span className="text-zinc-300">Confidentialité du compte</span>
                <select
                  value={settings.profileVisibility}
                  onChange={(e) => setSettings((prev) => ({ ...prev, profileVisibility: e.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers uniquement</option>
                  <option value="private">Privé</option>
                </select>
              </label>

              <ToggleRow
                label="Masquer ma localisation"
                checked={settings.hideLocation}
                onChange={() => setSettings((prev) => ({ ...prev, hideLocation: !prev.hideLocation }))}
              />
            </SectionCard>

            <SectionCard title="Moyens d'interagir avec toi" icon={MessagesIcon}>
              <ToggleRow
                label="Messages"
                checked={settings.messages}
                onChange={() => setSettings((prev) => ({ ...prev, messages: !prev.messages }))}
              />
              <ToggleRow
                label="Commentaires"
                checked={settings.comments}
                onChange={() => setSettings((prev) => ({ ...prev, comments: !prev.comments }))}
              />
              <ToggleRow
                label="Nouveaux followers"
                checked={settings.newFollowers}
                onChange={() => setSettings((prev) => ({ ...prev, newFollowers: !prev.newFollowers }))}
              />
            </SectionCard>

            <SectionCard title="Interactions" icon={CommentsIcon}>
              <label className="grid gap-2 text-sm">
                <span className="text-zinc-300">Mots masqués (séparés par des virgules)</span>
                <input
                  value={settings.mutedWords}
                  onChange={(e) => setSettings((prev) => ({ ...prev, mutedWords: e.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
            </SectionCard>

            <SectionCard title="Swipe profils" icon={FilterIcon}>
              <ToggleRow
                label="Filtrer par distance"
                checked={settings.distanceFilter}
                onChange={() => setSettings((prev) => ({ ...prev, distanceFilter: !prev.distanceFilter }))}
              />
              <ToggleRow
                label="Localisation live"
                checked={settings.liveLocation}
                onChange={() => setSettings((prev) => ({ ...prev, liveLocation: !prev.liveLocation }))}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="Distance max (km)"
                  value={settings.maxDistance}
                  min={0}
                  max={500}
                  onChange={(e) => setSettings((prev) => ({ ...prev, maxDistance: e.target.value }))}
                />
                <NumberField
                  label="Âge min"
                  value={settings.minAge}
                  min={17}
                  max={99}
                  onChange={(e) => setSettings((prev) => ({ ...prev, minAge: e.target.value }))}
                />
                <NumberField
                  label="Âge max"
                  value={settings.maxAge}
                  min={17}
                  max={99}
                  onChange={(e) => setSettings((prev) => ({ ...prev, maxAge: e.target.value }))}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-300">Sexes à afficher</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(settings.genders).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => setGender(key)}
                        className="accent-emerald-400"
                      />
                      {key}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, useMyPosition: true }));
                    setFeedback("Position utilisateur activée");
                  }}
                  className="rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200"
                >
                  Utiliser ma position
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, position: "Aucune" }));
                    setFeedback("Position effacée");
                  }}
                  className="rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200"
                >
                  Effacer position
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                Position: {settings.position}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Préférence d'application" icon={SettingsIcon}>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-300">Thème</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ChoicePill
                    active={settings.theme === "Sombre"}
                    onClick={() => setSettings((prev) => ({ ...prev, theme: "Sombre" }))}
                  >
                    <DarkModeIcon size={14} className="mr-2 inline-block" /> Sombre
                  </ChoicePill>
                  <ChoicePill
                    active={settings.theme === "Clair"}
                    onClick={() => setSettings((prev) => ({ ...prev, theme: "Clair" }))}
                  >
                    <LightModeIcon size={14} className="mr-2 inline-block" /> Clair
                  </ChoicePill>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-300">Couleur d'accent</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Vert émeraude", "Violet", "Bleu", "Rose"].map((color) => (
                    <ChoicePill
                      key={color}
                      active={settings.accentColor === color}
                      onClick={() => setSettings((prev) => ({ ...prev, accentColor: color }))}
                    >
                      <PaletteIcon size={14} className="mr-2 inline-block" /> {color}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <label className="grid gap-2 text-sm">
                <span className="text-zinc-300">Langue</span>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option>Français</option>
                  <option>English</option>
                  <option>Español</option>
                  <option>Deutsch</option>
                </select>
              </label>

              <ToggleRow
                label="Lecture auto des vidéos"
                checked={settings.autoplayVideo}
                onChange={() => setSettings((prev) => ({ ...prev, autoplayVideo: !prev.autoplayVideo }))}
              />
              <ToggleRow
                label="Effets sonores"
                checked={settings.soundEffects}
                onChange={() => setSettings((prev) => ({ ...prev, soundEffects: !prev.soundEffects }))}
              />
              <ToggleRow
                label="Mode compact"
                checked={settings.compactMode}
                onChange={() => setSettings((prev) => ({ ...prev, compactMode: !prev.compactMode }))}
              />
              <ToggleRow
                label="Mode économie de données"
                checked={settings.reducedDataMode}
                onChange={() => setSettings((prev) => ({ ...prev, reducedDataMode: !prev.reducedDataMode }))}
              />
              <ToggleRow
                label="Mode sécurité renforcé"
                checked={settings.safeMode}
                onChange={() => setSettings((prev) => ({ ...prev, safeMode: !prev.safeMode }))}
              />
            </SectionCard>

            <SectionCard title="Résumé rapide" icon={CheckIcon}>
              <div className="space-y-3 text-sm text-zinc-300">
                <p><PrivacyIcon size={15} className="mr-2 inline-block text-emerald-300" /> Confidentialité : {settings.profileVisibility}</p>
                <p><HideLocationIcon size={15} className="mr-2 inline-block text-emerald-300" /> Localisation masquée : {settings.hideLocation ? "oui" : "non"}</p>
                <p><MessagesIcon size={15} className="mr-2 inline-block text-emerald-300" /> Messages : {settings.messages ? "activés" : "désactivés"}</p>
                <p><FollowersIcon size={15} className="mr-2 inline-block text-emerald-300" /> Nouveaux followers : {settings.newFollowers ? "activés" : "désactivés"}</p>
                <p><PositionIcon size={15} className="mr-2 inline-block text-emerald-300" /> Position : {settings.position}</p>
                <p><LanguageIcon size={15} className="mr-2 inline-block text-emerald-300" /> Langue : {settings.language}</p>
                <p><AppIcon size={15} className="mr-2 inline-block text-emerald-300" /> Thème : {settings.theme}</p>
                <p><PaletteIcon size={15} className="mr-2 inline-block text-emerald-300" /> Accent : {settings.accentColor}</p>
                <p><SoundIcon size={15} className="mr-2 inline-block text-emerald-300" /> Effets sonores : {settings.soundEffects ? "oui" : "non"}</p>
                <p><DataIcon size={15} className="mr-2 inline-block text-emerald-300" /> Économie de données : {settings.reducedDataMode ? "oui" : "non"}</p>
                <p><SafetyIcon size={15} className="mr-2 inline-block text-emerald-300" /> Sécurité renforcée : {settings.safeMode ? "oui" : "non"}</p>
              </div>
            </SectionCard>

            <SectionCard title="Validation" icon={CheckIcon}>
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  allTestsPassed
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : "border-red-400/20 bg-red-500/10 text-red-200"
                }`}
              >
                {allTestsPassed ? "Tests paramètres passés" : "Un test paramètres a échoué"}
              </div>
              <p className="text-sm text-zinc-400">{feedback}</p>
            </SectionCard>
          </div>
        </div>

        {/* Footer Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-around px-4">
            {[
              { label: "Accueil", icon: <HomeIcon size={20} /> },
              { label: "Recherche", icon: <SearchIcon size={20} /> },
              { label: "Swipe", icon: <FlameIcon size={20} /> },
              { label: "Chat", icon: <MessagesIcon size={20} /> },
              { label: "Boutique", icon: <ShopIcon size={20} /> },
              { label: "Biblio", icon: <LibraryIcon size={20} /> },
              { label: "Profil", icon: <UserIcon size={20} /> },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.label === "Biblio") onNavigate("library");
                  if (item.label === "Boutique") onNavigate("shop");
                  if (item.label === "Profil") onNavigate("profil");
                }}
                className={`flex flex-col items-center gap-1 py-4 text-xs ${
                  item.label === "Paramètres" ? "text-emerald-400" : "text-zinc-400 hover:text-white"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
