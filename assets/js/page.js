// Pages statiques (référencement) : /menage/<ville>/, /calculateur/, /comparatif/<concurrent>/.
// Le contenu principal est écrit dans le HTML (généré par outils/generer_pages.py) ; ce script ajoute
// les prix calculés en direct (même moteur que la réservation), les étapes, la réassurance, le rappel et la langue.
import { RUBRIQUES, TYPES_LIEU, rubrique, formulesPour, ELEMENTS_TEXTILES, TAILLES_CANAPE } from "./catalogue.js";
import { traduire, traduireCatalogue, selecteurLangue, tr } from "./langue.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { euros, duree } from "./regles.js";
import { brouillonExemple, preremplir } from "./reserver.js";
import { blocEtapes, ETAPES_COURTES, blocReassurance, installerRappel, esc, bandeauLancement } from "./commun.js";
import { ville } from "./villes.js";
import { icone } from "./icones.js";
import { compterStatique, evenement } from "./compteur.js";

traduireCatalogue(RUBRIQUES, TYPES_LIEU);
const page = document.getElementById("page");
const v = ville(page.dataset.ville || "");
const lieu = v ? { codePostal: v.codePostal, ville: v.nom } : null;

/** Prix d'un brouillon : exactement le calcul de l'étape 2 de la réservation (espace Personnel, sans créneau choisi). */
const estimer = br => calculer(entreeEstimation(br, true, null));

/** Ouvre la réservation à l'étape 2 avec ces informations (et la ville de la page). */
function reserverAvec(rubriqueId, champs) {
  preremplir({ rubriqueId, champs, ...(lieu ? { lieu } : {}) });
  location.href = `/#/reserver/${rubriqueId}/calcul`;
}

/* ------------------------------------------------------------------ Exemples de prix (pages ville) */
const EXEMPLES = [
  ["home", { formuleId: "ponctuel" }, "Logement T2 · 62 m² · ménage ponctuel"],
  ["rental", { formuleId: "court", surface: 25, chambres: 0 }, "Location saisonnière · studio 25 m²"],
  ["rental", { formuleId: "court" }, "Location saisonnière · T2 62 m²"],
  ["windows", { formuleId: "ponctuel", typeLieuId: "fenetres_logement", fenetres: 8 }, "Vitres · 8 fenêtres"],
  ["textiles", { formuleId: "canape", panier: [{ elementId: "canape_droit", tailleId: "t20", quantite: 1 }] }, "Canapé droit · 1,5 à 2 m"],
];
const apresCredit = est => (est.creditImpotC ? `<p class="apres-credit">soit ${euros(est.apresCreditImpotC)} après crédit d'impôt de 50 %</p>` : "");

function blocExemples() {
  return `<div class="grille-3 exemples">${EXEMPLES.map(([id, champs, libelle], i) => {
    // Pages ville : prix de la zone de la ville (code postal de la page).
    const est = estimer(brouillonExemple(id, lieu ? { ...champs, codePostal: lieu.codePostal } : champs));
    return `<div class="carte exemple">${icone(rubrique(id).icone, { tuile: true })}<h3>${libelle}</h3>
      <p class="prix">${euros(est.totalC)}</p><p class="muet duree">${duree(est.dureeMin)}</p>${apresCredit(est)}
      <button type="button" class="lien-bouton" data-exemple="${i}">Réserver ›</button></div>`;
  }).join("")}</div><p class="petit">Prix maximum : le montant final ne peut pas le dépasser sans votre accord.</p>`;
}

/* ------------------------------------------------------------------ Calculateur de prix */
const PRESTATIONS_CALCUL = ["home", "rental", "windows", "textiles"];
let calcul = { rubriqueId: "home", champs: { formuleId: "ponctuel", surface: 62, chambres: 2, sdb: 1 } };
let utilise = false;
const ELEMENTS_CALCUL = ELEMENTS_TEXTILES.filter(e => !e.parM2);

function champsParDefaut(id) {
  const f = formulesPour(rubrique(id))[0].id;
  if (id === "windows") return { formuleId: f, typeLieuId: "fenetres_logement", fenetres: 8 };
  if (id === "textiles") return { formuleId: "canape", elementId: "canape_droit", tailleId: "t15", quantite: 1 };
  return { formuleId: f, surface: 62, chambres: 2, sdb: 1 };
}
/** Champs du brouillon de réservation (le panier des textiles est construit à partir de l'élément choisi). */
function champsReservation() {
  const c = calcul.champs;
  if (calcul.rubriqueId !== "textiles") return { ...c };
  const e = ELEMENTS_CALCUL.find(x => x.id === c.elementId);
  return { formuleId: c.formuleId, panier: [{ elementId: c.elementId, ...(e?.avecTaille ? { tailleId: c.tailleId } : {}), quantite: c.quantite }] };
}

const nombre = (lib, champ, val, min, max) =>
  `<label class="champ">${lib}<input type="number" inputmode="numeric" data-calc="${champ}" value="${val}" min="${min}" max="${max}"></label>`;
