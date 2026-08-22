import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CatalogoProvider } from "./context/CatalogoContext";

import "./styles/global.css";

import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CatalogoProvider>
      <App />
    </CatalogoProvider>
  </React.StrictMode>
);
