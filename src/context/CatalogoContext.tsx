import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import {
  actualizarPreciosCatalogoApi,
  obtenerCatalogoApi,
  type ActualizarPreciosCatalogoPayload,
  type CatalogoItem,
} from "../services/catalogoApi";

type CatalogoContextValue = {
  catalogo: CatalogoItem[];
  catalogoLoading: boolean;
  catalogoError: string;
  actualizarPreciosCatalogo: (
    idVariedad: number,
    precios: ActualizarPreciosCatalogoPayload
  ) => Promise<void>;
};

const CatalogoContext = createContext<CatalogoContextValue | null>(null);

export function CatalogoProvider({ children }: PropsWithChildren) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(true);
  const [catalogoError, setCatalogoError] = useState("");

  useEffect(() => {
    let mounted = true;

    obtenerCatalogoApi()
      .then((data) => {
        if (!mounted) return;
        setCatalogo(data);
        setCatalogoError("");
      })
      .catch((error) => {
        console.error("No se pudo cargar el catálogo.", error);
        if (!mounted) return;
        setCatalogo([]);
        setCatalogoError("No se pudo cargar el catálogo de precios.");
      })
      .finally(() => {
        if (mounted) setCatalogoLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function actualizarPreciosCatalogo(
    idVariedad: number,
    precios: ActualizarPreciosCatalogoPayload
  ) {
    await actualizarPreciosCatalogoApi(idVariedad, precios);

    setCatalogo((actual) =>
      actual.map((item) =>
        item.id_variedad === idVariedad ? { ...item, ...precios } : item
      )
    );
  }

  return (
    <CatalogoContext.Provider
      value={{
        catalogo,
        catalogoLoading,
        catalogoError,
        actualizarPreciosCatalogo,
      }}
    >
      {children}
    </CatalogoContext.Provider>
  );
}

export function useCatalogo() {
  const context = useContext(CatalogoContext);

  if (!context) {
    throw new Error("useCatalogo debe usarse dentro de CatalogoProvider.");
  }

  return context;
}
