import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import SplashScreen from "./components/SplashScreen";
import Sidebar, {
  type AppPage,
  type PedidoNotificacion,
} from "./components/Sidebar";

import { obtenerTodosLosPedidosPorEstado } from "./services/pedidosApi";

import "./styles/sidebar.css";
import "./styles/mobile.css";

const pedidosPagePromise = import("./pages/Pedidos");
const Pedidos = lazy(() => pedidosPagePromise);
const Catalogo = lazy(() => import("./pages/Catalogo"));
const Stock = lazy(() => import("./pages/Stock"));
const Estadisticas = lazy(() => import("./pages/Estadisticas"));
const Egresos = lazy(() => import("./pages/Egresos"));
const Ingresos = lazy(() => import("./pages/Ingresos"));

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

  const terminarSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("bc-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 760px)");

    function mantenerPedidosEnMovil() {
      if (mobileViewport.matches) {
        setActivePage("pedidos");
      }
    }

    mantenerPedidosEnMovil();
    mobileViewport.addEventListener("change", mantenerPedidosEnMovil);

    return () => {
      mobileViewport.removeEventListener("change", mantenerPedidosEnMovil);
    };
  }, []);

  async function cargarPedidosPendientesTopbar() {
    try {
	      const data = await obtenerTodosLosPedidosPorEstado("PENDIENTE", 50);

	      const pendientes = data.pedidos.map((pedido) => ({
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
    return <SplashScreen onFinish={terminarSplash} />;
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
        <Suspense fallback={<div className="app-page-loading" aria-label="Cargando" />}>
          {activePage === "pedidos" && <Pedidos />}
          {activePage === "catalogo" && <Catalogo />}
          {activePage === "stock" && <Stock />}
          {activePage === "estadisticas" && <Estadisticas />}
          {activePage === "egresos" && <Egresos />}
          {activePage === "ingresos" && <Ingresos />}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
