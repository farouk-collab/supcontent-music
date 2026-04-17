import { useState, useMemo } from "react";
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Flame as FlameIcon,
  MessageSquare as MessageSquareIcon,
  ShoppingBag as ShopIcon,
  Library as LibraryIcon,
  User as UserIcon,
  ShoppingCart as CartIcon,
  Heart as HeartIcon,
  X as CloseIcon,
} from "lucide-react";

const SHOP_ITEMS = [
  {
    id: 1,
    name: "Badge VIP",
    price: 4.99,
    description: "Insigne VIP exclusive",
    category: "badges",
    image: "👑",
  },
  {
    id: 2,
    name: "Effet Étoile",
    price: 2.99,
    category: "effects",
    description: "Ajoute des étoiles à ton profil",
    image: "✨",
  },
  {
    id: 3,
    name: "Pack Couleurs",
    price: 7.99,
    category: "themes",
    description: "12 nouveaux thèmes de couleur",
    image: "🎨",
  },
  {
    id: 4,
    name: "Profil Doré",
    price: 3.99,
    category: "badges",
    description: "Cadre doré pour ton profil",
    image: "🏆",
  },
  {
    id: 5,
    name: "Filtres Photo",
    price: 1.99,
    category: "effects",
    description: "5 nouveaux filtres photo",
    image: "📸",
  },
  {
    id: 6,
    name: "Skin Beat Drop",
    price: 5.99,
    category: "themes",
    description: "Animation exclusive pour le profil",
    image: "🎵",
  },
  {
    id: 7,
    name: "Autocollants Premium",
    price: 2.99,
    category: "stickers",
    description: "100 autocollants exclusifs",
    image: "🎪",
  },
  {
    id: 8,
    name: "Emoji Personnalisés",
    price: 3.99,
    category: "stickers",
    description: "50 emoji uniques",
    image: "😎",
  },
];

export default function ShopPagePreview({ onNavigate = () => {} }) {
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCart, setShowCart] = useState(false);

  const categories = [
    { id: "all", label: "Tous" },
    { id: "badges", label: "Badges" },
    { id: "effects", label: "Effets" },
    { id: "themes", label: "Thèmes" },
    { id: "stickers", label: "Autocollants" },
  ];

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return SHOP_ITEMS;
    return SHOP_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  }, [cart]);

  const toggleFavorite = (itemId) => {
    setFavorites((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const addToCart = (item) => {
    setCart((prev) => [...prev, item]);
  };

  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.15),_transparent_18%),linear-gradient(180deg,_#050505,_#0d0d0d)] pb-24 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">SupContent</p>
              <h1 className="text-2xl font-semibold">Boutique</h1>
            </div>
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative rounded-full bg-emerald-400/10 p-3 text-emerald-400 hover:bg-emerald-400/20"
            >
              <CartIcon size={24} />
              {cart.length > 0 && (
                <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-black">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-gradient-to-b from-black to-black/95 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Panier</h2>
              <button onClick={() => setShowCart(false)} className="text-zinc-400 hover:text-white">
                <CloseIcon size={24} />
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-zinc-400">Panier vide</p>
            ) : (
              <>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-zinc-400">{item.image}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{item.price}€</span>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <CloseIcon size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-emerald-400">{cartTotal}€</span>
                  </div>
                  <button className="w-full rounded-full bg-emerald-400 py-3 text-sm font-semibold text-black hover:bg-emerald-300">
                    Valider l&apos;achat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Category Filter */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-emerald-400 text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Shop Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 hover:bg-white/10"
            >
              {/* Item Image */}
              <div className="mb-4 flex h-24 items-center justify-center rounded-xl bg-white/5 text-4xl">
                {item.image}
              </div>

              {/* Item Info */}
              <h3 className="mb-1 font-semibold">{item.name}</h3>
              <p className="mb-3 text-xs text-zinc-400">{item.description}</p>

              {/* Price */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-400">{item.price}€</span>
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className={`rounded-full p-2 ${
                    favorites.includes(item.id) ? "bg-red-500/20 text-red-400" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  <HeartIcon size={16} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={() => addToCart(item)}
                className="w-full rounded-full bg-emerald-400 py-2 text-sm font-semibold text-black hover:bg-emerald-300"
              >
                Ajouter au panier
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-4">
          {[
            { label: "Accueil", icon: <HomeIcon size={20} /> },
            { label: "Recherche", icon: <SearchIcon size={20} /> },
            { label: "Swipe", icon: <FlameIcon size={20} /> },
            { label: "Chat", icon: <MessageSquareIcon size={20} /> },
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
                item.label === "Boutique" ? "text-emerald-400" : "text-zinc-400 hover:text-white"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
