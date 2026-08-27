import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./styles/global.css";

import { registerSW } from "virtual:pwa-register";

if ("serviceWorker" in navigator) {
  let actualizandoAplicacion = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (actualizandoAplicacion) return;

    actualizandoAplicacion = true;
    window.location.reload();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_serviceWorkerUrl, registration) {
    if (!registration) return;

    window.setInterval(() => {
      void registration.update();
    }, 15 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
