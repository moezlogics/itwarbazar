export default function medusaError(error: any): never {
  // Medusa JS SDK throws FetchError: { message, status, statusText }
  // Legacy axios-style errors have .response / .request.
  if (error?.response) {
    const u = new URL(error.config.url, error.config.baseURL)
    console.error("Resource:", u.toString())
    console.error("Response data:", error.response.data)
    console.error("Status code:", error.response.status)

    const raw = error.response.data?.message || error.response.data
    const message = typeof raw === "string" ? raw : JSON.stringify(raw)
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  }

  if (error?.request && !error?.message) {
    throw new Error("No response received from the server. Please try again.")
  }

  // FetchError / plain Error — surface the API message cleanly
  const msg =
    (typeof error?.message === "string" && error.message) ||
    (typeof error === "string" && error) ||
    "Something went wrong while contacting the store."

  // Strip the old confusing prefix if it somehow got double-wrapped
  const clean = msg.replace(/^Error setting up the request:\s*/i, "")
  throw new Error(clean.charAt(0).toUpperCase() + clean.slice(1))
}
