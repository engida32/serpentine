import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import "./index.css";
import Arcade from "./Arcade.tsx";
import { reportCrash } from "./platform/telemetry";

// Vercel Web Analytics: page views + web vitals. The injected script is served
// by Vercel, so the GitHub Pages mirror would request a 404; gating on the host
// keeps the mirror console clean.
if (window.location.hostname.endsWith(".vercel.app")) inject();

// Uncaught errors / rejections that escape React land as app-level crash events.
window.addEventListener("error", (e) => reportCrash("page", e.message, `${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) =>
  reportCrash("page", "unhandledrejection", String(e.reason).slice(0, 200)),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Arcade />
  </StrictMode>,
);
