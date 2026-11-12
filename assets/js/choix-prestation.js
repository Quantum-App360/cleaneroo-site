// « Réserver une prestation » (12 novembre 2026) : petite fenêtre animée pour choisir pour qui et la prestation, puis la
// réservation s'ouvre à l'étape 2. Tout élément [data-choisir-prestation] l'ouvre. Même fenêtre dans l'appli (ChoixPrestation.kt).
import { RUBRIQUES, PARTIES, partie, rubrique, pastille } from "./catalogue.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { profilMemorise } from "./entete.js";
import { reserverPrestation } from "./reserver.js";

let fond = null, partieId = null, retourFocus = null;

function contenu() {
  const p = partie(partieId);
  return `<div class="fenetre-prestations" role="document">
    <button type="button" class="fp-fermer" data-fp-fermer aria-label="Fermer">×</button>
    <span class="fp-surtitre"><i aria-hidden="true">✨</i> <span>Réserver une prestation</span></span>
    <h2 id="fp-titre">Que souhaitez-vous nettoyer ?</h2>
    <div class="segments trois fp-pour">${PARTIES.map(x => `<button type="button" data-fp-partie="${x.id}" class="${x.id === p.id ? "choisi" : ""}">${x.nom}</button>`).join("")}</div>
    <div class="fp-tuiles">${RUBRIQUES.filter(r => p.rubriques.includes(r.id)).map((r, i) => `
      <button type="button" class="fp-tuile" style="--i:${i}" data-fp-rubrique="${r.id}">${icone(r.icone, { tuile: true })}
        <b>${r.nom}</b><span>${pastille(r)}</span></button>`).join("")}</div>
    <p class="fp-pied"><a href="#/estimer" data-fp-fermer>Juste connaître le prix ? Estimer mon prix ›</a></p>
  </div>`;
}

function rendre() {
  fond.innerHTML = contenu();
  traduire(fond);
}

export function ouvrirChoixPrestation() {
  if (fond) return;
  retourFocus = document.activeElement;
  partieId = profilMemorise()?.espace === "pro" ? "conciergerie" : "personnel";
  fond = document.createElement("div");
  fond.className = "fp-fond";
  fond.setAttribute("role", "dialog"); fond.setAttribute("aria-modal", "true"); fond.setAttribute("aria-labelledby", "fp-titre");
  document.body.appendChild(fond);
  document.body.classList.add("fp-ouverte");
  rendre();
  requestAnimationFrame(() => fond.classList.add("visible"));
  setTimeout(() => fond?.querySelector(".fp-tuile")?.focus({ preventScroll: true }), 350);
}

function fermer() {
  if (!fond) return;
  const f = fond; fond = null;
  f.classList.remove("visible"); f.classList.add("sortie");
  document.body.classList.remove("fp-ouverte");
  setTimeout(() => f.remove(), 260);
  retourFocus?.focus?.({ preventScroll: true });
}

document.addEventListener("click", e => {
  const ouvrir = e.target.closest("[data-choisir-prestation]");
  if (ouvrir) { e.preventDefault(); return ouvrirChoixPrestation(); }
  if (!fond || !fond.contains(e.target) && e.target !== fond) return;
  if (e.target === fond || e.target.closest("[data-fp-fermer]")) return fermer();
  const p = e.target.closest("[data-fp-partie]");
  if (p) { partieId = p.dataset.fpPartie; return rendre(); }
  const r = e.target.closest("[data-fp-rubrique]");
  if (r && rubrique(r.dataset.fpRubrique)) {
    const id = r.dataset.fpRubrique, pour = partieId;
    r.classList.add("choisie");
    setTimeout(() => { fermer(); reserverPrestation(id, pour); }, 180);
  }
});
document.addEventListener("keydown", e => { if (fond && e.key === "Escape") fermer(); });
window.addEventListener("hashchange", () => { if (fond) fermer(); });

