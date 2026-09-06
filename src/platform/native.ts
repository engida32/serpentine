import { Capacitor } from "@capacitor/core";
import { routeBack } from "../ui/input";

/** True inside the Capacitor Android (TV) shell; false in any browser / PWA. */
export const isNative = Capacitor.isNativePlatform();

/**
 * Wire the Android hardware / remote Back button into the shared back stack.
 * When nothing consumes the press we are on the hub, so leave the app the way
 * every other TV app does. Chrome-based browsers never reach this: there the
 * Back button is a history navigation and Arcade handles it via `popstate`.
 */
export async function installNativeBack(): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import("@capacitor/app");
  const sub = await App.addListener("backButton", () => {
    if (!routeBack()) void App.exitApp();
  });
  return () => {
    void sub.remove();
  };
}
