import { createContext } from "react";

import type {
  ActualizarPreciosCatalogoPayload,
  CatalogoItem,
} from "../services/catalogoApi";

export type CatalogoContextValue = {
  catalogo: CatalogoItem[];
  catalogoLoading: boolean;
  catalogoError: string;
  catalogoUsandoRespaldo: boolean;
  recargarCatalogo: () => Promise<boolean>;
  actualizarPreciosCatalogo: (
    idVariedad: number,
    precios: ActualizarPreciosCatalogoPayload
  ) => Promise<void>;
};

export const CatalogoContext = createContext<CatalogoContextValue | null>(null);
