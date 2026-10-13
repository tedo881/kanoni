import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "საეკლესიო სამართალი",
    short_name: "საეკლ. სამართალი",
    description: "მართლმადიდებელი ეკლესიის კანონები და AI ასისტენტი",
    start_url: "/",
    id: "/",
    lang: "ka",
    display: "standalone",
    background_color: "#0c1260",
    theme_color: "#3f51b5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}