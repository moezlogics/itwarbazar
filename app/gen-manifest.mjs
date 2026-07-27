import { writeFileSync, readFileSync, existsSync } from "node:fs"

function readBackendUrl() {
  if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL.trim().replace(/\/+$/, "")
  for (const f of [".env.production", ".env"]) {
    if (existsSync(f)) {
      const m = readFileSync(f, "utf8").match(/^\s*VITE_BACKEND_URL\s*=\s*(.+)\s*$/m)
      if (m) return m[1].replace(/^["']|["']$/g, "").trim().replace(/\/+$/, "")
    }
  }
  return "https://api.itwarbazar.pk"
}

function readLabel() {
  if (process.env.VITE_STORE_LABEL) return process.env.VITE_STORE_LABEL.trim()
  for (const f of [".env.production", ".env"]) {
    if (existsSync(f)) {
      const m = readFileSync(f, "utf8").match(/^\s*VITE_STORE_LABEL\s*=\s*(.+)\s*$/m)
      if (m) return m[1].replace(/^["']|["']$/g, "").trim()
    }
  }
  return "Orders Admin"
}

async function fetchPublicBranding() {
  try {
    const backend = readBackendUrl()
    const res = await fetch(`${backend}/store/site-settings`)
    const data = await res.json().catch(() => ({}))
    return data?.settings || {}
  } catch {
    return {}
  }
}

const settings = await fetchPublicBranding()
const name = settings.site_name?.trim() || readLabel()
const iconUrl = settings.site_favicon_url?.trim() || settings.site_logo_url?.trim() || ""

const icons = iconUrl
  ? [
      { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]
  : [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]

const manifest = {
  name,
  short_name: name.length > 12 ? name.slice(0, 12) : name,
  description: "View orders, change status, and get instant alerts on new orders.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "fullscreen", "minimal-ui"],
  orientation: "portrait",
  background_color: "#09090b",
  theme_color: "#09090b",
  icons,
}

writeFileSync("public/manifest.webmanifest", JSON.stringify(manifest, null, 2) + "\n")
console.log(`[gen-manifest] app name = "${name}"`)
