import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
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
  catalogoUsandoRespaldo: boolean;
  recargarCatalogo: () => Promise<boolean>;
  actualizarPreciosCatalogo: (
    idVariedad: number,
    precios: ActualizarPreciosCatalogoPayload
  ) => Promise<void>;
};

const CatalogoContext = createContext<CatalogoContextValue | null>(null);

const CATALOGO_CACHE_KEY = "bien-criollas-catalogo-v1";
const RETRY_DELAYS = [0, 1500, 4000];

type CatalogoCache = {
  catalogo: CatalogoItem[];
  guardadoEn: string;
};

function normalizarCatalogoGuardado(data: unknown): CatalogoItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => item as Partial<CatalogoItem>)
    .filter(
      (item) =>
        Number.isFinite(Number(item.id_variedad)) &&
        typeof item.nombre === "string" &&
        Number.isFinite(Number(item.precioUnitario)) &&
        Number.isFinite(Number(item.precioMediaDocena)) &&
        Number.isFinite(Number(item.precioDocena))
    )
    .map((item) => ({
      id_variedad: Number(item.id_variedad),
      nombre: String(item.nombre),
      precioUnitario: Number(item.precioUnitario),
      precioMediaDocena: Number(item.precioMediaDocena),
      precioDocena: Number(item.precioDocena),
      activo: Number(item.activo ?? 1),
    }))
    .filter((item) => item.activo === 1);
}

function leerCatalogoGuardado() {
  try {
    const raw = localStorage.getItem(CATALOGO_CACHE_KEY);
    if (!raw) return [];

    const cache = JSON.parse(raw) as Partial<CatalogoCache>;
    return normalizarCatalogoGuardado(cache.catalogo);
  } catch (error) {
    console.warn("No se pudo leer el catálogo guardado.", error);
    return [];
  }
}

function guardarCatalogo(catalogo: CatalogoItem[]) {
  try {
    const cache: CatalogoCache = {
      catalogo,
      guardadoEn: new Date().toISOString(),
    };
    localStorage.setItem(CATALOGO_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("No se pudo guardar el catálogo localmente.", error);
  }
}

function esperar(delay: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export function CatalogoProvider({ children }: PropsWithChildren) {
  const [catalogoInicial] = useState<CatalogoItem[]>(leerCatalogoGuardado);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>(catalogoInicial);
  const [catalogoLoading, setCatalogoLoading] = useState(
    catalogoInicial.length === 0
  );
  const [catalogoError, setCatalogoError] = useState("");
  const [catalogoUsandoRespaldo, setCatalogoUsandoRespaldo] = useState(
    catalogoInicial.length > 0
  );
  const catalogoRef = useRef(catalogoInicial);
  const mountedRef = useRef(true);
  const requestRef = useRef<Promise<boolean> | null>(null);
  const necesitaReintentoRef = useRef(false);

  const recargarCatalogo = useCallback(async () => {
    if (requestRef.current) return requestRef.current;

    const request = (async () => {
      if (mountedRef.current) setCatalogoLoading(true);
      let ultimoError: unknown = null;

      for (let index = 0; index < RETRY_DELAYS.length; index += 1) {
        const delay = RETRY_DELAYS[index];
        if (delay > 0) await esperar(delay);

        try {
          const data = await obtenerCatalogoApi({ force: true });
          if (data.length === 0) {
            throw new Error("El catálogo no contiene variedades activas.");
          }

          catalogoRef.current = data;
          guardarCatalogo(data);
          necesitaReintentoRef.current = false;

          if (mountedRef.current) {
            setCatalogo(data);
            setCatalogoError("");
            setCatalogoUsandoRespaldo(false);
          }

          return true;
        } catch (error) {
          ultimoError = error;
          console.warn(
            `Falló la carga del catálogo. Intento ${index + 1}/${RETRY_DELAYS.length}.`,
            error
          );
        }
      }

      necesitaReintentoRef.current = true;
      const tieneRespaldo = catalogoRef.current.length > 0;

      if (mountedRef.current) {
        setCatalogoError(
          tieneRespaldo
            ? "No se pudieron actualizar los precios. Se está usando el último catálogo guardado."
            : "No se pudo cargar el catálogo de precios."
        );
        setCatalogoUsandoRespaldo(tieneRespaldo);
      }

      console.error("No se pudo cargar el catálogo.", ultimoError);
      return false;
    })();

    requestRef.current = request;

    try {
      return await request;
    } finally {
      if (requestRef.current === request) requestRef.current = null;
      if (mountedRef.current) setCatalogoLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void recargarCatalogo();

    function reintentarAlVolverInternet() {
      if (necesitaReintentoRef.current) void recargarCatalogo();
    }

    const interval = window.setInterval(() => {
      if (necesitaReintentoRef.current && navigator.onLine) {
        void recargarCatalogo();
      }
    }, 30000);

    window.addEventListener("online", reintentarAlVolverInternet);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("online", reintentarAlVolverInternet);
    };
  }, [recargarCatalogo]);

  async function actualizarPreciosCatalogo(
    idVariedad: number,
    precios: ActualizarPreciosCatalogoPayload
  ) {
    await actualizarPreciosCatalogoApi(idVariedad, precios);

    setCatalogo((actual) => {
      const actualizado = actual.map((item) =>
        item.id_variedad === idVariedad ? { ...item, ...precios } : item
      );
      catalogoRef.current = actualizado;
      guardarCatalogo(actualizado);
      return actualizado;
    });
  }

  return (
    <CatalogoContext.Provider
      value={{
        catalogo,
        catalogoLoading,
        catalogoError,
        catalogoUsandoRespaldo,
        recargarCatalogo,
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
