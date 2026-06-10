import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Pedidos from "../pages/Pedidos";
import NuevoPedido from "../pages/NuevoPedido";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/pedidos" replace />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/pedidos/nuevo" element={<NuevoPedido />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;