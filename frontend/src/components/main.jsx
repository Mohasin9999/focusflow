import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "../index.css";
import logo from "../assets/logo.png";

const setFavicon = () => {
  const versionedHref = `${logo}?v=${Date.now()}`;
  const iconRelValues = ["icon", "shortcut icon", "apple-touch-icon"];

  iconRelValues.forEach((rel) => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", rel);
      document.head.appendChild(link);
    }
    link.setAttribute("href", versionedHref);
    link.setAttribute("type", "image/png");
  });
};

setFavicon();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

