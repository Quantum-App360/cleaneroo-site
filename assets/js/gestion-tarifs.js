// Écran « Tarifs » de l'espace de gestion (lot 3 de la refonte du 20 novembre 2026) : modifier les prix sans toucher au code.
// Chaque publication crée une nouvelle version (table tarifs) ; les demandes déjà enregistrées gardent leur prix.
// Avant de publier : aperçu des prix sur des cas types et test de cohérence (Standard ≤ Confort ≤ Premium, plancher horaire).
import { supabase } from "./donnees.js";
import { REGLES, euros } from "./regles.js";
import { RUBRIQUES, ELEMENTS_TEXTILES, formulesPour, packsPour, TYPES_LIEU } from "./catalogue.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { appliquerTarifs, valeursDuCode, versionTarifs, chargerTarifs } from "./tarifs.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = c => (Math.round(c) / 100).toFixed(2).replace(/\.00$/, "");
const NOMS_LOC = { standard: "Standard", confort: "Confort", premium: "Premium" };
const MINIMUMS = [["MINIMUM_MENAGE_LOCATION_C", "Location : prix minimum d'un ménage"], ["MINIMUM_COMMANDE_VEHICULE_C", "Véhicules : minimum de commande"],
  ["MINIMUM_COMMANDE_TEXTILES_C", "Canapés et textiles : minimum de commande"], ["MINIMUM_COMMANDE_HEBERGEMENT_C", "Hôtels et campings : minimum"],
  ["MINIMUM_COMMANDE_BATEAU_C", "Bateaux : minimum"], ["MINIMUM_COMMANDE_LOISIRS_C", "Vans, camping-cars : minimum"]];
const LINGE = [["DRAPS_SUR_PLACE_PAR_LIT_C", "Draps lavés sur place, par lit"], ["LAVERIE_TRAJET_C", "Trajet laverie, par passage"], ["LINGE_SUR_PLACE_FORFAIT_C", "Serviettes et torchons sur place (forfait)"],
  ["LINGE_LAVERIE_PAR_SDB_C", "Serviettes en laverie, par salle de bain"], ["TORCHONS_LAVERIE_C", "Torchons en laverie"], ["OPTION_TAUX_HORAIRE_C", "Étapes en plus : prix de l'heure"], ["OPTION_MIN_C", "Étapes en plus : minimum"]];
const POURCENTS = [["FRAIS_SERVICE_PARTICULIER_PCT", "Frais de service particulier (%)"], ["FRAIS_SERVICE_PRO_PCT", "Frais de service pro sans abonnement (%)"],
  ["MAJORATION_DIMANCHE_PCT", "Majoration dimanche (%)"], ["CRENEAU_MALIN_PCT", "Remise créneau malin (%)"], ["ZONE_PRESTIGE_PCT", "Zone Prestige (%)"], ["ZONE_ECONOMIQUE_PCT", "Zone Économique (%)"],
  ["FORMULE_CONFORT_PLUS_PCT", "Confort : au plus Standard + (%)"], ["FORMULE_PREMIUM_PLUS_PCT", "Premium : au plus Standard + (%)"],
  ["COMMISSION_GRATUIT_PB", "Commission Cleaneur formule Gratuit (centièmes de %, 2000 = 20 %)"], ["COMMISSION_PRO_PB", "Commission Cleaneur formule Pro (centièmes de %)"]];

