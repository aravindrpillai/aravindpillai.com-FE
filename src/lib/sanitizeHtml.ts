import DOMPurify from "dompurify";

/**
 * Sanitizer for textbox HTML. Content is decrypted from the server and anyone
 * who knows a box code can write to it, so it's treated as untrusted:
 *  - no scripts, event handlers, forms, frames, SVG/MathML or <style>
 *  - images only as inline data: URIs (no remote loads -> no IP/read tracking)
 *  - links only http(s)/mailto/tel, opened safely in a new tab
 *  - inline styles kept for formatting, minus anything that loads or overlays
 */
const purifier = DOMPurify(window);

const IMG_SRC = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const LINK_HREF = /^(?:https?:|mailto:|tel:)/i;
const UNSAFE_CSS = /url\s*\(|expression\s*\(|@import|position\s*:|behavior\s*:|-moz-binding/i;

purifier.addHook("afterSanitizeAttributes", (node) => {
  const el = node as Element;
  if (el.tagName === "IMG") {
    const src = el.getAttribute("src") || "";
    if (!IMG_SRC.test(src)) el.remove();
    return;
  }
  if (el.tagName === "A") {
    const href = el.getAttribute("href") || "";
    if (!LINK_HREF.test(href)) el.removeAttribute("href");
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer nofollow");
  }
  const style = el.getAttribute?.("style");
  if (style && UNSAFE_CSS.test(style)) el.removeAttribute("style");
});

export function sanitizeHtml(html: string): string {
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe", "frame", "object", "embed", "video", "audio", "source", "link", "meta", "base"],
    FORBID_ATTR: ["srcset", "id", "name", "class"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  }) as string;
}
