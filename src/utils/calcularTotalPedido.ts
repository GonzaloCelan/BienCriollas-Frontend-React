import type { CatalogoItem } from "../services/catalogoApi";

export function calcularSubtotalVariedad(
  cantidad: number,
  precio: CatalogoItem
) {
  const cantidadValida = Math.max(Math.floor(Number(cantidad) || 0), 0);
  const docenas = Math.floor(cantidadValida / 12);
  const restoDespuesDeDocenas = cantidadValida % 12;
  const mediasDocenas = Math.floor(restoDespuesDeDocenas / 6);
  const unidades = restoDespuesDeDocenas % 6;

  return (
    docenas * precio.precioDocena +
    mediasDocenas * precio.precioMediaDocena +
    unidades * precio.precioUnitario
  );
}

export function calcularTotalPedido(
  cantidades: Record<number, number>,
  catalogo: CatalogoItem[]
) {
  return catalogo.reduce((total, precio) => {
    const cantidad = cantidades[precio.id_variedad] ?? 0;
    return total + calcularSubtotalVariedad(cantidad, precio);
  }, 0);
}
