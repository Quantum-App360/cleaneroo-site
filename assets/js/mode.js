// Deux interfaces bien séparées (18 novembre 2026) : le mode client (Particulier, Entreprise, Conciergerie, Hôtels et campings)
// et le mode Cleaneur. Un interrupteur « Mode Cleaneur » / « Retour mode client » passe de l'une à l'autre, avec une animation.
// En mode Cleaneur, un visiteur choisit : Cleaneur indépendant, ou référencer sa société de nettoyage.
// Même fonctionnement dans l'application (ModeCleaneur.kt).
import { tr, traduire } from "./langue.js";
import { icone } from "./icones.js";

const CLE = "cleaneroo-mode";

export function modeCleaneur() {
  try { return localStorage.getItem(CLE) === "cleaneur"; } catch { return false; }
}
export function fixerMode(cleaneur) {
  try { localStorage.setItem(CLE, cleaneur ? "cleaneur" : "client"); } catch { /* navigation privée */ }
  document.body.classList.toggle("mode-cleaneur", !!cleaneur);
}

/** Interrupteur de l'en-tête et de la barre des rubriques. */
export function boutonMode() {
  const c = modeCleaneur();
  return `<button type="button" class="bascule-mode${c ? " actif" : ""}" data-bascule-mode aria-pressed="${c}">
    <span class="interrupteur" aria-hidden="true"><i></i></span><span>${tr(c ? "Retour mode client" : "Mode Cleaneur")}</span></button>`;
}

/** Transition « mousse et raclette » (18 novembre 2026) : des bulles de savon gonflent et couvrent l'écran,
 * l'interface change sous la mousse, puis une raclette de laveur de vitres (lame + poignée en T) nettoie l'écran
 * en 4 passages horizontaux, en zigzag de haut en bas, en laissant des gouttes ; des étincelles de propreté brillent à la fin.
 * Mousse verte vers le mode Cleaneur, bleue vers le mode client (≈ 2,6 s ; jamais plus de 4 s). */
const BANDES = 4, PASSE_MS = 330;
function animer(versCleaneur, puis) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { puis(); return; }
  const l = innerWidth, h = innerHeight, hb = h / BANDES, pas = Math.max(64, Math.min(l, h) / 6.5);
  // Mousse découpée en bandes : chaque passage de la raclette essuie la sienne.
  const bandes = Array.from({ length: BANDES }, (_, k) => {
    const bulles = [];
    for (let y = -pas / 2; y < hb + pas / 2; y += pas * 0.75)
      for (let x = -pas / 2 + Math.random() * pas * 0.4; x < l + pas; x += pas * 0.8) {
        const t = pas * (1.05 + Math.random() * 0.6), yy = y + (Math.random() - 0.5) * pas * 0.3;
        bulles.push(`<i style="left:${x - t / 2}px;top:${yy - t / 2}px;width:${t}px;height:${t}px;animation-delay:${Math.round(((BANDES - k) * hb - yy) / h * 260 + Math.random() * 160)}ms"></i>`);
      }
    return `<div class="bande-mousse" style="top:${k * hb}px;height:${hb + 1}px">${bulles.join("")}</div>`;
  });
  const gouttes = [], etincelles = [];
  for (let k = 0; k < BANDES; k++) for (let i = 0; i < 4; i++)
    gouttes.push(`<u style="left:${6 + Math.random() * 88}%;top:${(k + 0.15 + Math.random() * 0.7) * 100 / BANDES}%;animation-delay:${760 + k * PASSE_MS + 120 + i * 50}ms"></u>`);
  for (let i = 0; i < 8; i++) etincelles.push(`<s style="left:${8 + Math.random() * 84}%;top:${8 + Math.random() * 80}%;animation-delay:${760 + BANDES * PASSE_MS + 60 + i * 80}ms;--t:${18 + Math.random() * 22}px"></s>`);
  const v = document.createElement("div");
  v.className = `mousse-mode ${versCleaneur ? "vers-cleaneur" : "vers-client"}`;
  v.setAttribute("aria-hidden", "true");
  v.innerHTML = `<div class="mousse">${bandes.join("")}</div><b class="mousse-titre">${tr(versCleaneur ? "Mode Cleaneur" : "Mode client")}</b>
    <div class="raclette"><span class="lame"></span><span class="tige"></span><span class="poignee"></span></div>${gouttes.join("")}${etincelles.join("")}<div class="reflet"></div>`;
  document.body.append(v);
  setTimeout(puis, 620);                        // l'interface change pendant que la mousse couvre l'écran
  // Essuyage piloté image par image : la mousse disparaît exactement derrière la lame.
  setTimeout(() => {
    const rac = v.querySelector(".raclette"), bandesEl = [...v.querySelectorAll(".bande-mousse")], lr = 30, marge = 130;
    rac.style.height = `${hb}px`;
    const debut = performance.now(), duree = PASSE_MS * 0.9;
    const image = maintenant => {
      if (!v.isConnected) return;
      const t = maintenant - debut, k = Math.min(BANDES - 1, Math.floor(t / PASSE_MS));
      const p = Math.min(1, Math.max(0, (t - k * PASSE_MS) / duree)), droite = k % 2 === 0;
      // Bord de la lame : de -marge à l + marge (vers la droite), ou l'inverse
      const bord = droite ? -marge + p * (l + 2 * marge) : l + marge - p * (l + 2 * marge);
      rac.style.transform = droite ? `translate(${bord - lr}px, ${k * hb}px)` : `translate(${bord}px, ${k * hb}px) scaleX(-1)`;
      bandesEl.forEach((el, i) => {
        if (i < k) el.style.clipPath = i % 2 === 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
        else if (i === k) { const e = Math.min(l, Math.max(0, droite ? bord : l - bord)); el.style.clipPath = droite ? `inset(0 0 0 ${e}px)` : `inset(0 ${e}px 0 0)`; }
      });
      if (k === 1 && p > 0.4) v.querySelector(".mousse-titre")?.classList.add("parti");
      if (t < BANDES * PASSE_MS) requestAnimationFrame(image);
      else { bandesEl.forEach(el => el.style.clipPath = "inset(0 0 0 100%)"); rac.style.display = "none"; }
    };
    requestAnimationFrame(image);
  }, 760);
  setTimeout(() => v.remove(), 760 + BANDES * PASSE_MS + 1100);
  setTimeout(() => v.isConnected && v.remove(), 4000);   // jamais plus de 4 s
}

