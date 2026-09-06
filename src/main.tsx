import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import "./index.css";
import Arcade from "./Arcade.tsx";
import { reportCrash } from "./platform/telemetry";

// Vercel Web Analytics: page views + web vitals on the deployed site.
inject();

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
