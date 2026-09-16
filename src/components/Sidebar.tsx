import {
  ArrowDownLeft, ArrowUpRight, Bell, BookOpen, ChartNoAxesCombined, ChefHat,
  ChevronDown, ClipboardList, Factory, KeyRound, Layers3, LockKeyhole, LogOut, Menu, Moon, Package,
  PanelLeftClose, PanelLeftOpen, ShoppingBag, Sun, UserRound, UsersRound,
  Wheat, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Usuario } from "../services/authApi";
import { isPageAvailable, productionEnabled } from "../config/navigation";

export type AppPage = "pedidos" | "catalogo" | "stock" | "ingresos" | "egresos"
  | "estadisticas" | "usuarios" | "empleados" | "proveedores"
  | "ingredientes" | "recetas" | "proceso" | "produccion-real" | "costos-rendimiento";
export type PedidoNotificacion = {
  idPedido: number; cliente: string; horaEntrega?: string | null; total?: number | null;
};
type SidebarProps = {
  collapsed: boolean; onToggle: () => void; activePage: AppPage;
  onChangePage: (page: AppPage) => void; pedidosPendientes?: PedidoNotificacion[];
  darkMode: boolean; onToggleTheme: () => void; usuario: Usuario;
  onLogout: () => void; onChangePassword: () => void;
};
type MenuItem = { label: string; page: AppPage; icon: LucideIcon };
const operationItems: MenuItem[] = [
  { label: "Pedidos", page: "pedidos", icon: ShoppingBag },
  { label: "Catálogo", page: "catalogo", icon: BookOpen },
  { label: "Stock", page: "stock", icon: Package },
];
const managementItems: MenuItem[] = [
  { label: "Usuarios", page: "empleados", icon: UsersRound },
  { label: "Ingresos", page: "ingresos", icon: ArrowDownLeft },
  { label: "Egresos", page: "egresos", icon: ArrowUpRight },
  { label: "Estadísticas", page: "estadisticas", icon: ChartNoAxesCombined },
];
const productionItems: MenuItem[] = [
  { label: "Ingredientes", page: "ingredientes", icon: Wheat },
  { label: "Recetas", page: "recetas", icon: ClipboardList },
  { label: "Procesos", page: "proceso", icon: Layers3 },
  { label: "Nueva producción", page: "produccion-real", icon: Factory },
  { label: "Costos y rendimiento", page: "costos-rendimiento", icon: ChartNoAxesCombined },
];

