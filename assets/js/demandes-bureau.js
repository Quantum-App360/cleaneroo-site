// « Mes prestations » sur ordinateur (26/11/2026, retours de Michael) : un tableau lisible d'un coup d'œil (date, prestation,
// lieu, Cleaneur, statut, montant) et, à droite, le détail de la prestation choisie, sans quitter la liste.
// Sous 1100 px (ou sans menu latéral), la liste en cartes reste affichée : voir compte.js.
// Uniquement des données réelles : le prénom du Cleaneur vient de infos_fil (même source que l'en-tête des messages).
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { euros, dateCourte, dateLongue, heure, duree } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { nomLogement } from "./reserver.js";

const STATUTS = { VERIFICATION: "En cours de vérification", PUBLIEE: "Recherche d'un Cleaneur", CONFIRMEE: "Confirmée", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée", ANNULEE: "Annulée" };
const ORDRE = ["VERIFICATION", "PUBLIEE", "CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS", "A_VALIDER", "TERMINEE"];
/** Teinte de la puce de statut. */
export const teinteStatut = s => s === "ANNULEE" ? "gris" : s === "TERMINEE" ? "vert" : ["VERIFICATION", "PUBLIEE", "A_VALIDER"].includes(s) ? "corail" : "bleu";

/** Lieu affiché : le nom du bien enregistré à cette adresse, sinon la ville. */
export function lieuDemande(d, biens = []) {
  const l = biens.find(x => (x.rue || "").trim().toLowerCase() === (d.rue || "").trim().toLowerCase() && x.codePostal === (d.code_postal || d.codePostal));
  return l ? nomLogement(l) : (d.ville || "");
}

/** Étapes de la prestation, cochées selon le statut réel (aucune date inventée : seule la réservation est datée). */
export function etapesDemande(d) {
  const i = ORDRE.indexOf(d.statut);
  const e = (fait, ici) => fait ? "fait" : ici ? "ici" : "";
  return [
    ["Réservée", d.cree_le ? dateLongue(new Date(d.cree_le)) : "", "fait"],
    ["Cleaneur confirmé", "", e(i >= 2, i < 2)],
    ["Intervention", "", e(i >= 6, i >= 3 && i <= 5)],
    ["Compte rendu à valider", "", e(i >= 7, i === 6)],
    ["Terminée", "", e(i === 7, false)],
  ];
}

let derniereChoisie = null;
const quand = d => d.creneau ? new Date(d.creneau) : null;

export function tableauDemandes(liste, biens, choisie) {
  return `<div class="maitre-detail">
    <div class="maitre-colonne"><div class="outils-demandes">
      <label class="recherche-demandes"><input type="search" data-filtre-texte placeholder="${esc(tr("Rechercher une prestation, une ville, une référence"))}" aria-label="${esc(tr("Rechercher une prestation"))}"></label>
      ${biens.length > 1 ? `<select data-filtre-bien aria-label="${esc(tr("Filtrer par bien"))}"><option value="">${tr("Tous mes biens")}</option>${biens.map((l, i) => `<option value="${i}">${esc(nomLogement(l))}</option>`).join("")}</select>` : ""}
    </div>
    <table class="table-demandes"><thead><tr><th>${tr("Date")}</th><th>${tr("Prestation")}</th><th>${tr("Lieu")}</th><th>${tr("Cleaneur")}</th><th>${tr("Statut")}</th><th class="droite">${tr("Montant")}</th></tr></thead>
    <tbody>${liste.map(d => { const r = rubrique(d.rubrique_id) || { nom: d.rubrique_id, icone: "termine" }, q = quand(d);
      return `<tr tabindex="0" data-ref="${esc(d.reference)}" class="${d.reference === choisie ? "choisie" : ""}" data-texte="${esc(`${r.nom} ${d.ville || ""} ${d.reference} ${lieuDemande(d, biens)}`.toLowerCase())}" data-adresse="${esc(`${(d.rue || "").trim().toLowerCase()}|${d.code_postal || d.codePostal || ""}`)}">
        <td><b>${q ? esc(dateCourte(q)) : tr("Date à fixer")}</b><small>${q ? heure(q.getHours(), q.getMinutes()) : ""}${d.duree_min ? ` · ${duree(d.duree_min)}` : ""}</small></td>
        <td><span class="presta-cellule">${icone(r.icone)}<span>${esc(tr(r.nom))}<small>${tr("Réf.")} ${esc(d.reference)}</small></span></span></td>
        <td>${esc(lieuDemande(d, biens))}</td>
        <td data-cleaneur-de="${esc(d.reference)}">${d.cleaneur_id ? "…" : `<span class="muet">${"–"}</span>`}</td>
        <td><span class="puce-statut ${teinteStatut(d.statut)}">${tr(STATUTS[d.statut] || d.statut)}</span></td>
        <td class="montant">${d.sur_devis ? tr("Sur devis") : euros(d.estimation_c)}</td></tr>`; }).join("")}</tbody></table>
    <p class="petit muet aucun-resultat" hidden>${tr("Aucune prestation ne correspond à votre recherche.")}</p></div>
    <aside class="detail-demande carte" aria-live="polite"></aside></div>`;
}

function detailHtml(d, biens, avec) {
  const r = rubrique(d.rubrique_id) || { nom: d.rubrique_id, icone: "termine" }, q = quand(d);
  const suivi = `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton || "")}`;
  return `<span class="puce-statut ${teinteStatut(d.statut)}">${tr(STATUTS[d.statut] || d.statut)}</span>
    <h2>${icone(r.icone)} ${esc(tr(r.nom))}</h2>
    <p class="petit muet" style="margin:0">${q ? `${esc(dateLongue(q))} · ${heure(q.getHours(), q.getMinutes())}` : tr("Date à fixer")} · ${esc(lieuDemande(d, biens))}</p>
    <p class="petit muet" style="margin:2px 0 0">${tr("Réf.")} ${esc(d.reference)}</p>
    ${d.statut === "ANNULEE" ? "" : `<ol class="etapes-demande">${etapesDemande(d).map(([t, sous, e]) => `<li class="${e}"><span>${tr(t)}${sous ? `<small>${esc(sous)}</small>` : ""}</span></li>`).join("")}</ol>`}
    ${d.cleaneur_id ? `<div class="cleaneur-demande"><span class="avatar-demande">${esc((avec || "?").charAt(0).toUpperCase())}</span><div><b>${esc(avec || tr("Votre Cleaneur"))}</b><small>${tr("Votre Cleaneur pour cette prestation")}</small></div></div>` : ""}
    <div class="somme-demande"><span>${tr(d.sur_devis ? "Prix" : "Montant estimé")}</span><b>${d.sur_devis ? tr("Sur devis") : euros(d.estimation_c)}</b></div>
    <div class="actions-demande">
      <a class="bouton plein" href="${suivi}">${icone("document")} ${tr("Ouvrir le suivi")}</a>
      ${d.cleaneur_id && d.statut !== "ANNULEE" ? `<a class="bouton secondaire" href="#/messages/${encodeURIComponent(d.reference)}">${icone("message")} ${tr("Écrire à")} ${esc(avec || tr("mon Cleaneur"))}</a>` : ""}
      <p class="petit muet" style="margin:4px 0 0;text-align:center">${tr("Modifier, accès et clés, annulation : depuis le suivi.")}</p>
    </div>`;
}

export function brancherTableauDemandes(vue, liste, biens) {
  const boite = vue.querySelector(".maitre-detail");
  if (!boite) return;
  const panneau = boite.querySelector(".detail-demande");
  const prenoms = new Map();
  const choisir = ref => {
    const d = liste.find(x => x.reference === ref);
    if (!d) return;
    derniereChoisie = ref;
    boite.querySelectorAll("tbody tr").forEach(tr_ => tr_.classList.toggle("choisie", tr_.dataset.ref === ref));
    panneau.innerHTML = detailHtml(d, biens, prenoms.get(ref));
    traduire(panneau);
  };
  boite.querySelector("tbody").addEventListener("click", e => { const l = e.target.closest("tr[data-ref]"); if (l) choisir(l.dataset.ref); });
  boite.querySelector("tbody").addEventListener("keydown", e => { const l = e.target.closest("tr[data-ref]"); if (l && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choisir(l.dataset.ref); } });
  boite.querySelector("tbody").addEventListener("dblclick", e => { const l = e.target.closest("tr[data-ref]"); const d = l && liste.find(x => x.reference === l.dataset.ref); if (d) location.hash = `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton || "")}`; });
  // Filtres : texte libre et bien.
  const texte = boite.querySelector("[data-filtre-texte]"), bien = boite.querySelector("[data-filtre-bien]");
  const filtrer = () => {
    const t = (texte?.value || "").trim().toLowerCase();
    const l = bien && bien.value !== "" ? biens[+bien.value] : null;
    const cle = l ? `${(l.rue || "").trim().toLowerCase()}|${l.codePostal || ""}` : null;
    let n = 0;
    boite.querySelectorAll("tbody tr").forEach(r => { const ok = (!t || r.dataset.texte.includes(t)) && (!cle || r.dataset.adresse === cle); r.hidden = !ok; if (ok) n++; });
    boite.querySelector(".aucun-resultat").hidden = n > 0;
  };
  texte?.addEventListener("input", filtrer); bien?.addEventListener("change", filtrer);
  choisir(liste.some(d => d.reference === derniereChoisie) ? derniereChoisie : liste[0]?.reference);
  // Prénom des Cleaneurs attribués (infos_fil), au plus 30 lignes.
  liste.filter(d => d.cleaneur_id).slice(0, 30).forEach(d => supabase.rpc("infos_fil", { p_fil: d.reference }).then(({ data }) => {
    const nom = data?.avec || "";
    prenoms.set(d.reference, nom);
    const c = boite.querySelector(`[data-cleaneur-de="${CSS.escape(d.reference)}"]`);
    if (c) c.textContent = nom || tr("Attribué");
    if (boite.querySelector("tr.choisie")?.dataset.ref === d.reference) choisir(d.reference);
  }).catch(() => { const c = boite.querySelector(`[data-cleaneur-de="${CSS.escape(d.reference)}"]`); if (c) c.textContent = tr("Attribué"); }));
}
