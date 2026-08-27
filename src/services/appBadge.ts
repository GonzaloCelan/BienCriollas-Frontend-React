type NavigatorConBadge = Navigator & {
  setAppBadge?: (cantidad?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function obtenerNavigatorConBadge() {
  return navigator as NavigatorConBadge;
}

export async function actualizarBadgePedidosPendientes(cantidad: number) {
  const badgeNavigator = obtenerNavigatorConBadge();

  try {
    if (cantidad > 0 && badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(cantidad);
      return;
    }

    if (badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge();
    } else if (badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(0);
    }
  } catch {
    // Algunos navegadores exponen la API aunque la app no esté instalada.
  }
}

export async function limpiarBadgePedidos() {
  const badgeNavigator = obtenerNavigatorConBadge();

  try {
    if (badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge();
    } else if (badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(0);
    }
  } catch {
    // No interrumpimos la aplicación si el sistema operativo no admite badges.
  }
}