export default function Sidebar({ collapsed, onToggle, activePage, onChangePage,
  pedidosPendientes = [], darkMode, onToggleTheme, usuario, onLogout,
  onChangePassword }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [panel, setPanel] = useState<"account" | "notifications" | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const admin = usuario.rol === "ADMINISTRADOR";
  const inProduction = productionItems.some((item) => item.page === activePage);
  const showProductionMenu = productionOpen || !productionEnabled;

  useEffect(() => {
    if (!panel) return;
    function dismiss(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        actionsRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
        setPanel(null);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const menuButton = menuButtonRef.current;
    const main = document.getElementById("app-main");
    const header = document.getElementById("app-header");
    main?.setAttribute("inert", "");
    header?.setAttribute("inert", "");
    sidebar?.querySelector<HTMLButtonElement>("button")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const buttons = Array.from(sidebar?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .filter((button) => !button.disabled && button.getClientRects().length > 0 && !button.closest("[inert]"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
    const viewport = window.matchMedia("(max-width: 760px)");
    const closeOnDesktop = () => { if (!viewport.matches) setMobileOpen(false); };
    document.addEventListener("keydown", keyboard);
    viewport.addEventListener("change", closeOnDesktop);
    return () => {
      main?.removeAttribute("inert");
      header?.removeAttribute("inert");
      document.removeEventListener("keydown", keyboard);
      viewport.removeEventListener("change", closeOnDesktop);
      menuButton?.focus();
    };
  }, [mobileOpen]);

  function navigate(page: AppPage) {
    if (!isPageAvailable(page)) return;
    onChangePage(page);
    setMobileOpen(false);
    setPanel(null);
  }

  function renderItem(item: MenuItem, child = false) {
    const locked = !isPageAvailable(item.page);
    const active = !locked && (activePage === item.page || (item.page === "empleados" && activePage === "usuarios"));
    return <button key={item.page} type="button"
      className={`bc-nav-item ${active ? "is-active" : ""} ${child ? "bc-nav-item--child" : ""}`}
      disabled={locked}
      aria-current={active ? "page" : undefined} aria-label={item.label}
      title={locked ? `${item.label}: pendiente de habilitación` : item.label}
      onClick={() => navigate(item.page)}>
      {active && <motion.span className="bc-nav-active-pill" layoutId="bc-sidebar-active-pill" transition={{ type: "spring", stiffness: 310, damping: 30, mass: .72 }} />}
      <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />
      <span className="bc-nav-label">{item.label}</span>
      {locked && <LockKeyhole size={13} className="bc-nav-lock" aria-hidden="true" />}
      {item.page === "pedidos" && pedidosPendientes.length > 0 &&
        <span className="bc-nav-count">{pedidosPendientes.length}</span>}
    </button>;
  }

  const utilityActions = <div className="bc-sidebar-utilities" ref={actionsRef}>
    <motion.button type="button" className="bc-icon-button bc-theme-trigger" onClick={onToggleTheme}
      aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      whileHover={{ y: -3, scale: 1.05 }} whileTap={{ scale: .88 }}>
      <motion.span className="bc-theme-symbol" key={darkMode ? "sun" : "moon"} initial={{ opacity: 0, rotate: -70, scale: .55 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 19 }}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</motion.span>
    </motion.button>
    <motion.button type="button" className="bc-icon-button bc-bell-trigger" aria-label="Pedidos pendientes" aria-expanded={panel === "notifications"}
      title="Pedidos pendientes" onClick={() => setPanel(panel === "notifications" ? null : "notifications")} whileHover={{ y: -3, scale: 1.05 }} whileTap={{ scale: .88 }}><Bell size={18} />
      {pedidosPendientes.length > 0 && <motion.span className="bc-notification-dot" initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 1] }} transition={{ duration: .45 }} />}
    </motion.button>
    <motion.button type="button" className="bc-icon-button bc-account-trigger" aria-label={`Abrir cuenta de ${usuario.nombre}`} aria-expanded={panel === "account"}
      title={`Cuenta de ${usuario.nombre}`} onClick={() => setPanel(panel === "account" ? null : "account")} whileHover={{ y: -3, scale: 1.05 }} whileTap={{ scale: .88 }}><UserRound size={18} /></motion.button>
    {panel === "account" && <motion.div className="bc-popover" initial={{ opacity: 0, x: -8, y: 5, scale: .96 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 330, damping: 27 }}>
      <div className="bc-popover-heading"><strong>{usuario.nombre}</strong><small>@{usuario.username}</small></div>
      <button type="button" onClick={() => { setPanel(null); onChangePassword(); }}><KeyRound size={16} />Cambiar contraseña</button>
      <button type="button" className="bc-logout" onClick={() => { setPanel(null); onLogout(); }}><LogOut size={16} />Cerrar sesión</button>
    </motion.div>}
    {panel === "notifications" && <motion.div className="bc-popover bc-popover--notifications" initial={{ opacity: 0, x: -8, y: 5, scale: .96 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 330, damping: 27 }}>
      <div className="bc-popover-heading"><strong>Pedidos pendientes</strong><small>{pedidosPendientes.length ? `${pedidosPendientes.length} pedidos por preparar` : "Todo al día"}</small></div>
      <div className="bc-notification-list">{pedidosPendientes.length ? pedidosPendientes.slice(0, 5).map((pedido) =>
        <button key={pedido.idPedido} type="button" onClick={() => navigate("pedidos")}>
          <span><strong>Pedido #{pedido.idPedido}</strong><small>{pedido.cliente}</small></span>
          <span><strong>{pedido.horaEntrega || "--:--"}</strong><small>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(pedido.total ?? 0)}</small></span>
        </button>) : <p>No hay pedidos pendientes.</p>}</div>
      <button type="button" className="bc-popover-primary" onClick={() => navigate("pedidos")}>Ver pedidos</button>
    </motion.div>}
  </div>;

  return <>
    {mobileOpen && <div className="bc-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
    <aside id="app-sidebar" ref={sidebarRef}
      className={`bc-sidebar ${collapsed ? "bc-sidebar--collapsed" : ""} ${mobileOpen ? "bc-sidebar--open" : ""}`}
      aria-label="Menú lateral" role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen ? true : undefined}>
      <div className="bc-sidebar-brand">
        <button type="button" className="bc-brand" onClick={() => navigate("pedidos")} aria-label="Ir a pedidos">
          <span className="bc-brand-copy"><strong>Bien Criollas</strong><small>SISTEMA DE GESTIÓN</small></span>
        </button>
        <button type="button" className="bc-icon-button bc-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
      </div>
      <nav className="bc-sidebar-nav" aria-label="Navegación principal">
        <div className="bc-nav-group"><p className="bc-nav-heading">Operación</p>
          {operationItems.map((item) => renderItem(item))}
          <button type="button" className={`bc-nav-item bc-production-toggle ${inProduction ? "is-parent-active" : ""}`}
            disabled={!productionEnabled}
            aria-label="Producción" title={productionEnabled ? "Producción" : "Producción: pendiente de habilitación"}
            aria-expanded={showProductionMenu && (!collapsed || mobileOpen)} aria-controls="production-menu"
            onClick={() => {
              if (collapsed && !mobileOpen) { onToggle(); setProductionOpen(true); }
              else setProductionOpen((open) => !open);
            }}>
            <ChefHat size={19} strokeWidth={1.8} aria-hidden="true" /><span className="bc-nav-label">Producción</span>
            {productionEnabled
              ? <ChevronDown size={15} className={`bc-nav-chevron ${productionOpen ? "is-open" : ""}`} />
              : <LockKeyhole size={14} className="bc-nav-lock" aria-hidden="true" />}
          </button>
          <div id="production-menu" className={`bc-submenu ${showProductionMenu ? "bc-submenu--open" : ""}`}
            inert={!showProductionMenu || (collapsed && !mobileOpen)}>
            <div className="bc-submenu-inner">{productionItems.map((item) => renderItem(item, true))}</div>
          </div>
        </div>
        {admin && <div className="bc-nav-group"><p className="bc-nav-heading">Administración</p>
          {managementItems.map((item) => renderItem(item))}
        </div>}
      </nav>
      <footer className="bc-sidebar-footer">
        {utilityActions}
        <button type="button" className="bc-nav-item bc-collapse" onClick={onToggle}
          aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} title={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}>
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}<span className="bc-nav-label">Contraer menú</span>
        </button>
      </footer>
    </aside>
    <header id="app-header" className="bc-workspace-header">
      <button ref={menuButtonRef} type="button" className="bc-icon-button bc-mobile-trigger"
        aria-label="Abrir menú" aria-expanded={mobileOpen} aria-controls="app-sidebar"
        onClick={() => { setPanel(null); setMobileOpen(true); }}><Menu size={21} /></button>
    </header>
  </>;
}
