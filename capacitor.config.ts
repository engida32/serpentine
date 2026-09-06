import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.serpentine.arcade",
  appName: "Serpentine Arcade",
  webDir: "dist",
  backgroundColor: "#06110c",
  android: {
    allowMixedContent: false,
  },
};

export default config;