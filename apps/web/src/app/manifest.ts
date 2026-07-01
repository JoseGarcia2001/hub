import type { MetadataRoute } from "next";

// PWA instalable. Íconos full-bleed latón (sirven de maskable en Android).
// theme/background en `ink` (dark-first). Ver apps/web/src/components/ui/AGENTS.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hub personal",
    short_name: "Hub",
    description: "Todo lo tuyo, en un solo lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#16130e",
    theme_color: "#16130e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