/** Cas types de l'aperçu (même parcours que le site). */
const BR = { surface: 62, chambres: 2, sdb: 1, niveaux: 1, fenetres: 8, typeLieuId: "", salissure: "NORMAL", taches: [], tachesPerso: [], consommablesChoisis: [], engagementMois: 0, flexible: false, panier: [], codePostal: "83600" };
const CAS = [
  ["Location studio · Standard", { rubriqueId: "rental", formuleId: "standard", surface: 25, chambres: 0 }],
  ["Location T3 · Standard", { rubriqueId: "rental", formuleId: "standard" }], ["Location T3 · Confort", { rubriqueId: "rental", formuleId: "confort" }],
  ["Location T3 · Premium", { rubriqueId: "rental", formuleId: "premium" }],
  ["Ménage T3 62 m² · Standard", { rubriqueId: "home", formuleId: "ponctuel" }],
  ["Ménage T3 62 m² · Confort", { rubriqueId: "home", formuleId: "ponctuel", pack: "confort" }], ["Ménage T3 62 m² · Premium", { rubriqueId: "home", formuleId: "ponctuel", pack: "prestige" }],
  ["Déménagement T3 · départ", { rubriqueId: "moving", formuleId: "depart" }], ["Vitres · 8 fenêtres", { rubriqueId: "windows", formuleId: "ponctuel", typeLieuId: "fenetres_logement" }],
  ["Bureaux 100 m²", { rubriqueId: "office", formuleId: "regulier", typeLieuId: "bureaux", surface: 100 }],
  ["Canapé droit", { rubriqueId: "textiles", formuleId: "canape", panier: [{ elementId: "canape_droit", tailleId: "t15", quantite: 1 }] }],
];
const prixCas = ([, o]) => {
  const r = RUBRIQUES.find(x => x.id === o.rubriqueId), taches = o.pack ? (packsPour(r, o.typeLieuId || "").find(p => p.id === o.pack)?.tacheIds || []) : [];
  return calculer(entreeEstimation({ ...BR, ...o, taches }, true, null)).totalC;
};
/** Test de cohérence : ordre des formules et plancher horaire, pour chaque prestation, type de lieu et surface. */
function coherence() {
  const pb = [];
  for (const r of RUBRIQUES.filter(x => x.packs.length)) {
    const plancher = (REGLES.PLANCHER_HORAIRE_C || {})[r.id] || 0;
    for (const lieu of (TYPES_LIEU[r.id] || [{ id: "" }])) for (const f of formulesPour(r)) for (const surface of [20, 62, 150]) {
      const packs = packsPour(r, lieu.id), c = packs.find(p => p.id === "confort"), pr = packs.find(p => p.id === "prestige");
      if (!c || !pr) continue;
      const o = { ...BR, rubriqueId: r.id, formuleId: f.id, typeLieuId: lieu.id, surface };
      const x = [[], c.tacheIds, pr.tacheIds].map(t => calculer(entreeEstimation({ ...o, taches: t }, true, null)));
      if (!(x[0].totalC <= x[1].totalC && x[1].totalC <= x[2].totalC)) pb.push(`${r.nom} (${lieu.nom || "—"}, ${surface} m²) : Confort ou Premium moins cher que le niveau inférieur`);
      x.slice(1).forEach(y => { if (plancher && !y.devisObligatoire && y.totalC < Math.round(plancher * Math.max(0, y.dureeMin - 15) * y.nombreCleaneurs / 60 * 0.98)) pb.push(`${r.nom} (${lieu.nom || "—"}, ${surface} m²) : sous le plancher horaire`); });
    }
  }
  const loc = ["standard", "confort", "premium"].map(f => calculer(entreeEstimation({ ...BR, rubriqueId: "rental", formuleId: f }, true, null)).totalC);
  if (!(loc[0] <= loc[1] && loc[1] <= loc[2])) pb.push("Location : Standard ≤ Confort ≤ Premium non respecté");
  return [...new Set(pb)];
}

/** Valeurs en vigueur (code + dernière version publiée), au format de la table. */
function enVigueur() {
  const v = valeursDuCode();
  return { regles: Object.fromEntries(Object.keys(v.regles).map(k => [k, JSON.parse(JSON.stringify(REGLES[k]))])),
    taux: Object.fromEntries(RUBRIQUES.map(r => [r.id, r.tauxHoraireC])),
    taches: Object.fromEntries(RUBRIQUES.flatMap(r => r.taches.map(t => [`${r.id}/${t.id}`, { prixC: t.prixC, minutes: t.minutes }]))),
    elements: Object.fromEntries(ELEMENTS_TEXTILES.map(e => [e.id, e.prixC])) };
}
let derniere = null;

