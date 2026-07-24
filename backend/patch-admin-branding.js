/**
 * Post-build admin branding patcher.
 *
 * WHY: the Medusa admin dashboard ships as a prebuilt package
 * (@medusajs/dashboard) — `medusa build` compiles it into
 * .medusa/server/public/admin and there is NO supported config to change
 * its branding (login "Welcome to Medusa", the tab title, etc.). Editing
 * node_modules gets wiped on every install, and admin "extensions" can
 * only inject widgets around the core UI — they can't edit its strings.
 *
 * So we patch the BUILT OUTPUT instead: run this right after
 * `medusa build` (wired into the npm build script) and the final admin
 * bundle in .medusa/server/public/admin carries our brand — exactly the
 * "hamara code build ke andar ho" requirement.
 *
 * SAFE by design: only exact, user-visible phrases are replaced.
 * We never blanket-replace "Medusa" inside JS code (identifiers,
 * URLs and package paths contain it and would break the app).
 *
 * Brand name: ADMIN_BRAND_NAME in .env, falling back to "Itwar Bazar".
 */
const fs = require("fs")
const path = require("path")

// Minimal .env reader (no dependency on dotenv being present)
function readEnvBrand() {
  try {
    const env = fs.readFileSync(path.join(__dirname, ".env"), "utf8")
    const m = env.match(/^ADMIN_BRAND_NAME=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, "")
  } catch {}
  return "Itwar Bazar"
}

const BRAND = readEnvBrand()
const ADMIN_DIR = path.join(__dirname, ".medusa", "server", "public", "admin")

// Exact user-visible strings from @medusajs/dashboard's i18n / html.
// Order matters: longer phrases first so shorter ones don't clobber them.
const REPLACEMENTS = [
  ["Welcome to Medusa", `Welcome to ${BRAND}`],
  ["Medusa Admin", `${BRAND} Admin`],
]

// index.html <title> gets the brand outright.
const TITLE_RE = /<title>[^<]*<\/title>/i

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function run() {
  if (!fs.existsSync(ADMIN_DIR)) {
    console.log(`[admin-branding] ${ADMIN_DIR} not found — did medusa build run?`)
    process.exit(0) // don't fail the build pipeline
  }

  let totalHits = 0
  const files = walk(ADMIN_DIR).filter((f) => /\.(js|html)$/.test(f))

  for (const file of files) {
    let src = fs.readFileSync(file, "utf8")
    let hits = 0

    for (const [from, to] of REPLACEMENTS) {
      if (src.includes(from)) {
        const count = src.split(from).length - 1
        src = src.split(from).join(to)
        hits += count
      }
    }

    if (file.endsWith(".html") && TITLE_RE.test(src)) {
      src = src.replace(TITLE_RE, `<title>${BRAND} Admin</title>`)
      hits += 1
    }

    if (hits > 0) {
      fs.writeFileSync(file, src)
      console.log(
        `[admin-branding] ${path.relative(ADMIN_DIR, file)}: ${hits} replacement(s)`
      )
      totalHits += hits
    }
  }

  console.log(
    totalHits > 0
      ? `[admin-branding] Done — branded as "${BRAND}" (${totalHits} replacements).`
      : `[admin-branding] Nothing to replace (already branded or strings moved).`
  )
}

run()
