import { useEffect, useState } from "react";

import SplashScreen from "./components/SplashScreen";
import Sidebar, {
  type AppPage,
  type PedidoNotificacion,
} from "./components/Sidebar";

import Pedidos from "./pages/Pedidos";
import Stock from "./pages/Stock";
import Estadisticas from "./pages/Estadisticas";
import Egresos from "./pages/Egresos";
import Ingresos from "./pages/Ingresos";

import { obtenerPedidosPorEstado } from "./services/pedidosApi";

import "./styles/global.css";
import "./styles/sidebar.css";
import "./styles/pedidos.css";
import "./styles/stock.css";
import "./styles/estadisticas.css";
import "./styles/kpi.css";
import "./styles/egresos.css";
import "./styles/ingresos.css";

function obtenerHorarioPedido(pedido: unknown) {
  const data = pedido as {
    horario?: unknown;
    horaEntrega?: unknown;
    detalle?: unknown;
  };

  if (typeof data.horario === "string" && data.horario.trim()) {
    return data.horario;
  }

  if (typeof data.horaEntrega === "string" && data.horaEntrega.trim()) {
    return data.horaEntrega.slice(0, 5);
  }

  if (typeof data.detalle === "string") {
    const match = data.detalle.match(/Entrega\s+(\d{2}:\d{2})/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("pedidos");
  const [pedidosPendientes, setPedidosPendientes] = useState<
    PedidoNotificacion[]
  >([]);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("bc-theme") === "dark";
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("bc-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function cargarPedidosPendientesTopbar() {
    try {
      const data = await obtenerPedidosPorEstado("PENDIENTE", 0, 50);

      const pendientes = data.map((pedido) => ({
        idPedido: pedido.id,
        cliente: pedido.cliente || "Sin cliente",
        horaEntrega: obtenerHorarioPedido(pedido),
        total: Number(pedido.total ?? 0),
      }));

      setPedidosPendientes(pendientes);
    } catch (error) {
      console.error("No se pudieron cargar las notificaciones.", error);
      setPedidosPendientes([]);
    }
  }

  useEffect(() => {
    cargarPedidosPendientesTopbar();

    const interval = window.setInterval(() => {
      cargarPedidosPendientesTopbar();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    cargarPedidosPendientesTopbar();
  }, [activePage]);

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