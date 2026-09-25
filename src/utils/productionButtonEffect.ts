const ACTION_BUTTONS = [
  ".ingredients-primary",
  ".ingredient-secondary",
  ".recipes-primary",
  ".recipe-secondary",
  ".recipe-detail-actions button",
  ".recipe-editor__stage-action",
  ".sp-button",
  ".rp-primary",
  ".rp-secondary",
  ".rp-save",
  ".rp-detail-actions button",
  ".analytics-hero__actions button",
  ".analytics-filter-card form button",
  ".analytics-settings footer button",
  ".analytics-cost-warning button",
].join(",");

function pulseColor(background: string, darkMode: boolean): string {
  const channels = background.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3 || channels[3] === 0) {
    return darkMode ? "#aebaca" : "#8896a8";
  }

  const brightness = channels[0] * .299 + channels[1] * .587 + channels[2] * .114;
  if (brightness > 205) return darkMode ? "#aebaca" : "#8896a8";
  if (brightness < 70) return "#aebaca";
  return background;
}

export function installProductionButtonEffect(): () => void {
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>(ACTION_BUTTONS);
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;

    const bounds = button.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const computed = getComputedStyle(button);
    const pulse = document.createElement("span");
    pulse.className = "production-button-pulse";
    pulse.style.left = `${bounds.left}px`;
    pulse.style.top = `${bounds.top}px`;
    pulse.style.width = `${bounds.width}px`;
    pulse.style.height = `${bounds.height}px`;
    pulse.style.setProperty("--pulse-color", pulseColor(computed.backgroundColor, document.body.classList.contains("dark-mode")));
    pulse.style.setProperty("--pulse-radius", computed.borderRadius);
    pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
    document.body.append(pulse);
    window.setTimeout(() => pulse.remove(), 800);
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
