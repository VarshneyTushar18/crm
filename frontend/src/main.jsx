// src/main.jsx
import axios from "axios";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppRouter from "./router/AppRouter";

// ✅ Redux Provider (required for Idurar modules like DashboardModule)
import { Provider } from "react-redux";
import store from "./redux/store"; // 🔁 if this path doesn't exist, see note below

// ✅ Idurar AppContext (required for NavigationContainer)
import { AppContextProvider } from "@/context/appContext";

// ✅ JobContext for Jobs/Kanban/Planning flow
import { JobProvider } from "@/context/JobContext";

// ✅ Customer portal auth
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";

import "antd/dist/reset.css";
import "./style/app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AppContextProvider>
          <JobProvider>
            <CustomerAuthProvider>
              <AppRouter />
            </CustomerAuthProvider>
          </JobProvider>
        </AppContextProvider>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>
);

axios.interceptors.request.use((config) => {
  let token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

  if (!token) {
    try {
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      token = auth?.current?.token || auth?.token || null;
    } catch {
      token = null;
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});