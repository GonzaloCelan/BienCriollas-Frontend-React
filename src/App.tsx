import { useEffect, useState } from "react";

import SplashScreen from "./components/SplashScreen";
import Sidebar, { type AppPage } from "./components/Sidebar";

import Pedidos from "./pages/Pedidos";
import Stock from "./pages/Stock";
import Estadisticas from "./pages/Estadisticas";
import Egresos from "./pages/Egresos";
import Ingresos from "./pages/Ingresos";

import {
  obtenerPedidosPendientesNotificacion,
  type PedidoNotificacionDTO,
} from "./services/pedidosApi";

import "./styles/estadisticas.css";
import "./styles/stock.css";
import "./styles/global.css";
import "./styles/sidebar.css";
import "./styles/pedidos.css";
import "./styles/kpi.css";
import "./styles/egresos.css";
import "./styles/ingresos.css";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("pedidos");

  const [pedidosPendientes, setPedidosPendientes] = useState<
    PedidoNotificacionDTO[]
  >([]);

  async function cargarNotificacionesPedidos() {
    console.log("🔔 Entró a cargarNotificacionesPedidos");

    try {
      const data = await obtenerPedidosPendientesNotificacion();

      console.log("🔔 DATA CAMPANITA:", data);
      console.log("🔔 CANTIDAD:", data.length);

      setPedidosPendientes(data);
    } catch (error) {
      console.error("❌ No se pudieron cargar los pedidos pendientes", error);
    }
  }

  useEffect(() => {
    console.log("🚀 App montado");
  }, []);

  useEffect(() => {
    console.log("👀 showSplash cambió:", showSplash);

    if (showSplash) return;

    cargarNotificacionesPedidos();

    const interval = window.setInterval(() => {
      cargarNotificacionesPedidos();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [showSplash]);

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
        pedidosPendientes={pedidosPendientes}
      />

     <main className="app-content">
  <div key={activePage} className="page-transition">
    {activePage === "pedidos" && <Pedidos />}
    {activePage === "stock" && <Stock />}
    {activePage === "ingresos" && <Ingresos />}
    {activePage === "egresos" && <Egresos />}
    {activePage === "estadisticas" && <Estadisticas />}
  </div>
</main>
    </div>
  );
}

export default App;