/** Bascule : mode Cleaneur → page Cleaneur (choix ou son espace) ; mode client → accueil. */
export function basculer() {
  const vers = !modeCleaneur();
  animer(vers, () => {
    fixerMode(vers);
    majPastilleMode();
    location.hash = vers ? "#/mode-cleaneur" : "#/";
    window.dispatchEvent(new Event("cleaneroo-mode"));
  });
}

/** Pastille flottante en bas de l'écran (19 novembre 2026, comme l'appli iPhone) : toujours visible, dans les deux sens,
 * même dans l'espace Cleaneur sur téléphone où l'interrupteur de l'en-tête est rangé dans le menu. */
export function majPastilleMode() {
  let p = document.querySelector(".pastille-mode");
  if (!p) {
    p = document.createElement("button");
    p.type = "button"; p.className = "pastille-mode"; p.setAttribute("data-bascule-mode", "");
    document.body.append(p);
  }
  const c = modeCleaneur();
  p.classList.toggle("vers-client", c);
  p.innerHTML = `<span aria-hidden="true">⇄</span>${tr(c ? "Passer en mode client" : "Passer en mode Cleaneur")}`;
}

/** Branche tous les interrupteurs présents dans la page (délégation : un seul écouteur). */
export function brancherBascule() {
  majPastilleMode();
  if (document.body.dataset.basculeBranchee) return;
  document.body.dataset.basculeBranchee = "1";
  document.addEventListener("click", e => {
    if (e.target.closest("[data-bascule-mode]")) { e.preventDefault(); basculer(); }
    if (e.target.closest("[data-choix-societe]")) { try { sessionStorage.setItem("cleaneroo-societe-voulue", "1"); } catch { /* rien */ } }
  });
  document.body.classList.toggle("mode-cleaneur", modeCleaneur());
}

/** Accueil du mode Cleaneur : deux façons de rejoindre Cleaneroo. */
export function blocChoixCleaneur() {
  return `<div class="choix-cleaneur">
    <a class="carte choix-cleaneur-carte" href="#/compte/cleaneur">${icone("cleaneurs", { tuile: true })}
      <div><b>${tr("Je suis Cleaneur indépendant")}</b>
      <p class="petit">${tr("Auto-entrepreneur : choisissez vos missions près de chez vous, déroulé guidé, paiement après validation du client.")}</p></div>
      <span class="aller" aria-hidden="true">›</span></a>
    <a class="carte choix-cleaneur-carte" href="#/compte/cleaneur" data-choix-societe>${icone("bureaux", { tuile: true })}
      <div><b>${tr("Je référence ma société de nettoyage")}</b>
      <p class="petit">${tr("Vous avez des salariés : planning, missions attribuées à vos équipes, factures au nom de la société.")}</p></div>
      <span class="aller" aria-hidden="true">›</span></a>
  </div>`;
}
