// Backend base URL for THIS install. Override at build with
// VITE_BACKEND_URL (e.g. for a different store / site).
export const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || "https://api.itwarbazar.pk"
).replace(/\/+$/, "")

export const STORE_LABEL = import.meta.env.VITE_STORE_LABEL || "Itwar Bazar"
