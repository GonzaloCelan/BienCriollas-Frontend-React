import { Player } from "@lottiefiles/react-lottie-player";

import loadingOrdersAnimation from "../assets/lotties/loader.json";

import "../styles/ordersStates.css";

function OrdersLoadingState() {
  return (
    <div className="orders-state orders-state--loading">
      <div className="orders-state__animation orders-state__animation--loading">
        <Player
          autoplay
          loop
          src={loadingOrdersAnimation}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <h3>Cargando pedidos...</h3>
      <p>Estamos actualizando la información de la tabla.</p>
    </div>
  );
}

export default OrdersLoadingState;