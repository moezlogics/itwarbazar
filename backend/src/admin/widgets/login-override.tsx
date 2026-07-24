import { defineWidgetConfig } from "@medusajs/admin-sdk";

/**
 * Login-page branding override.
 *
 * The Medusa dashboard is a prebuilt package — its login screen (logo +
 * "Welcome to Medusa") isn't configurable through any supported option.
 * Two layers fix that:
 *   1. This widget (zone "login.before"): hides the Medusa logo via CSS,
 *      prints the store name in its place, and live-rewrites any
 *      remaining "Medusa" text nodes.
 *   2. patch-admin-branding.js (runs after `medusa build`): rewrites the
 *      compiled dashboard bundle in .medusa/server/public/admin so the
 *      strings are OUR brand at the source. This widget stays as a
 *      safety net for strings the patcher doesn't cover.
 *
 * Brand name is inlined at build time — keep in sync with
 * ADMIN_BRAND_NAME in the backend .env (used by the patcher).
 */
const BRAND_NAME = "Itwar Bazar";

const LoginOverrideWidget = () => {
  return (
    <div className="login-override" style={{ display: "none" }}>
      <style>{`
        /* Hide Medusa logo on login page */
        div.flex.w-full.items-center.justify-center.mb-8 > svg {
          display: none !important;
        }
        /* Replace Medusa logo area with the store name */
        div.flex.w-full.items-center.justify-center.mb-8::after {
          content: "${BRAND_NAME}";
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          display: block;
        }
      `}</style>
      <script dangerouslySetInnerHTML={{
        __html: `
          setTimeout(() => {
            const walkDOM = (node) => {
              if (node.nodeType === 3) {
                if (node.nodeValue.includes('Medusa')) {
                  node.nodeValue = node.nodeValue.replace(/Medusa/g, ${JSON.stringify(
                    BRAND_NAME
                  )});
                }
              } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                for (let i = 0; i < node.childNodes.length; i++) {
                  walkDOM(node.childNodes[i]);
                }
              }
            };
            walkDOM(document.body);
            // Catch dynamically rendered "Medusa" text too
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                  walkDOM(node);
                });
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          }, 100);
        `
      }} />
    </div>
  );
};

export const config = defineWidgetConfig({
  zone: "login.before",
});

export default LoginOverrideWidget;
