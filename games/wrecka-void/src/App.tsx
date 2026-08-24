import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { GamePage } from "./pages/GamePage";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const renderPage = () => {
    switch (currentPage) {
      case "game":
        return <GamePage onNavigate={setCurrentPage} />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return renderPage();
}

export default App;
