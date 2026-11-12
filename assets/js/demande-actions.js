// Modifier une demande publiée et bon d'intervention (12 novembre 2026, repris de l'appli iPhone de Vincent).
// - Modifier (VERIFICATION ou PUBLIEE, aucun Cleaneur confirmé) : nouvelle date/heure et remarque ; la demande repasse en
//   vérification Cleaneroo, les propositions en attente sont retirées et leurs Cleaneurs prévenus (modifier_demande).
// - Bon d'intervention : document imprimable / PDF (client et Cleaneur), sans codes d'accès (bon_intervention).
// Même chose dans l'appli (DemandeActions.kt). Base : outils/base-modifier-bon.sql.
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { euros, dateLongue, heure, duree } from "./regles.js";
import { tr, traduire, langue } from "./langue.js";
import { libelleStatut } from "./app.js";
import { esc } from "./commun.js";

const hd = d => heure(d.getHours(), d.getMinutes());
const local = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

/** Formulaire « Modifier ma demande » (page de suivi). */
export function blocModifier(boite, d, ref, jeton, apres) {
  if (!boite || !["VERIFICATION", "PUBLIEE"].includes(d.statut)) return;
  boite.innerHTML = `<details class="carte" style="margin:12px 0"><summary><b>✏️ ${tr("Modifier ma demande")}</b></summary>
    <p class="petit">${tr("La demande sera vérifiée à nouveau par Cleaneroo ; les propositions en attente sont retirées et les Cleaneurs concernés prévenus.")}</p>
    <form novalidate><label class="champ">${tr("Date et heure")}<input name="creneau" type="datetime-local" value="${d.creneau ? local(d.creneau) : ""}"></label>
    <label class="champ">${tr("Remarque pour le Cleaneur (facultatif)")}<textarea name="remarque" maxlength="1000" rows="3"></textarea></label>
    <p class="erreur"></p><button class="bouton" type="submit">${tr("Enregistrer les modifications")}</button></form></details>`;
  traduire(boite);
  const f = boite.querySelector("form");
  f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector(".erreur");
    if (!f.creneau.value) { err.textContent = tr("Choisissez une date et une heure."); return; }
    const { data, error } = await supabase.rpc("modifier_demande", { p_reference: ref, p_jeton: jeton, p_creneau: new Date(f.creneau.value).toISOString(), p_remarque: f.remarque.value.trim() });
    const r = error ? "erreur" : data;
    if (r === "ok") return apres();
    err.textContent = tr({ creneau: "Choisissez un créneau au moins 3 heures à l'avance.", statut: "Un Cleaneur est déjà confirmé : contactez le support pour modifier." }[r]
      || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}

/** Ouvre le bon d'intervention dans une fenêtre imprimable (Enregistrer en PDF). */
export async function ouvrirBon(ref, jeton = null) {
  const fen = window.open("", "_blank");
  const { data: b } = await supabase.rpc("bon_intervention", { p_reference: ref, p_jeton: jeton });
  if (!fen) return;
  if (!b) { fen.document.body.textContent = tr("Bon d'intervention indisponible."); return; }
  const e = b.etapes || {}, h = k => e[k] ? hd(new Date(e[k])) : "—";
  const ligne = (a, v) => `<tr><th>${esc(tr(a))}</th><td>${v}</td></tr>`;
  fen.document.write(`<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><title>${esc(tr("Bon d'intervention"))} ${esc(b.reference)}</title>
    <style>body{font-family:"Plus Jakarta Sans",Arial,sans-serif;color:#10302f;max-width:720px;margin:32px auto;padding:0 16px}
    h1{color:#0f8f86;font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #dfe9e8;vertical-align:top}
    th{width:40%;color:#4c6664;font-weight:600}.pied{font-size:12px;color:#4c6664;margin-top:24px}.sig{display:flex;gap:16px;margin-top:24px}.sig div{flex:1;border:1px solid #dfe9e8;border-radius:10px;height:90px;padding:8px;font-size:12px;color:#4c6664}
    @media print{button{display:none}}</style></head><body>
    <p style="margin:0 0 4px;font-weight:800;color:#0f8f86">Cleaneroo</p><h1>${esc(tr("Bon d'intervention"))}</h1><p>${esc(b.reference)}</p>
    <table>${ligne("Prestation", esc(tr(rubrique(b.rubrique_id)?.nom || b.rubrique_id)))}
    ${ligne("Client", esc(b.client))}${ligne("Adresse", `${esc(b.rue)}, ${esc(b.code_postal)} ${esc(b.ville)}`)}
    ${ligne("Date prévue", b.creneau ? `${esc(dateLongue(new Date(b.creneau)))} · ${hd(new Date(b.creneau))}` : "—")}
    ${ligne("Durée estimée", esc(duree(b.duree_min)))}${ligne("Cleaneur", esc(b.cleaneur || "—") + (b.siret_cleaneur ? ` · SIRET ${esc(b.siret_cleaneur)}` : ""))}
    ${ligne("Arrivée", h("sur_place"))}${ligne("Début", h("debut"))}${ligne("Fin", h("fin"))}
    ${b.taches?.length ? ligne("Tâches", esc(b.taches.join(", "))) : ""}${b.remarque ? ligne("Remarque", esc(b.remarque)) : ""}
    ${ligne("Montant", euros(b.estimation_c))}${b.credit_impot_c ? ligne("Crédit d'impôt estimé", euros(b.credit_impot_c)) : ""}
    ${ligne("Statut", esc(tr(libelleStatut(b.statut))))}</table>
    <div class="sig"><div>${esc(tr("Signature du client"))}</div><div>${esc(tr("Signature du Cleaneur"))}</div></div>
    <p class="pied">${esc(tr("Document généré par Cleaneroo — interventions de ménage digitalisées."))} cleaneroo.fr</p>
    <button onclick="print()">${esc(tr("Imprimer ou enregistrer en PDF"))}</button></body></html>`);
  fen.document.close();
}

/** Bouton « Bon d'intervention (PDF) ». */
export const boutonBon = (ref, jeton = "") => `<button type="button" class="bouton secondaire" data-bon="${esc(ref)}" data-bon-jeton="${esc(jeton)}">🧾 ${tr("Bon d'intervention (PDF)")}</button>`;
export function brancherBons(boite) {
  boite?.querySelectorAll("[data-bon]").forEach(b => b.onclick = () => ouvrirBon(b.dataset.bon, b.dataset.bonJeton || null));
}
