import "@fontsource-variable/space-grotesk/wght.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        style: {
          background: "rgba(10, 14, 28, 0.92)",
          color: "#f8fafc",
          border: "1px solid rgba(94, 234, 212, 0.18)"
        }
      }}
    />
  </StrictMode>
);
