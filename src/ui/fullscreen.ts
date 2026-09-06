import { useCallback, useEffect, useState } from "react";

export function useFullscreen() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void (document.documentElement.requestFullscreen?.() ?? Promise.reject()).catch(() => undefined);
    }
  }, []);

  return { isFs, toggle };
}