export async function ecranTarifs(vue, titre) {
  vue.innerHTML = `${titre}<p class="muet">Chargement des tarifs…</p>`;
  await chargerTarifs(supabase);
  const { data: historique } = await supabase.from("tarifs").select("version, publie_le, note, actif, donnees").order("version", { ascending: false }).limit(12);
  derniere = enVigueur();
  const R = derniere.regles;
  const champ = (cle, lib, val, pas = "0.01") => `<label class="champ"><span>${esc(lib)}</span><input type="number" step="${pas}" data-cle="${esc(cle)}" value="${esc(val)}"></label>`;
  const rubTaux = RUBRIQUES.filter(r => r.tauxHoraireC != null);
  vue.innerHTML = `${titre}
    <p class="muet">Version en vigueur : <b>${versionTarifs || "valeurs du code"}</b>. Une publication s'applique aux nouvelles demandes du site et à la vérification du prix avant paiement ; les demandes déjà enregistrées gardent leur prix. Montants en euros TTC.</p>
    <form id="form-tarifs" novalidate>
    <details class="carte" open><summary><b>Location courte durée</b></summary><div class="grille-tarifs">
      ${Object.entries(R.TAUX_LOCATION_C).map(([k, v]) => champ(`TAUX_LOCATION_C.${k}`, `${NOMS_LOC[k] || k} : prix de l'heure`, eur(v))).join("")}
      ${champ("SEJOUR_PCT.semaine", "Séjour de 5 à 9 nuits : temps en plus (%)", R.SEJOUR_PCT.semaine, "1")}${champ("SEJOUR_PCT.long", "Séjour de 10 nuits et plus : temps en plus (%)", R.SEJOUR_PCT.long, "1")}
      ${LINGE.map(([k, l]) => champ(k, l, eur(R[k]))).join("")}
      ${Object.entries(R.DRAPS_LAVERIE_C).map(([k, v]) => champ(`DRAPS_LAVERIE_C.${k}`, `Draps en laverie, lit ${{ un: "1 place", deux: "2 places", king: "king size" }[k]}`, eur(v))).join("")}</div></details>
    <details class="carte"><summary><b>Prix de l'heure et plancher par prestation</b></summary>
      <p class="petit">Plancher : prix de l'heure en dessous duquel aucune formule ne descend (le Cleaneur doit garder un revenu correct).</p>
      <table class="tableau-simple"><tr><th>Prestation</th><th>Prix de l'heure (€)</th><th>Plancher (€/h)</th></tr>
      ${rubTaux.map(r => `<tr><td>${esc(r.nom)}</td><td><input type="number" step="0.01" data-cle="taux.${r.id}" value="${eur(r.tauxHoraireC)}" style="width:110px"></td>
        <td>${R.PLANCHER_HORAIRE_C[r.id] != null ? `<input type="number" step="0.01" data-cle="PLANCHER_HORAIRE_C.${r.id}" value="${eur(R.PLANCHER_HORAIRE_C[r.id])}" style="width:110px">` : "—"}</td></tr>`).join("")}</table></details>
    <details class="carte"><summary><b>Minimums de commande</b></summary><div class="grille-tarifs">${MINIMUMS.map(([k, l]) => champ(k, l, eur(R[k]))).join("")}</div></details>
    <details class="carte"><summary><b>Frais, majorations, zones et formules</b></summary><div class="grille-tarifs">${POURCENTS.map(([k, l]) => champ(k, l, R[k], "1")).join("")}</div></details>
    <details class="carte"><summary><b>Abonnements des conciergeries (HT par mois)</b></summary>
      <table class="tableau-simple"><tr><th>Tranche</th><th>Jusqu'à (logements)</th><th>Forfait (€)</th><th>Par logement au-delà de (€)</th></tr>
      ${R.ABONNEMENTS_PRO.map((t, i) => `<tr><td>${t.id}</td><td>${t.max}</td><td><input type="number" step="0.01" data-cle="ABONNEMENTS_PRO.${i}.prixC" value="${eur(t.prixC)}" style="width:110px"></td>
        <td>${t.parLogementC != null ? `<input type="number" step="0.01" data-cle="ABONNEMENTS_PRO.${i}.parLogementC" value="${eur(t.parLogementC)}" style="width:110px"> <span class="petit">(> ${t.debut})</span>` : "—"}</td></tr>`).join("")}</table></details>
    <details class="carte"><summary><b>Prix des tâches et options</b></summary>
      ${RUBRIQUES.filter(r => r.taches.length).map(r => `<details><summary>${esc(r.nom)} (${r.taches.length})</summary><table class="tableau-simple"><tr><th>Tâche</th><th>Prix (€)</th><th>Minutes</th></tr>
        ${r.taches.map(t => `<tr><td>${esc(t.nom)}</td><td><input type="number" step="1" data-cle="tache.${r.id}/${t.id}.prixC" value="${eur(t.prixC)}" style="width:90px"></td>
          <td><input type="number" step="1" data-cle="tache.${r.id}/${t.id}.minutes" value="${t.minutes}" style="width:80px"></td></tr>`).join("")}</table></details>`).join("")}</details>
    <details class="carte"><summary><b>Prix à l'élément (canapés, matelas, tapis, hôtels et campings)</b></summary><div class="grille-tarifs">
      ${ELEMENTS_TEXTILES.map(e => champ(`element.${e.id}`, `${e.nom}${e.parM2 ? " (par m²)" : ""}`, eur(e.prixC))).join("")}</div></details>
    <label class="champ"><span>Note de version (ce qui change et pourquoi)</span><input name="note" maxlength="200" placeholder="Ex. : hausse de 2 % des taux en zone Standard"></label>
    <div class="boutons"><button type="button" class="bouton secondaire" id="apercu-tarifs">Aperçu et test de cohérence</button>
      <button type="submit" class="bouton plein" id="publier-tarifs" disabled>Publier ces tarifs</button></div>
    <div id="resultat-tarifs"></div></form>
    <h2 class="titre-section">Versions publiées</h2>
    ${(historique || []).length ? `<table class="tableau-simple"><tr><th>Version</th><th>Publiée le</th><th>Note</th><th></th></tr>${historique.map(h => `<tr><td>${h.version}${h.actif ? " · en vigueur" : ""}</td>
      <td>${new Date(h.publie_le).toLocaleString("fr-FR")}</td><td>${esc(h.note || "")}</td><td>${h.actif ? "" : `<button type="button" class="lien-bouton" data-revenir="${h.version}">Republier</button>`}</td></tr>`).join("")}</table>`
      : `<p class="petit">Aucune version publiée : le site utilise les valeurs du code.</p>`}`;
  stylesTarifs();
  const f = vue.querySelector("#form-tarifs"), res = vue.querySelector("#resultat-tarifs"), pub = vue.querySelector("#publier-tarifs");
  let brouillon = null;
  f.oninput = () => { pub.disabled = true; };
  vue.querySelector("#apercu-tarifs").onclick = () => {
    brouillon = lireFormulaire(f);
    const avant = CAS.map(prixCas);
    appliquerTarifs(brouillon, versionTarifs);
    const apres = CAS.map(prixCas), pb = coherence();
    appliquerTarifs(derniere, versionTarifs);
    res.innerHTML = `<div class="carte" style="margin-top:12px"><b>Aperçu sur des cas types</b>
      <table class="tableau-simple"><tr><th>Cas</th><th>Aujourd'hui</th><th>Après publication</th><th>Écart</th></tr>
      ${CAS.map(([n], i) => `<tr><td>${esc(n)}</td><td>${euros(avant[i])}</td><td><b>${euros(apres[i])}</b></td><td>${apres[i] === avant[i] ? "—" : `${apres[i] > avant[i] ? "+" : ""}${((apres[i] - avant[i]) / avant[i] * 100).toFixed(1)} %`}</td></tr>`).join("")}</table>
      ${pb.length ? `<p class="erreur"><b>Publication bloquée :</b> ${pb.slice(0, 6).map(esc).join(" ; ")}${pb.length > 6 ? ` … (${pb.length} problèmes)` : ""}</p>` : `<p class="succes">✓ Test de cohérence réussi : formules dans l'ordre et plancher respecté partout.</p>`}</div>`;
    pub.disabled = !!pb.length;
  };
  f.onsubmit = async e => {
    e.preventDefault();
    if (!brouillon || pub.disabled) return;
    if (!confirm("Publier ces tarifs ? Ils s'appliquent tout de suite aux nouvelles demandes.")) return;
    pub.disabled = true;
    const { data, error } = await supabase.rpc("publier_tarifs", { p_donnees: brouillon, p_note: f.note.value.trim() });
    if (error || !data) { res.insertAdjacentHTML("beforeend", `<p class="erreur">Publication refusée : ${esc(error?.message || "droits d'administration requis")}</p>`); pub.disabled = false; return; }
    await chargerTarifs(supabase);
    ecranTarifs(vue, titre);
  };
  vue.querySelectorAll("[data-revenir]").forEach(b => b.onclick = async () => {
    const h = historique.find(x => String(x.version) === b.dataset.revenir);
    if (!h || !confirm(`Republier la version ${h.version} ? Elle devient une nouvelle version en vigueur.`)) return;
    const { error } = await supabase.rpc("publier_tarifs", { p_donnees: h.donnees, p_note: `Retour à la version ${h.version}` });
    if (error) { alert(error.message); return; }
    await chargerTarifs(supabase); ecranTarifs(vue, titre);
  });
}

/** Formulaire → version de tarifs (montants saisis en euros, enregistrés en centimes). */
function lireFormulaire(f) {
  const d = JSON.parse(JSON.stringify(derniere));
  const c = v => Math.round(Number(String(v).replace(",", ".")) * 100), n = v => Number(String(v).replace(",", "."));
  f.querySelectorAll("[data-cle]").forEach(i => {
    if (i.value === "" || !Number.isFinite(n(i.value))) return;
    const k = i.dataset.cle, p = k.split(".");
    if (p[0] === "taux") d.taux[p[1]] = c(i.value);
    else if (p[0] === "tache") { const [id, champ] = [k.slice(6, k.lastIndexOf(".")), k.slice(k.lastIndexOf(".") + 1)]; d.taches[id][champ] = champ === "prixC" ? c(i.value) : Math.max(1, Math.round(n(i.value))); }
    else if (p[0] === "element") d.elements[p[1]] = c(i.value);
    else if (p[0] === "ABONNEMENTS_PRO") d.regles.ABONNEMENTS_PRO[Number(p[1])][p[2]] = c(i.value);
    else if (p.length === 2) d.regles[p[0]][p[1]] = /_C$/.test(p[0]) ? c(i.value) : n(i.value);
    else d.regles[k] = /_C$/.test(k) ? c(i.value) : n(i.value);
  });
  return d;
}

function stylesTarifs() {
  if (document.getElementById("styles-tarifs")) return;
  const s = document.createElement("style"); s.id = "styles-tarifs";
  s.textContent = `.grille-tarifs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:4px 14px;margin-top:10px}
    #form-tarifs details.carte{margin-bottom:10px}#form-tarifs details details{margin:8px 0}#form-tarifs .succes{color:var(--succes,#1f8a5b);font-weight:700}`;
  document.head.appendChild(s);
}
