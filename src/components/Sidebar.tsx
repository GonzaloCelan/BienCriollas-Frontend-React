import {
  Bell,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { Usuario } from "../services/authApi";

export type AppPage =
  | "pedidos"
  | "catalogo"
  | "stock"
  | "ingresos"
  | "egresos"
  | "estadisticas"
  | "usuarios"
  | "acumulado"
  | "configuracion";

export type PedidoNotificacion = {
  idPedido: number;
  cliente: string;
  horaEntrega?: string | null;
  total?: number | null;
};

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  activePage: AppPage;
  onChangePage: (page: AppPage) => void;
  pedidosPendientes?: PedidoNotificacion[];
  darkMode: boolean;
  onToggleTheme: () => void;
  usuario: Usuario;
  onLogout: () => void;
  onChangePassword: () => void;
};

type MenuItem = {
  label: string;
  page: AppPage;
  enabled: boolean;
  adminOnly?: boolean;
  hidden?: boolean;
};

const menuItems: MenuItem[] = [
  { label: "Pedidos", page: "pedidos", enabled: true },
  { label: "Catálogo", page: "catalogo", enabled: true },
  { label: "Stock", page: "stock", enabled: true },
  { label: "Ingresos", page: "ingresos", enabled: true, adminOnly: true },
  { label: "Egresos", page: "egresos", enabled: true, adminOnly: true },
  { label: "Estadísticas", page: "estadisticas", enabled: true, adminOnly: true },
  { label: "Usuarios", page: "usuarios", enabled: true, adminOnly: true, hidden: true },
];

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function Sidebar({
  activePage,
  onChangePage,
  pedidosPendientes = [],
  darkMode,
  onToggleTheme,
  usuario,
  onLogout,
  onChangePassword,
}: SidebarProps) {
  const [openNotifications, setOpenNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Partial<Record<AppPage, HTMLButtonElement | null>>>({});
  const [activePill, setActivePill] = useState({ left: 0, width: 0, ready: false });

  const visibleMenuItems = menuItems.filter(
    (item) =>
      !item.hidden && (!item.adminOnly || usuario.rol === "ADMINISTRADOR")
  );
  const cantidadPendientes = pedidosPendientes.length;
  const tienePendientes = cantidadPendientes > 0;

  useLayoutEffect(() => {
    const nav = navRef.current;
    const activeButton = itemRefs.current[activePage];
    if (!nav || !activeButton) return;

    const navRect = nav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setActivePill({
      left: buttonRect.left - navRect.left,
      width: buttonRect.width,
      ready: true,
    });
  }, [activePage, usuario.rol]);

  function cerrarPaneles() {
    setOpenNotifications(false);
    setAccountOpen(false);
    setMobileMenuOpen(false);
  }

  function handleVerPedidos() {
    cerrarPaneles();
    onChangePage("pedidos");
  }

  function handleChangePage(page: AppPage) {
    cerrarPaneles();
    onChangePage(page);
  }

  const activePageLabel =
    visibleMenuItems.find((item) => item.page === activePage)?.label ??
    "Bien Criollas";

  return (
    <>
      {mobileMenuOpen && (
        <button
          type="button"
          className="topbar__mobile-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <header className={`topbar ${mobileMenuOpen ? "topbar--menu-open" : ""}`}>
        <div className="topbar__brand">
          <button
            type="button"
            className="topbar__brand-button"
            onClick={() => handleChangePage("pedidos")}
            aria-label="Ir a pedidos"
            title="Ir a pedidos"
          >
            <img src="/logocolor.png" alt="Bien Criollas" className="topbar__brand-logo" />
          </button>
        </div>

        <span className="topbar__mobile-page">{activePageLabel}</span>

        <nav
          ref={navRef}
          className={`topbar__nav ${mobileMenuOpen ? "topbar__nav--mobile-open" : ""}`}
          aria-label="Navegación principal"
        >
          <span
            className={`topbar__active-pill ${activePill.ready ? "topbar__active-pill--ready" : ""}`}
            style={{
              width: activePill.width,
              transform: `translateX(${activePill.left}px)`,
            }}
          />

          {visibleMenuItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                ref={(node) => { itemRefs.current[item.page] = node; }}
                type="button"
                className={`topbar__item ${isActive ? "active" : ""}`}
                onClick={() => handleChangePage(item.page)}
                disabled={!item.enabled}
                title={item.label}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="topbar__actions">
          <button
            type="button"
            className="topbar__theme-btn"
            onClick={onToggleTheme}
            title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="topbar__notifications">
            <button
              className={`topbar__icon-btn ${tienePendientes ? "topbar__icon-btn--active" : ""}`}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setAccountOpen(false);
                setOpenNotifications((prev) => !prev);
              }}
              title="Pedidos pendientes"
              aria-label="Pedidos pendientes"
            >
              <Bell size={18} />
              {tienePendientes && (
                <span className="topbar__notification-badge">
                  {cantidadPendientes > 9 ? "9+" : cantidadPendientes}
                </span>
              )}
            </button>

            {openNotifications && (
              <div className="topbar__notifications-panel">
                <div className="topbar__notifications-header">
                  <div>
                    <strong>Pedidos pendientes</strong>
                    <span>
                      {tienePendientes
                        ? `${cantidadPendientes} pedidos por preparar`
                        : "Todo al día"}
                    </span>
                  </div>
                </div>

                <div className="topbar__notifications-list">
                  {tienePendientes ? (
                    pedidosPendientes.slice(0, 5).map((pedido) => (
                      <button
                        key={pedido.idPedido}
                        type="button"
                        className="topbar__notification-item"
                        onClick={handleVerPedidos}
                      >
                        <div>
                          <strong>Pedido #{pedido.idPedido}</strong>
                          <span>{pedido.cliente}</span>
                        </div>
                        <div>
                          <b>{pedido.horaEntrega || "--:--"}</b>
                          <small>{formatMoney(pedido.total)}</small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="topbar__notifications-empty">No hay pedidos pendientes.</div>
                  )}
                </div>

                <button type="button" className="topbar__notifications-action" onClick={handleVerPedidos}>
                  Ver pedidos
                </button>
              </div>
            )}
          </div>

          <div className="topbar__account">
            <button
              type="button"
              className={`topbar__icon-btn topbar__account-trigger ${accountOpen ? "topbar__account-trigger--open" : ""}`}
              onClick={() => {
                setOpenNotifications(false);
                setAccountOpen((actual) => !actual);
              }}
              aria-expanded={accountOpen}
              aria-label={`Abrir cuenta de ${usuario.nombre}`}
              title={`Cuenta de ${usuario.nombre}`}
            >
              <UserRound size={18} />
            </button>

            {accountOpen && (
              <div className="topbar__account-menu">
                <div className="topbar__account-summary">
                  <strong>{usuario.nombre}</strong>
                  <span>@{usuario.username}</span>
                </div>
                <button type="button" onClick={() => { setAccountOpen(false); onChangePassword(); }}>
                  <KeyRound size={16} /> Cambiar contraseña
                </button>
                <button type="button" className="topbar__account-logout" onClick={() => { setAccountOpen(false); onLogout(); }}>
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="topbar__mobile-menu-btn"
            onClick={() => {
              setOpenNotifications(false);
              setAccountOpen(false);
              setMobileMenuOpen((prev) => !prev);
            }}
            title={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
    </>
  );
}

export default Sidebar;
