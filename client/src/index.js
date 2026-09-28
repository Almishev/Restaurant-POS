import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import "./utils/axiosSetup";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import store from "./redux/store";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);

// PWA SW only in production. In CRA/webpack-dev it caches JS/CSS and causes
// endless reload loops (address bar stuck on Stop/X).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register(`${process.env.PUBLIC_URL || ""}/sw.js`)
        .catch(() => undefined);
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if (window.caches?.keys) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
  });
}

reportWebVitals();