if (!document.getElementById("styles-fp")) {
  const s = document.createElement("style"); s.id = "styles-fp";
  s.textContent = `
  .fp-ouverte { overflow: hidden; }
  .fp-fond { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px;
    background: rgba(11, 47, 51, 0); backdrop-filter: blur(0); transition: background .25s ease, backdrop-filter .25s ease; }
  .fp-fond.visible { background: rgba(11, 47, 51, .45); backdrop-filter: blur(4px); }
  .fenetre-prestations { position: relative; width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--surface);
    border-radius: 26px; padding: 26px 22px 18px; box-shadow: 0 30px 80px rgba(11, 47, 51, .35);
    opacity: 0; transform: translateY(28px) scale(.94); transition: opacity .25s ease, transform .38s cubic-bezier(.2, .9, .25, 1.25); }
  .fp-fond.visible .fenetre-prestations { opacity: 1; transform: none; }
  .fp-fond.sortie .fenetre-prestations { opacity: 0; transform: translateY(16px) scale(.97); transition-duration: .2s; }
  .fenetre-prestations::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 6px; border-radius: 26px 26px 0 0;
    background: linear-gradient(90deg, var(--turquoise), var(--menthe), var(--or), var(--corail)); background-size: 300% 100%; animation: fp-ruban 6s linear infinite; }
  .fp-fermer { position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--creux);
    font-size: 24px; line-height: 1; color: var(--texte2); cursor: pointer; transition: transform .2s ease; }
  .fp-fermer:hover { transform: rotate(90deg); }
  .fp-surtitre { display: inline-block; font-size: 13px; font-weight: 700; color: var(--primaire); background: rgba(42, 157, 147, .12); padding: 5px 12px; border-radius: 999px; }
  .fenetre-prestations h2 { margin: 10px 44px 14px 0; font-size: clamp(22px, 3vw, 28px); }
  .fp-pour { margin-bottom: 16px; }
  .fp-tuiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .fp-tuile { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; padding: 14px; min-height: 118px;
    border: 1.5px solid var(--separateur); border-radius: 18px; background: var(--surface); cursor: pointer; color: var(--texte);
    opacity: 0; transform: translateY(14px); animation: fp-apparait .45s cubic-bezier(.2, .9, .25, 1.2) forwards; animation-delay: calc(var(--i) * 45ms + 120ms);
    transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
  .fp-tuile b { font-size: 15px; line-height: 1.2; }
  .fp-tuile span { font-size: 12.5px; color: var(--primaire); font-weight: 600; }
  .fp-tuile:hover, .fp-tuile:focus-visible { border-color: var(--turquoise); box-shadow: 0 10px 24px rgba(20, 107, 99, .14); transform: translateY(-3px); outline: none; }
  .fp-tuile:hover .tuile-ico { animation: fp-saut .5s ease; }
  .fp-tuile.choisie { border-color: var(--turquoise); background: rgba(42, 157, 147, .10); transform: scale(.97); }
  .fp-pied { text-align: center; margin: 16px 0 2px; font-size: 14px; }
  .fp-pied a { color: var(--primaire); font-weight: 600; }
  @keyframes fp-apparait { to { opacity: 1; transform: none; } }
  @keyframes fp-saut { 0%, 100% { transform: none; } 40% { transform: translateY(-5px) rotate(-6deg); } 70% { transform: translateY(1px) rotate(3deg); } }
  @keyframes fp-ruban { to { background-position: 300% 0; } }
  @media (max-width: 560px) {
    .fp-fond { place-items: end center; padding: 0; }
    .fenetre-prestations { border-radius: 26px 26px 0 0; max-height: 88vh; padding: 22px 16px 16px; transform: translateY(60px); }
    .fp-tuiles { grid-template-columns: 1fr 1fr; }
    .fp-tuile { min-height: 104px; padding: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .fenetre-prestations, .fp-tuile, .fp-fond { transition: none !important; animation: none !important; opacity: 1 !important; transform: none !important; }
    .fenetre-prestations::before { animation: none; }
  }`;
  document.head.appendChild(s);
}
