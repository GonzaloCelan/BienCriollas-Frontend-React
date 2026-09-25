import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import Pedidos from "../pages/Pedidos";
import NuevoPedido from "../pages/NuevoPedido";
import Stock from "../pages/Stock";

function PedidosRoute() {
  const navigate = useNavigate();
  return <Pedidos onNavigateToStock={() => navigate("/stock")} />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/pedidos" replace />} />
        <Route path="/pedidos" element={<PedidosRoute />} />
        <Route path="/pedidos/nuevo" element={<NuevoPedido />} />
        <Route path="/stock" element={<Stock />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
