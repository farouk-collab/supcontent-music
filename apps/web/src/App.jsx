import { useState } from "react";
import MusicLibraryPagePreview from "./components/MusicLibraryPagePreview";
import ParametresPagePreview from "./components/ParametresPagePreview";
import ShopPagePreview from "./components/ShopPagePreview";

export default function App() {
  const [currentPage, setCurrentPage] = useState("library");

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  return (
    <main>
      {currentPage === "library" && <MusicLibraryPagePreview onNavigate={navigateTo} />}
      {currentPage === "parametres" && <ParametresPagePreview onNavigate={navigateTo} />}
      {currentPage === "shop" && <ShopPagePreview onNavigate={navigateTo} />}
    </main>
  );
}
