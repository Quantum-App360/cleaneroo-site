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

/** Animation de passage d'un mode à l'autre : un voile coloré balaie l'écran, l'interface change dessous. */
function animer(versCleaneur, puis) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { puis(); return; }
  const v = document.createElement("div");
  v.className = `voile-mode ${versCleaneur ? "vers-cleaneur" : "vers-client"}`;
  v.setAttribute("aria-hidden", "true");
  v.innerHTML = `<div class="voile-contenu"><img src="/assets/img/logo-marque.svg" alt="" width="84" height="84"><b>${tr(versCleaneur ? "Mode Cleaneur" : "Mode client")}</b></div>`;
  document.body.append(v);
  setTimeout(puis, 520);                       // l'interface change pendant que le voile couvre l'écran
  setTimeout(() => v.classList.add("sortie"), 900);
  setTimeout(() => v.remove(), 1500);
}

/** Bascule : mode Cleaneur → page Cleaneur (choix ou son espace) ; mode client → accueil. */
export function basculer() {
  const vers = !modeCleaneur();
  animer(vers, () => {
    fixerMode(vers);
    location.hash = vers ? "#/mode-cleaneur" : "#/";
    window.dispatchEvent(new Event("cleaneroo-mode"));
  });
}

/** Branche tous les interrupteurs présents dans la page (délégation : un seul écouteur). */
export function brancherBascule() {
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
