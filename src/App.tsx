import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { X } from "lucide-react";

import SplashScreen from "./components/SplashScreen";
import LoginScreen, { SessionLoadingScreen } from "./components/LoginScreen";
import ChangePasswordDialog from "./components/ChangePasswordDialog";
import Sidebar, {
  type AppPage,
  type PedidoNotificacion,
} from "./components/Sidebar";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import { CatalogoProvider } from "./context/CatalogoContext";
import {
  actualizarBadgePedidosPendientes,
  limpiarBadgePedidos,
} from "./services/appBadge";
import { obtenerTodosLosPedidosPorEstado } from "./services/pedidosApi";

import "./styles/sidebar.css";
import "./styles/mobile.css";
import "./styles/auth.css";

const pedidosPagePromise = import("./pages/Pedidos");
const Pedidos = lazy(() => pedidosPagePromise);
const Catalogo = lazy(() => import("./pages/Catalogo"));
const Stock = lazy(() => import("./pages/Stock"));
const Estadisticas = lazy(() => import("./pages/Estadisticas"));
const Egresos = lazy(() => import("./pages/Egresos"));
const Ingresos = lazy(() => import("./pages/Ingresos"));
const Usuarios = lazy(() => import("./pages/Usuarios"));

const ADMIN_PAGES: AppPage[] = [
  "ingresos",
  "egresos",
  "estadisticas",
  "usuarios",
];

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
    if (match?.[1]) return match[1];
  }

  return null;
}

type AuthenticatedAppProps = {
  darkMode: boolean;
  onToggleTheme: () => void;
};

function AuthenticatedApp({
  darkMode,
  onToggleTheme,
}: AuthenticatedAppProps) {
  const {
    usuario,
    esAdministrador,
    cerrarSesion,
    permisoError,
    limpiarPermisoError,
  } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("pedidos");
  const [pedidosPendientes, setPedidosPendientes] = useState<
    PedidoNotificacion[]
  >([]);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const paginaActiva =
    !esAdministrador && ADMIN_PAGES.includes(activePage)
      ? "pedidos"
      : activePage;

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 760px)");

    function mantenerPedidosEnMovil() {
      if (mobileViewport.matches) setActivePage("pedidos");
    }

    mantenerPedidosEnMovil();
    mobileViewport.addEventListener("change", mantenerPedidosEnMovil);
    return () => mobileViewport.removeEventListener("change", mantenerPedidosEnMovil);
  }, []);

  const cargarPedidosPendientesTopbar = useCallback(async () => {
    try {
      const data = await obtenerTodosLosPedidosPorEstado("PENDIENTE", 50);
      setPedidosPendientes(
        data.pedidos.map((pedido) => ({
          idPedido: pedido.id,
          cliente: pedido.cliente || "Sin cliente",
          horaEntrega: obtenerHorarioPedido(pedido),
          total: Number(pedido.total ?? 0),
        }))
      );
    } catch (error) {
      console.error("No se pudieron cargar las notificaciones.", error);
      setPedidosPendientes([]);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(cargarPedidosPendientesTopbar, 0);
    const interval = window.setInterval(cargarPedidosPendientesTopbar, 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [cargarPedidosPendientesTopbar]);

  useEffect(() => {
    const refresh = window.setTimeout(cargarPedidosPendientesTopbar, 0);
    return () => window.clearTimeout(refresh);
  }, [paginaActiva, cargarPedidosPendientesTopbar]);

  useEffect(() => {
    void actualizarBadgePedidosPendientes(pedidosPendientes.length);
  }, [pedidosPendientes.length]);

  useEffect(() => {
    return () => {
      void limpiarBadgePedidos();
    };
  }, []);

  function cambiarPagina(page: AppPage) {
    if (!esAdministrador && ADMIN_PAGES.includes(page)) return;
    setActivePage(page);
  }

  return (
    <CatalogoProvider>
      <div className="app-shell">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
          activePage={paginaActiva}
          onChangePage={cambiarPagina}
          pedidosPendientes={pedidosPendientes}
          darkMode={darkMode}
          onToggleTheme={onToggleTheme}
          usuario={usuario!}
          onLogout={() => void cerrarSesion()}
          onChangePassword={() => setChangePasswordOpen(true)}
        />

        {permisoError && (
          <div className="auth-permission-alert" role="alert">
            <span>{permisoError}</span>
            <button type="button" onClick={limpiarPermisoError} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        )}

        <main
          className={`app-content ${collapsed ? "app-content--collapsed" : ""}`}
        >
          <Suspense
            fallback={<div className="app-page-loading" aria-label="Cargando" />}
          >
            {paginaActiva === "pedidos" && <Pedidos />}
            {paginaActiva === "catalogo" && <Catalogo />}
            {paginaActiva === "stock" && <Stock />}
            {esAdministrador && paginaActiva === "estadisticas" && <Estadisticas />}
            {esAdministrador && paginaActiva === "egresos" && <Egresos />}
            {esAdministrador && paginaActiva === "ingresos" && <Ingresos />}
            {esAdministrador && paginaActiva === "usuarios" && <Usuarios />}
          </Suspense>
        </main>

        <ChangePasswordDialog
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
        />
      </div>
    </CatalogoProvider>
  );
}

function AppContent() {
  const { usuario, recuperandoSesion } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("bc-theme") === "dark"
  );

  const terminarSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("bc-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  if (showSplash) return <SplashScreen onFinish={terminarSplash} />;
  if (recuperandoSesion) return <SessionLoadingScreen />;
  if (!usuario) return <LoginScreen />;

  return (
    <AuthenticatedApp
      darkMode={darkMode}
      onToggleTheme={() => setDarkMode((actual) => !actual)}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
