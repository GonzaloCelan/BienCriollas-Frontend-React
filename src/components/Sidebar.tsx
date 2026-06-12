import { Bell, Moon, Sun } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

export type AppPage =
  | "pedidos"
  | "stock"
  | "ingresos"
  | "egresos"
  | "estadisticas"
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
};

type MenuItem = {
  label: string;
  page: AppPage;
  enabled: boolean;
};

const menuItems: MenuItem[] = [
  { label: "Pedidos", page: "pedidos", enabled: true },
  { label: "Stock", page: "stock", enabled: true },
  { label: "Ingresos", page: "ingresos", enabled: true },
  { label: "Egresos", page: "egresos", enabled: true },
  { label: "Estadísticas", page: "estadisticas", enabled: true },
];

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function Sidebar({
  collapsed: _collapsed,
  onToggle: _onToggle,
  activePage,
  onChangePage,
  pedidosPendientes = [],
  darkMode,
  onToggleTheme,
}: SidebarProps) {
  const [openNotifications, setOpenNotifications] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Partial<Record<AppPage, HTMLButtonElement | null>>>(
    {}
  );

  const [activePill, setActivePill] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

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
  }, [activePage]);

  function handleVerPedidos() {
    setOpenNotifications(false);
    onChangePage("pedidos");
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button
          type="button"
          className="topbar__brand-button"
          onClick={() => onChangePage("pedidos")}
          aria-label="Ir a pedidos"
          title="Ir a pedidos"
        >
          <img
            src="/logocolor.png"
            alt="Bien Criollas"
            className="topbar__brand-logo"
          />
        </button>
      </div>

      <nav ref={navRef} className="topbar__nav" aria-label="Navegación principal">
        <span
          className={`topbar__active-pill ${
            activePill.ready ? "topbar__active-pill--ready" : ""
          }`}
          style={{
            width: activePill.width,
            transform: `translateX(${activePill.left}px)`,
          }}
        />

        {menuItems.map((item) => {
          const isActive = activePage === item.page;

          return (
            <button
              key={item.page}
              ref={(node) => {
                itemRefs.current[item.page] = node;
              }}
              type="button"
              className={`topbar__item ${isActive ? "active" : ""} ${
                !item.enabled ? "topbar__item--disabled" : ""
              }`}
              onClick={() => {
                if (item.enabled) {
                  onChangePage(item.page);
                  setOpenNotifications(false);
                }
              }}
              disabled={!item.enabled}
              title={!item.enabled ? "Próximamente" : item.label}
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
            className={`topbar__icon-btn ${
              tienePendientes ? "topbar__icon-btn--active" : ""
            }`}
            type="button"
            onClick={() => setOpenNotifications((prev) => !prev)}
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
                  <div className="topbar__notifications-empty">
                    No hay pedidos pendientes.
                  </div>
                )}
              </div>

              <button
                type="button"
                className="topbar__notifications-action"
                onClick={handleVerPedidos}
              >
                Ver pedidos
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Sidebar;