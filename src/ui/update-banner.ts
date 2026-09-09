export interface UpdateBannerHandle {
  el: HTMLElement;
  show(): void;
  hide(): void;
}

/**
 * Small non-blocking banner announcing a new app version.
 * Styled to match the HUD (thick border, rounded corners, cozy palette).
 * The caller owns the update action: onUpdate is invoked when the child taps
 * the Update button.
 */
export function createUpdateBanner(
  container: HTMLElement,
  onUpdate: () => void,
): UpdateBannerHandle {
  const el = document.createElement("div");
  el.dataset.testid = "update-banner";
  el.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:30",
    "display:none",
    "align-items:center",
    "gap:10px",
    "padding:10px 14px",
    "background:#f8f3e9",
    "border:3px solid #2c3e50",
    "border-radius:14px",
    "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
    "font-size:18px",
    "font-weight:700",
    "color:#2c3e50",
    "touch-action:manipulation",
  ].join(";");

  const label = document.createElement("span");
  label.textContent = "New version ready — Update";

  const updateBtn = document.createElement("button");
  updateBtn.textContent = "Update";
  updateBtn.style.cssText = [
    "padding:8px 16px",
    "font-size:18px",
    "font-weight:800",
    "background:#06d6a0",
    "color:#fff",
    "border:3px solid #2c3e50",
    "border-radius:12px",
    "touch-action:manipulation",
  ].join(";");
  updateBtn.addEventListener("click", onUpdate);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Dismiss update banner");
  closeBtn.style.cssText = [
    "width:36px",
    "height:36px",
    "font-size:16px",
    "font-weight:800",
    "background:#ef476f",
    "color:#fff",
    "border:3px solid #2c3e50",
    "border-radius:12px",
    "touch-action:manipulation",
  ].join(";");
  closeBtn.addEventListener("click", () => hide());

  el.append(label, updateBtn, closeBtn);
  container.appendChild(el);

  function hide(): void {
    el.style.display = "none";
  }

  return {
    el,
    show() {
      el.style.display = "flex";
    },
    hide,
  };
}
