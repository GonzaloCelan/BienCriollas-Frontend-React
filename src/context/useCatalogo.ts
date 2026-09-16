import { useContext } from "react";

import { CatalogoContext } from "./catalogoContextBase";

export function useCatalogo() {
  const context = useContext(CatalogoContext);

  if (!context) {
    throw new Error("useCatalogo debe usarse dentro de CatalogoProvider.");
  }

  return context;
}
