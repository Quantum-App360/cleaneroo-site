// Onglets à l'intérieur des espaces Cleaneur et Pro (12 novembre 2026, contrôle du site) : la page ne défile plus sur des dizaines
// d'écrans ; chaque bloc reste en place (ses boutons continuent de marcher), seul le groupe choisi est affiché. Même découpage dans
// l'appli (SousOnglets.kt). Onglet mémorisé sur l'appareil.
import { tr, traduire } from "./langue.js";

const GROUPES = {
  cleaneur: { onglets: [["aujourdhui", "Aujourd'hui"], ["missions", "Missions"], ["planning", "Planning"], ["dossier", "Mon dossier"], ["activite", "Activité"]],
    defaut: "aujourdhui", details: "dossier",
    regles: [["#selfie-jour, .tableau-cleaneur, #noter-clients", "aujourdhui"], ["#avis-recus, #niveau-cleaneur, #mon-activite, #formules-cleaneur, [data-factures], .parrainage, .bloc-parrainage", "activite"],
      ["#ce-qui-manque, #formations-cleaneur, #bloc-invitation", "dossier"], ["#periodes-fermees, #creneaux-cleaneur", "planning"],
      ["#missions-disponibles, #missions-incompatibles, .deroule-mission", "missions"]] },
  pro: { onglets: [["tableau", "Tableau"], ["agenda", "Agenda"], ["biens", "Mes biens"], ["equipe", "Équipe"], ["compte", "Compte"]],
    defaut: "tableau", details: null,
    regles: [[".entete-pro, .grille-raccourcis, #chiffres-pro, #semaine-pro, #a-programmer", "tableau"], ["#agenda-pro", "agenda"],
      ["#carte-biens, #liste-biens, #aucun-bien, .aide-ical", "biens"], ["#liste-invitations, #equipe", "equipe"],
      ["#abonnement-pro, [data-factures], .parrainage, .bloc-parrainage", "compte"], ["details:has(#form-profil)", "compte"]] },
};
const CLE = e => `cleaneroo-sous-onglet-${e}`;

/** Groupe d'un bloc : règle qui correspond (le bloc ou ce qu'il contient), sinon null. */
function groupeDe(el, g) {
  for (const [sel, nom] of g.regles) { try { if (el.matches(sel) || el.querySelector(sel)) return nom; } catch { /* :has non pris en charge */ } }
  if (g.details && el.tagName === "DETAILS") return g.details;
  return null;
}

/** Range chaque enfant d'un conteneur : un titre sans règle prend le groupe du bloc qui le suit, le reste celui du bloc précédent. */
function ranger(conteneur, g, depart) {
  const enfants = [...conteneur.children].filter(e => !e.classList.contains("sous-onglets"));
  let courant = depart;
  enfants.forEach((el, i) => {
    if (el.id === "missions-cleaneur") { el.dataset.sous = "tous"; ranger(el, g, courant); return; }
    let nom = groupeDe(el, g);
    if (!nom && /^H[23]$/.test(el.tagName)) nom = enfants.slice(i + 1).map(x => x.id === "missions-cleaneur" ? null : groupeDe(x, g)).find(Boolean) || courant;
    courant = nom || courant;
    el.dataset.sous = courant;
  });
}

export function installerSousOnglets(vue, espace) {
  const g = GROUPES[espace], c = vue.querySelector(".contenu-onglet");
  if (!g || !c) return;
  let actif = g.defaut;
  try { actif = localStorage.getItem(CLE(espace)) || g.defaut; } catch { /* rien */ }
  if (!g.onglets.some(([id]) => id === actif)) actif = g.defaut;
  const barre = document.createElement("nav");
  barre.className = "sous-onglets"; barre.setAttribute("aria-label", tr("Rubriques de l'espace"));
  barre.innerHTML = g.onglets.map(([id, nom]) => `<button type="button" data-sous-onglet="${id}">${nom}</button>`).join("");
  c.prepend(barre); traduire(barre);
  const choisir = (id, defiler = false) => {
    actif = id; c.dataset.sousActif = id;
    barre.querySelectorAll("button").forEach(b => { const oui = b.dataset.sousOnglet === id; b.classList.toggle("choisi", oui); b.setAttribute("aria-pressed", String(oui)); });
    try { localStorage.setItem(CLE(espace), id); } catch { /* rien */ }
    if (defiler) barre.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  barre.onclick = e => { const b = e.target.closest("[data-sous-onglet]"); if (b) choisir(b.dataset.sousOnglet, true); };
  let attente = null;
  const tout = () => { ranger(c, g, g.defaut); };
  tout(); choisir(actif);
  new MutationObserver(() => { clearTimeout(attente); attente = setTimeout(tout, 60); }).observe(c, { childList: true, subtree: true });
  // Un lien vers un bloc d'un autre onglet (ex. « Missions disponibles ») ouvre d'abord le bon onglet.
  c.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]:not([href^="#/"])');
    const cible = a && document.getElementById(a.getAttribute("href").slice(1));
    const nom = cible?.closest("[data-sous]:not([data-sous='tous'])")?.dataset.sous;
    if (nom && nom !== actif) choisir(nom);
  }, true);
  styles(g);
}

function styles() {
  if (document.getElementById("styles-sous-onglets")) return;
  const s = document.createElement("style"); s.id = "styles-sous-onglets";
  const tous = Object.values(GROUPES).flatMap(g => g.onglets.map(([id]) => id));
  s.textContent = `.sous-onglets{position:sticky;top:76px;z-index:20;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 18px;padding:6px;
      background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(8px);border:1px solid var(--separateur);border-radius:16px}
    .sous-onglets::-webkit-scrollbar{display:none}
    .sous-onglets button{flex:1 0 auto;min-height:42px;padding:0 16px;border:0;border-radius:12px;background:none;font:inherit;font-weight:700;font-size:15px;color:var(--texte2);cursor:pointer;white-space:nowrap}
    .sous-onglets button.choisi{background:var(--primaire);color:#fff;box-shadow:0 4px 12px rgba(20,107,99,.25)}
    ${[...new Set(tous)].map(id => `[data-sous-actif="${id}"] [data-sous]:not([data-sous="${id}"]):not([data-sous="tous"])`).join(",")}{display:none!important}
    @media (max-width:560px){.sous-onglets{top:64px;border-radius:14px}.sous-onglets button{padding:0 12px;font-size:14px}}`;
  document.head.appendChild(s);
}
