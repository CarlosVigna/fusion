window.global = window;

// Aplica o tema salvo ANTES do primeiro paint, pra nao "flashar" o
// tema escuro padrao por uma fracao de segundo antes do React montar
// e buscar a preferencia real no backend.
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("fusion_theme") || "dark"
);

import React from "react";

import ReactDOM from "react-dom/client";

import {
  BrowserRouter,
} from "react-router-dom";

import { Toaster }
from "react-hot-toast";

import App from "./App";

import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")
).render(

  <React.StrictMode>

    <BrowserRouter>

      <App />

      <Toaster
        position="top-right"

        toastOptions={{

          duration: 5000,

          style: {

            background:
              "#18181b",

            color:
              "#ffffff",

            border:
              "1px solid #27272a",

            borderRadius:
              "16px",

            padding:
              "16px",

          },

        }}
      />

    </BrowserRouter>

  </React.StrictMode>

);