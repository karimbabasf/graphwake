import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Graphwake",
    short_name: "Graphwake",
    description:
      "A local-first studio for replayable context, memory, and evidence graphs.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef7f3",
    theme_color: "#dcebe5",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
