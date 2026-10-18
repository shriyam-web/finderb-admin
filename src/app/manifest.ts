import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinderB Admin",
    short_name: "FinderB Admin",
    description: "FinderB admin dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#c2410c",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
