import { useEffect, useState } from "react";

import SplashScreen from "./components/SplashScreen";
import Sidebar, { type AppPage } from "./components/Sidebar";
import Pedidos from "./pages/Pedidos";
import Stock from "./pages/Stock";
import Estadisticas from "./pages/Estadisticas";
import Egresos from "./pages/Egresos";
import Ingresos from "./pages/Ingresos";

import "./styles/global.css";
import "./styles/sidebar.css";
import "./styles/pedidos.css";
import "./styles/stock.css";
import "./styles/estadisticas.css";
import "./styles/kpi.css";
import "./styles/egresos.css";
import "./styles/ingresos.css";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("pedidos");

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("bc-theme") === "dark";
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("bc-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        activePage={activePage}
        onChangePage={setActivePage}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
      />

      <main
        className={`app-content ${collapsed ? "app-content--collapsed" : ""}`}
      >
        {activePage === "pedidos" && <Pedidos />}
        {activePage === "stock" && <Stock />}
        {activePage === "estadisticas" && <Estadisticas />}
        {activePage === "egresos" && <Egresos />}
        {activePage === "ingresos" && <Ingresos />}
      </main>
    </div>
  );
}

export default App;