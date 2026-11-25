// A quick "are you human" check with Cloudflare Turnstile, shown only when the
// server asks for it (the public demo). The server then remembers the visitor
// for a while, so the check doesn't repeat on every question.

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      remove(widgetId: string): void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let siteKey: string | null = null;
let scriptPromise: Promise<void> | null = null;
let pending: Promise<void> | null = null;

/** Set from /api/meta. Null when the server doesn't use the check. */
export function setHumanCheckKey(key: string | null | undefined): void {
  siteKey = key ?? null;
}

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("The human check couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function dialog(): { root: HTMLElement; widget: HTMLElement; message: HTMLElement; close: HTMLButtonElement } {
  const root = document.createElement("div");
  root.className = "fixed inset-0 z-[80] flex items-center justify-center bg-night-950/70 p-4 backdrop-blur-sm";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "human-check-title");
  root.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl border border-line/10 bg-night-900 p-6 text-ink-200 shadow-2xl">
      <h2 id="human-check-title" class="font-display text-lg font-semibold text-ink-100">Quick check</h2>
      <p class="mt-1 text-sm text-ink-400">Confirm you're human to ask questions. It keeps this free demo running.</p>
      <div data-widget class="mt-4 flex min-h-[65px] justify-center"></div>
      <p data-message class="mt-3 min-h-5 text-sm text-ink-400" aria-live="polite"></p>
      <div class="mt-2 flex justify-end">
        <button type="button" data-close class="focus-ring rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:text-ink-100">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return {
    root,
    widget: root.querySelector<HTMLElement>("[data-widget]")!,
    message: root.querySelector<HTMLElement>("[data-message]")!,
    close: root.querySelector<HTMLButtonElement>("[data-close]")!,
  };
}

/** Shows the check and resolves once the server has accepted it. */
export function passHumanCheck(): Promise<void> {
  pending ??= (async () => {
    // A shared link can ask its question before the page has loaded /api/meta.
    if (!siteKey) {
      const meta = (await fetch("/api/meta").then((r) => r.json()).catch(() => null)) as { turnstileSiteKey?: string | null } | null;
      siteKey = meta?.turnstileSiteKey ?? null;
    }
    if (!siteKey) throw new Error("The human check isn't set up on this server.");
    await loadScript();
    const ui = dialog();
    let widgetId: string | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        ui.close.addEventListener("click", () => reject(new Error("Please complete the quick check to ask a question.")));
        widgetId = window.turnstile!.render(ui.widget, {
          sitekey: siteKey,
          theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
          callback: async (token: string) => {
            ui.message.textContent = "Checking…";
            const response = await fetch("/api/human", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            }).catch(() => null);
            if (response?.ok) resolve();
            else ui.message.textContent = "That didn't work. Please try the check again.";
          },
          "error-callback": () => {
            ui.message.textContent = "The check couldn't run. Please try again.";
          },
        });
      });
    } finally {
      if (widgetId) window.turnstile?.remove(widgetId);
      ui.root.remove();
    }
  })().finally(() => {
    pending = null;
  });
  return pending;
}
