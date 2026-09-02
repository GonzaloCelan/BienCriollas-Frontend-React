import type { Pedido } from "../components/PedidosTable";

type ComandaItem = {
  nombre: string;
  cantidad: number;
};

const DIRECCION_LOCAL = "Brasil Oeste 2388";
const CEL_LOCAL = "+549244449895";
const PRINTABLE_MM = 56;
const LOGO_COMANDA_PATH =
  "/icons/logo_bien_criollas_transparente_negro_fino.png";

function precargarLogoComanda() {
  if (typeof window === "undefined") return;

  const logo = new Image();
  logo.src = new URL(LOGO_COMANDA_PATH, window.location.origin).href;
}

precargarLogoComanda();

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("es-AR");
}

function getFechaActual() {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function imprimirComandaPedido(
  pedido: Pedido,
  items: ComandaItem[]
): Promise<void> {
  const numeroPedido = pedido.id;
  const cliente = escapeHtml(pedido.cliente || "Sin cliente");
  const tipoVentaLabel = escapeHtml(pedido.tipoVenta || "-");
  const tipoPagoLabel = escapeHtml(pedido.pago || "-");
  const totalPedidoFmt = formatMoney(pedido.total);
  const logoUrl = escapeHtml(
    new URL(LOGO_COMANDA_PATH, window.location.origin).href
  );

  const totalEmpanadas = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  const filasHtml = items
    .map(
      (item) => `
        <tr>
          <td class="col-var">${escapeHtml(item.nombre)}</td>
          <td class="col-cant">${item.cantidad}</td>
        </tr>
      `
    )
    .join("");

  const fechaHtml = `<div class="fecha">${getFechaActual()}</div>`;

  const horarioHtml =
    pedido.horario && pedido.horario !== "-"
      ? `<p class="pago"><strong>Horario:</strong> ${escapeHtml(
          pedido.horario
        )}</p>`
      : "";

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
  <meta charset="UTF-8" />
  <title>Comanda Pedido ${numeroPedido}</title>

  <link rel="preload" href="${logoUrl}" as="image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Ephesis&family=Parisienne&display=swap"
    rel="stylesheet"
  />

  <style>
        @page { size: 58mm auto; margin: 0; }

        body {
          margin: 0;
          padding: 0.2mm;
          width: 58mm;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 800;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .ticket { width: ${PRINTABLE_MM}mm; }

        .logo-wrap { text-align: center; margin: 0 0 1.5mm 0; }
        .logo {
          max-width: 40mm;
          max-height: 24mm;
          width: auto;
          height: auto;
          object-fit: contain;
          display: inline-block;
        }

        .titulo {
          text-align: center;
          font-weight: 950;
          font-family: "Parisienne", "Ephesis", cursive;
          margin: 0 0 1mm 0;
          font-size: 28px;
          letter-spacing: 0.2px;
        }

        .datos-local {
          text-align: center;
          margin: 0 0 1.4mm 0;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.15;
        }

        .datos-local .linea {
          margin: 0.2mm 0;
        }

        .subtitulo {
          text-align: center;
          font-size: 10.5px;
          margin: 0 0 1.2mm 0;
          font-weight: 800;
        }

        .fecha {
          text-align: center;
          margin: 0 0 2mm 0;
          font-size: 10.5px;
          font-weight: 700;
        }

        .cliente {
          margin: 0 0 1mm 0;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 900;
        }

        .pago {
          margin: 0 0 1mm 0;
          font-size: 10px;
          font-weight: 700;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th,
        td {
          padding: 1mm 0;
          vertical-align: top;
        }

        th {
          border-bottom: 1px solid #000;
          text-align: left;
        }

        .col-var {
          width: calc(100% - 14mm);
          word-break: break-word;
        }

        .col-cant {
          width: 14mm;
          text-align: right;
          white-space: nowrap;
        }

        tr.total-emp td {
          border-top: 1px solid #000;
          padding-top: 1.5mm;
          font-weight: 900;
        }

        .total-emp-label {
          font-size: 11px;
          letter-spacing: 0.2px;
        }

        .total-emp-value {
          font-size: 11px;
          font-weight: 900;
        }

        tfoot tr.total-block td {
          border-top: 2px solid #000;
          padding-top: 2mm;
        }

        .total-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
        }

        .total-wrap .total-label {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          line-height: 1.05;
        }

        .total-wrap .total-value {
          margin-top: 1.2mm;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.2px;
          line-height: 1.05;
          white-space: nowrap;
        }

        .nota-wrap {
          margin-top: 3mm;
        }

        .nota-sep {
          border-top: 1px dotted #000;
          margin: 0 0 1.5mm 0;
        }

        .nota-fiscal {
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          color: #000;
          letter-spacing: 0.2px;
        }
      </style>
    </head>

    <body>
      <div class="ticket">
      <div class="logo-wrap">
          <img
  class="logo"
  src="${logoUrl}"
  alt="Bien Criollas"
/>
        </div>
        <div class="titulo">Bien Criollas</div>

        <div class="datos-local">
          <div class="linea">${DIRECCION_LOCAL}</div>
          <div class="linea">Cel: ${CEL_LOCAL}</div>
        </div>

        <div class="subtitulo">
          Pedido #${numeroPedido} - ${tipoVentaLabel}
        </div>

        ${fechaHtml}

        <p class="cliente"><strong>Cliente:</strong> ${cliente}</p>
        <p class="pago"><strong>Pago:</strong> ${tipoPagoLabel}</p>
        ${horarioHtml}

        <table>
          <thead>
            <tr>
              <th class="col-var">Variedad</th>
              <th class="col-cant">Cant.</th>
            </tr>
          </thead>

          <tbody>
            ${filasHtml}

            <tr class="total-emp">
              <td class="col-var total-emp-label">Cant. total</td>
              <td class="col-cant total-emp-value">${totalEmpanadas}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="total-block">
              <td colspan="2">
                <div class="total-wrap">
                  <div class="total-label">TOTAL</div>
                  <div class="total-value">$${totalPedidoFmt}</div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="nota-wrap">
          <div class="nota-sep"></div>
          <div class="nota-fiscal">NO VÁLIDO COMO FACTURA</div>
        </div>
      </div>

      <script>
        async function esperarImagen(imagen) {
          if (!imagen) return;

          if (imagen.complete && imagen.naturalWidth > 0) {
            if (typeof imagen.decode === "function") {
              await imagen.decode().catch(() => undefined);
            }
            return;
          }

          await new Promise((resolve) => {
            imagen.addEventListener("load", resolve, { once: true });
            imagen.addEventListener("error", resolve, { once: true });
          });

          if (typeof imagen.decode === "function") {
            await imagen.decode().catch(() => undefined);
          }
        }

        async function imprimirCuandoEsteLista() {
          const logo = document.querySelector(".logo");
          const fuentesListas = document.fonts?.ready ?? Promise.resolve();
          const recursosListos = Promise.all([
            esperarImagen(logo),
            fuentesListas,
          ]);
          const tiempoMaximo = new Promise((resolve) =>
            setTimeout(resolve, 3000)
          );

          await Promise.race([recursosListos, tiempoMaximo]);
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          );

          window.print();
          window.setTimeout(() => window.close(), 250);
        }

        window.addEventListener("load", imprimirCuandoEsteLista, {
          once: true,
        });
      </script>
    </body>
  </html>
  `;

  const printWindow = window.open("", "_blank", "width=380,height=700");

  if (!printWindow) {
    alert("El navegador bloqueó la ventana de impresión.");
    return Promise.resolve();
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  return new Promise((resolve) => {
    const closedCheck = window.setInterval(() => {
      if (!printWindow.closed) return;

      window.clearInterval(closedCheck);
      window.clearTimeout(safetyTimeout);
      resolve();
    }, 150);

    const safetyTimeout = window.setTimeout(() => {
      window.clearInterval(closedCheck);
      resolve();
    }, 10 * 60 * 1000);
  });
}