const liste = (lib, champ, options, val) =>
  `<label class="champ">${lib}<select data-calc="${champ}">${options.map(([id, n]) => `<option value="${esc(id)}" ${id === val ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;

function formulaireCalcul() {
  const id = calcul.rubriqueId, c = calcul.champs, r = rubrique(id);
  const formules = formulesPour(r).map(f => [f.id, f.nom]);
  let champs = "";
  if (id === "home" || id === "rental") champs = nombre("Surface (m²)", "surface", c.surface, 10, 300) + nombre("Chambres", "chambres", c.chambres, 0, 8) + nombre("Salles de bain", "sdb", c.sdb, 1, 6);
  if (id === "windows") champs = nombre("Nombre de fenêtres", "fenetres", c.fenetres, 1, 60);
  if (id === "textiles") {
    const elements = ELEMENTS_CALCUL.filter(e => e.formuleId === c.formuleId);
    const e = elements.find(x => x.id === c.elementId) || elements[0];
    champs = liste("Élément", "elementId", elements.map(x => [x.id, x.nom]), e.id)
      + (e.avecTaille ? liste("Taille", "tailleId", TAILLES_CANAPE.map(t => [t.id, t.libelle]), c.tailleId) : "")
      + nombre("Quantité", "quantite", c.quantite, 1, 10);
  }
  return `<form class="calculateur carte" novalidate>
      ${liste("Prestation", "rubriqueId", PRESTATIONS_CALCUL.map(x => [x, rubrique(x).nom]), id)}
      ${liste("Formule", "formuleId", formules, c.formuleId)}
      <div class="champs-calcul">${champs}</div>
    </form>`;
}

function resultatCalcul() {
  const est = estimer(brouillonExemple(calcul.rubriqueId, champsReservation()));
  if (est.devisObligatoire) return `<div class="resultat carte"><h3>Sur devis</h3><p class="muet">Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.</p>
    <button type="button" class="bouton" data-reserver-calcul>Réserver avec ces informations</button></div>`;
  return `<div class="resultat carte">${icone(rubrique(calcul.rubriqueId).icone, { tuile: true })}
    <p class="surtitre">Votre prix</p><p class="prix">${euros(est.totalC)}</p><p class="muet duree">${duree(est.dureeMin)}</p>${apresCredit(est)}
    <p class="petit">Prix maximum : le montant final ne peut pas le dépasser sans votre accord.</p>
    <button type="button" class="bouton" data-reserver-calcul>Réserver avec ces informations</button></div>`;
}

function rendreCalcul(zone) {
  zone.innerHTML = `<div class="grille-calcul">${formulaireCalcul()}${resultatCalcul()}</div>`;
  traduire(zone);
}

function brancherCalcul(zone) {
  rendreCalcul(zone);
  zone.addEventListener("change", e => {
    const champ = e.target.dataset.calc;
    if (!champ) return;
    if (champ === "rubriqueId") calcul = { rubriqueId: e.target.value, champs: champsParDefaut(e.target.value) };
    else {
      const n = e.target.type === "number" ? Math.min(+e.target.max, Math.max(+e.target.min, parseInt(e.target.value, 10) || +e.target.min)) : e.target.value;
      calcul.champs = { ...calcul.champs, [champ]: n };
      if (champ === "formuleId" && calcul.rubriqueId === "textiles") calcul.champs.elementId = ELEMENTS_CALCUL.find(x => x.formuleId === n)?.id;
    }
    if (!utilise) { utilise = true; evenement("calculator_used"); }
    rendreCalcul(zone);
  });
  zone.addEventListener("click", e => { if (e.target.closest("[data-reserver-calcul]")) reserverAvec(calcul.rubriqueId, champsReservation()); });
}

/* ------------------------------------------------------------------ Mise en place */
document.getElementById("choix-langue").innerHTML = selecteurLangue();
document.getElementById("lancement").innerHTML = bandeauLancement();
document.querySelector(".burger")?.addEventListener("click", e => {
  const nav = document.querySelector(".nav");
  nav.classList.toggle("ouvert");
  e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("ouvert"));
});
document.querySelectorAll("[data-exemples]").forEach(z => { z.innerHTML = blocExemples(); });
document.querySelectorAll("[data-etapes]").forEach(z => { z.innerHTML = blocEtapes(ETAPES_COURTES); });
document.querySelectorAll("[data-reassurance]").forEach(z => { z.innerHTML = blocReassurance(); });
document.querySelectorAll("[data-calculateur]").forEach(brancherCalcul);
document.querySelectorAll("[data-prestations]").forEach(z => { z.textContent = RUBRIQUES.map(r => r.nom).join(", "); });
document.addEventListener("click", e => {
  const ex = e.target.closest("[data-exemple]");
  if (ex) { const [id, champs] = EXEMPLES[+ex.dataset.exemple]; reserverAvec(id, champs); }
  if (e.target.closest("[data-reserver-ville]") && lieu) preremplir({ lieu });
});
traduire(document.body);
document.title = tr(document.title);
document.querySelectorAll(".revele, .etape").forEach(el => el.classList.add("visible"));
installerRappel(v?.nom || "");
compterStatique();
// Personne connectée (session Supabase dans ce navigateur) : prénom et « Mon espace Cleaneur » dans le menu, comme sur l'accueil.
try {
  if (Object.keys(localStorage).some(k => k.startsWith("sb-") && k.endsWith("-auth-token")))
    import("./compte.js").then(m => m.majLienCompte()).catch(() => { /* hors ligne */ });
} catch { /* navigation privée */ }
