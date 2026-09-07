import type { Pedido } from "../components/PedidosTable";

type ComandaItem = {
  nombre: string;
  cantidad: number;
};

const DIRECCION_LOCAL = "Brasil Oeste 2388";
const CEL_LOCAL = "+54 9 264 4449895";
const INSTAGRAM_LOCAL = "@biencriollas.sanjuan";
const PRINTABLE_MM = 56;
const LOGO_COMANDA_PATH = "/icons/logo_comanda_hd.png";
const EMPANADA_COMANDA_PATH = "/icons/empanada_comanda_hd.png";

function precargarLogoComanda() {
  if (typeof window === "undefined") return;

  const logo = new Image();
  logo.src = new URL(LOGO_COMANDA_PATH, window.location.origin).href;

  const empanada = new Image();
  empanada.src = new URL(EMPANADA_COMANDA_PATH, window.location.origin).href;
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
  const empanadaUrl = escapeHtml(
    new URL(EMPANADA_COMANDA_PATH, window.location.origin).href
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
  <link rel="preload" href="${empanadaUrl}" as="image" />
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

        .logo-wrap {
          text-align: center;
          height: 25mm;
          margin: 0;
          overflow: hidden;
        }
        .logo {
          width: 38mm;
          max-width: none;
          max-height: none;
          height: auto;
          object-fit: contain;
          display: inline-block;
          transform: translateY(-6.5mm);
        }

        .datos-local {
          text-align: center;
          margin: 0 0 1.8mm 0;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.15;
        }

        .datos-local .linea {
          margin: 0.2mm 0;
        }

        .separador-punteado {
          border-top: 1px dashed #000;
          margin: 0 0 1.6mm 0;
        }

        .subtitulo {
          text-align: center;
          font-size: 10.5px;
          margin: 0 0 0.8mm 0;
          font-weight: 900;
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
          box-sizing: border-box;
          padding: 1.8mm 0 1.2mm;
        }

        .total-wrap::before,
        .total-wrap::after {
          display: none;
        }

        .total-wrap .total-label {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          line-height: 1.05;
        }

        .total-wrap .total-value {
          margin-top: 0.8mm;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.2px;
          line-height: 1.05;
          white-space: nowrap;
        }

        .despedida {
          margin-top: 2.5mm;
          text-align: center;
        }

        .despedida-adorno {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2mm;
          margin-bottom: 0.8mm;
        }

        .despedida-adorno .linea {
          width: 19mm;
          border-top: 1px solid #000;
        }

        .empanada-icono-wrap {
          width: 9mm;
          height: 7mm;
          overflow: hidden;
          flex: 0 0 9mm;
        }

        .empanada-icono {
          width: 10mm;
          height: 10mm;
          display: block;
          transform: translate(-0.5mm, -1.7mm);
        }

        .gracias {
          font-family: "Parisienne", "Ephesis", cursive;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: 0.1px;
          line-height: 1;
          margin: 0;
          white-space: nowrap;
        }

        .disfrute {
          margin: 0.8mm 0 2mm;
          font-size: 10px;
          font-weight: 700;
        }

        .contacto-whatsapp,
        .instagram {
          border-top: 1px dashed #000;
          display: grid;
          grid-template-columns: 8mm 1fr;
          align-items: center;
          gap: 2mm;
          margin-top: 2mm;
          padding: 1.8mm 5mm 1.4mm;
          text-align: left;
          box-sizing: border-box;
        }

        .whatsapp-icono,
        .instagram-icono {
          width: 8mm;
          height: 8mm;
          flex: 0 0 8mm;
        }

        .contacto-pregunta {
          font-size: 9.5px;
          font-weight: 700;
          line-height: 1.05;
        }

        .contacto-accion {
          font-size: 9.5px;
          font-weight: 900;
          line-height: 1.05;
          margin-top: 0.4mm;
        }

        .contacto-numero {
          font-size: 11.5px;
          font-weight: 900;
          line-height: 1.1;
          margin-top: 0.4mm;
          white-space: nowrap;
        }

        .instagram-titulo {
          font-size: 8.5px;
          font-weight: 700;
          line-height: 1.05;
        }

        .instagram-usuario {
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
          margin-top: 0.4mm;
        }

        .instagram-bajada {
          font-size: 8px;
          font-weight: 600;
          line-height: 1.05;
          margin-top: 0.4mm;
        }

        .nota-wrap {
          margin-top: 0;
        }

        .nota-sep {
          border-top: 1px dashed #000;
          margin: 0 0 1.8mm 0;
        }

        .nota-fiscal {
          text-align: center;
          font-size: 10px;
          font-weight: 900;
          color: #000;
          letter-spacing: 0.2px;
        }
      </style>
    </head>

    <body>
      <div class="ticket">
      <div class="logo-wrap">
          <img
  class="logo print-image"
  src="${logoUrl}"
  alt="Bien Criollas"
/>
        </div>

        <div class="datos-local">
          <div class="linea">${DIRECCION_LOCAL}</div>
        </div>

        <div class="separador-punteado"></div>

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

        <div class="despedida">
          <div class="despedida-adorno">
            <span class="linea"></span>
            <span class="empanada-icono-wrap">
              <img class="empanada-icono print-image" src="${empanadaUrl}" alt="" />
            </span>
            <span class="linea"></span>
          </div>

          <p class="gracias">¡Gracias por elegirnos!</p>
          <p class="disfrute">¡Que disfrutes tu pedido!</p>
        </div>

        <div class="contacto-whatsapp">
          <svg class="whatsapp-icono" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3a12 12 0 0 0-10.3 18.2L4 28l7-1.7A12 12 0 1 0 16 3Z" fill="none" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M11.2 9.7c.4-.5.8-.5 1.1-.5h.8c.3 0 .6.1.8.7l1.1 2.6c.2.5.1.8-.2 1.2l-.8 1c-.3.3-.2.6 0 .9 1.1 1.8 2.7 3.2 4.6 4.1.4.2.7.1.9-.2l1.2-1.5c.3-.4.7-.4 1.1-.2l2.4 1.1c.5.2.8.4.8.7 0 .3-.1 1.9-1.3 3-1.1 1-2.7 1.4-4.2 1-1.5-.4-4.6-1.6-7.7-4.4-2.5-2.3-4.2-5.1-4.7-6.6-.5-1.5 0-2.3.5-2.9Z" fill="#000"/>
          </svg>
          <div>
            <div class="contacto-pregunta">¿Tu próximo pedido?</div>
            <div class="contacto-accion">Hacelo por WhatsApp</div>
            <div class="contacto-numero">${CEL_LOCAL}</div>
          </div>
        </div>

        <div class="instagram">
          <svg class="instagram-icono" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="4" width="24" height="24" rx="7" fill="none" stroke="#000" stroke-width="2.5"/>
            <circle cx="16" cy="16" r="5.5" fill="none" stroke="#000" stroke-width="2.5"/>
            <circle cx="23.5" cy="8.8" r="1.6" fill="#000"/>
          </svg>
          <div>
            <div class="instagram-titulo">Seguinos en Instagram</div>
            <div class="instagram-usuario">${INSTAGRAM_LOCAL}</div>
            <div class="instagram-bajada">Novedades, promos y más</div>
          </div>
        </div>

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
          const imagenes = Array.from(document.querySelectorAll(".print-image"));
          const fuentesListas = document.fonts?.ready ?? Promise.resolve();
          const recursosListos = Promise.all([
            ...imagenes.map(esperarImagen),
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
