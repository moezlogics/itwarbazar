import { createContext, useContext, useEffect, useState } from "react"
import { getPublicSiteSettings, getSiteSettings, getToken } from "./api"
import { STORE_LABEL } from "./config"

type Settings = Record<string, string>

type Ctx = {
  name: string
  logo?: string
  settings: Settings
  reload: () => void
}

const SettingsContext = createContext<Ctx>({
  name: STORE_LABEL,
  settings: {},
  reload: () => {},
})

function applyTheme(s: Settings) {
  // Admin app remains strictly in the premium dark obsidian mode.
  // We ignore storefront color themes to prevent light-mode overrides.
}

function applyBranding(s: Settings) {
  const name = s?.site_name || STORE_LABEL
  document.title = `${name} · Orders`

  const iconUrl = s?.site_favicon_url || s?.site_logo_url
  if (!iconUrl) return

  const ensureLink = (selector: string, rel: string) => {
    let el = document.head.querySelector(selector) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement("link")
      el.rel = rel
      document.head.appendChild(el)
    }
    el.href = iconUrl
  }

  ensureLink('link[rel="icon"]', "icon")
  ensureLink('link[rel="apple-touch-icon"]', "apple-touch-icon")
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({})

  const reload = () => {
    const loader = getToken() ? getSiteSettings : getPublicSiteSettings
    loader()
      .then(({ settings }) => {
        setSettings(settings || {})
        applyTheme(settings || {})
        applyBranding(settings || {})
      })
      .catch(() => {
        /* keep defaults */
      })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const name = settings.site_name || STORE_LABEL
  const logo = settings.site_logo_url || undefined

  return (
    <SettingsContext.Provider value={{ name, logo, settings, reload }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
