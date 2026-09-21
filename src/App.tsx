import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { X } from "lucide-react";
import { GooeyToaster } from "goey-toast";
import { AnimatePresence, motion } from "framer-motion";

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
import { isPageAvailable } from "./config/navigation";

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
const loadIngredientes = () => import("./pages/Ingredientes");
const loadRecetas = () => import("./pages/Recetas");
const loadProceso = () => import("./pages/Proceso");
const loadNuevaProduccion = () => import("./pages/NuevaProduccion");
const loadCostosRendimiento = () => import("./pages/CostosRendimiento");
const productionPageLoaders = [
  { page: "ingredientes", load: loadIngredientes },
  { page: "recetas", load: loadRecetas },
  { page: "proceso", load: loadProceso },
  { page: "produccion-real", load: loadNuevaProduccion },
  { page: "costos-rendimiento", load: loadCostosRendimiento },
] satisfies { page: AppPage; load: () => Promise<unknown> }[];
const Ingredientes = lazy(loadIngredientes);
const Recetas = lazy(loadRecetas);
const Proceso = lazy(loadProceso);
const NuevaProduccion = lazy(loadNuevaProduccion);
const CostosRendimiento = lazy(loadCostosRendimiento);
const SeccionEnPreparacion = lazy(() => import("./pages/SeccionEnPreparacion"));

const ADMIN_PAGES: AppPage[] = [
  "ingresos",
  "egresos",
  "estadisticas",
  "usuarios",
  "empleados",
  "proveedores",
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
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>("pedidos");
  const [pedidosPendientes, setPedidosPendientes] = useState<
    PedidoNotificacion[]
  >([]);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const paginaActiva =
    !isPageAvailable(activePage) || (!esAdministrador && ADMIN_PAGES.includes(activePage))
      ? "pedidos"
      : activePage;

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

  useEffect(() => {
    let cancelled = false;
    const preload = () => {
      if (!cancelled) {
        void Promise.allSettled(
          productionPageLoaders
            .filter(({ page }) => isPageAvailable(page))
            .map(({ load }) => load())
        );
      }
    };
    const preloadTimer = window.setTimeout(preload, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(preloadTimer);
    };
  }, []);

  useLayoutEffect(() => {
    const content = document.getElementById("app-main");
    if (content) {
      content.scrollTop = 0;
      content.scrollLeft = 0;
    }
  }, [paginaActiva]);

  useEffect(() => {
    if (collapsed || sidebarHovered) return;

    const autoCollapse = window.setTimeout(() => {
      const isDesktop = window.matchMedia("(min-width: 761px)").matches;
      if (isDesktop) setCollapsed(true);
    }, 4000);

    return () => window.clearTimeout(autoCollapse);
  }, [collapsed, sidebarHovered]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((previous) => !previous);
  }, []);

  function cambiarPagina(page: AppPage) {
    if (!isPageAvailable(page)) return;
    if (!esAdministrador && ADMIN_PAGES.includes(page)) return;
    setActivePage(page);
  }

  return (
    <CatalogoProvider>
      <GooeyToaster
        position="top-left"
        theme={darkMode ? "dark" : "light"}
        duration={2000}
        offset={20}
        closeButton="top-right"
        preset="bouncy"
        showProgress
        showTimestamp={false}
      />

      <div className={`app-shell app-shell--sidebar ${collapsed ? "app-shell--collapsed" : ""}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          onHoverChange={setSidebarHovered}
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
          id="app-main"
          className={`app-content ${collapsed ? "app-content--collapsed" : ""}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={paginaActiva} className="bc-page-transition"
              initial={{ opacity: 0, y: 8, scale: .998 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: .999 }}
              transition={{ duration: .22, ease: [.22, 1, .36, 1] }}>
              <Suspense fallback={<div className="app-page-loading" aria-label="Cargando" />}>
                {paginaActiva === "pedidos" && <Pedidos />}
                {paginaActiva === "catalogo" && <Catalogo />}
                {paginaActiva === "stock" && <Stock />}
                {esAdministrador && paginaActiva === "estadisticas" && <Estadisticas />}
                {esAdministrador && paginaActiva === "egresos" && <Egresos />}
                {esAdministrador && paginaActiva === "ingresos" && <Ingresos />}
                {esAdministrador && paginaActiva === "usuarios" && <Usuarios />}
                {esAdministrador && paginaActiva === "empleados" && <Usuarios title="Usuarios" />}
                {esAdministrador && paginaActiva === "proveedores" && <SeccionEnPreparacion section="proveedores" />}
                {paginaActiva === "ingredientes" && <Ingredientes />}
                {paginaActiva === "recetas" && <Recetas />}
                {paginaActiva === "proceso" && <Proceso />}
                {paginaActiva === "produccion-real" && <NuevaProduccion />}
                {paginaActiva === "costos-rendimiento" && <CostosRendimiento />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
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
