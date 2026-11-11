// Fond vivant (9 novembre 2026) : bulles de savon légères qui montent derrière le contenu (visibles dans les espaces du fond),
// options conseillées qui scintillent, petite gerbe de mousse quand on coche une option ou une formule.
// Discret : derrière les cartes, aucune gêne à la lecture ni au clic. Coupé si « réduire les animations » est demandé.
// Même esprit dans l'appli (FondBulles.kt).
const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

function styles() {
  if (document.getElementById("style-fond-anime")) return;
  const st = document.createElement("style");
  st.id = "style-fond-anime";
  st.textContent = `
  .fond-bulles { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
  .fond-bulles i { position: absolute; bottom: -120px; border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 9%, rgba(255,255,255,0) 10%),
                radial-gradient(circle at 50% 50%, rgba(37,181,191,0) 58%, rgba(37,181,191,.22) 70%, rgba(156,140,255,.20) 82%, rgba(255,184,140,.18) 92%, rgba(255,255,255,0) 100%);
    box-shadow: inset 0 0 12px rgba(255,255,255,.55); animation: monter var(--d) linear var(--r) infinite; opacity: .75; }
  @keyframes monter { 0% { transform: translate3d(0,0,0) scale(.85); } 50% { transform: translate3d(var(--x),-55vh,0) scale(1); }
    100% { transform: translate3d(calc(var(--x) * -.6),-118vh,0) scale(1.08); opacity: 0; } }
  .fond-bulles b { position: absolute; width: 360px; height: 160px; border-radius: 50%; filter: blur(28px); opacity: .5;
    background: radial-gradient(closest-side, rgba(37,181,191,.20), rgba(37,181,191,0)); animation: mousse 14s ease-in-out infinite alternate; }
  @keyframes mousse { from { transform: translate3d(-20px,0,0) scale(1); } to { transform: translate3d(30px,-20px,0) scale(1.12); } }
  @media (prefers-color-scheme: dark) { .fond-bulles i { opacity: .35; } .fond-bulles b { opacity: .25; } }
  /* Options conseillées : bordure qui tourne doucement et reflet qui passe (incite sans forcer). */
  .formule.conseillee, .tranche.conseillee { position: relative; overflow: hidden; }
  .formule.conseillee::after, .tranche.conseillee::after { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%); transform: translateX(-120%);
    animation: reflet-option 4.5s ease-in-out 1.2s infinite; }
  @keyframes reflet-option { 0%, 70% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
  .formule.conseillee .badge-formule, .tranche.conseillee .badge-formule { animation: pulse-badge 2.4s ease-in-out infinite; }
  @keyframes pulse-badge { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(37,181,191,.12); } }
  /* Gerbe de mousse quand on coche */
  .gerbe { position: fixed; z-index: 50; pointer-events: none; width: 10px; height: 10px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff 0 18%, rgba(37,181,191,.55) 60%, rgba(156,140,255,.35)); animation: gerbe .9s ease-out forwards; }
  @keyframes gerbe { from { transform: translate(0,0) scale(.4); opacity: 1; } to { transform: translate(var(--gx), var(--gy)) scale(1.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .fond-bulles, .gerbe { display: none; } .formule.conseillee::after, .tranche.conseillee::after, .formule.conseillee .badge-formule { animation: none; } }`;
  document.head.appendChild(st);
}

function bulles() {
  if (document.querySelector(".fond-bulles")) return;
  const fond = document.createElement("div");
  fond.className = "fond-bulles";
  fond.setAttribute("aria-hidden", "true");
  const n = innerWidth < 600 ? 7 : 13;
  let h = "";
  for (let i = 0; i < n; i++) {
    const t = 18 + Math.round(Math.random() * 46);
    h += `<i style="left:${Math.round(Math.random() * 96)}%;width:${t}px;height:${t}px;--d:${16 + Math.round(Math.random() * 18)}s;--r:-${Math.round(Math.random() * 30)}s;--x:${Math.round(Math.random() * 80 - 40)}px"></i>`;
  }
  h += `<b style="left:-80px;bottom:8%"></b><b style="right:-100px;top:22%;animation-delay:-6s"></b>`;
  fond.innerHTML = h;
  document.body.prepend(fond);
}

/** Petite gerbe de bulles au point (x, y). */
export function gerbe(x, y) {
  if (reduit) return;
  for (let i = 0; i < 9; i++) {
    const g = document.createElement("span");
    g.className = "gerbe";
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 38;
    g.style.cssText = `left:${x - 5}px;top:${y - 5}px;--gx:${Math.cos(a) * d}px;--gy:${Math.sin(a) * d - 26}px;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px`;
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 950);
  }
}

if (typeof document !== "undefined") {
  const demarrer = () => {
    styles();
    if (!reduit && !document.body.classList.contains("sans-fond-anime")) bulles();
    // Option ou formule cochée : gerbe de mousse (récompense le choix d'une option).
    document.addEventListener("change", e => {
      const c = e.target;
      if (!(c instanceof HTMLInputElement) || c.type !== "checkbox" || !c.checked) return;
      const r = (c.closest("label") || c).getBoundingClientRect();
      gerbe(r.left + 14, r.top + r.height / 2);
    });
    document.addEventListener("click", e => {
      const f = e.target.closest?.(".formule, .tranche, [data-pack]");
      if (!f) return;
      const r = f.getBoundingClientRect();
      gerbe(r.left + r.width / 2, r.top + 20);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
}
