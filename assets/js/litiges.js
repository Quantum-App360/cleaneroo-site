// Litiges et Garantie Cleaneroo (11 novembre 2026, repris de l'appli iPhone de Vincent).
// Sur la page de suivi d'une prestation terminée : « Signaler un problème » (prestation incomplète, non conforme, autre)
// ou « Déclarer un dommage » (Garantie Cleaneroo, plafond 3 000 €), dans les 48 h après la fin, avec description et photos.
// Tant que le signalement est ouvert, la prestation n'est pas validée automatiquement. Décision dans gestion.html (onglet Litiges).
// Même écran dans l'appli (Litiges.kt). Base : outils/base-litiges.sql.
import { supabase, reduirePhoto } from "./donnees.js";
import { REGLES, euros, dateLongue } from "./regles.js";
import { traduire, tr } from "./langue.js";

export const MOTIFS_LITIGE = [["INCOMPLETE", "Prestation incomplète"], ["NON_CONFORME", "Prestation non conforme"], ["AUTRE", "Autre"]];
export const STATUTS_LITIGE = { OUVERT: "En cours d'examen", REPRISE_GRATUITE: "Reprise gratuite", REMBOURSEMENT: "Remboursement", INDEMNISATION: "Indemnisation", REFUSE: "Refusé" };
const MESSAGES = {
  etape: "Un problème ne peut être signalé qu'après la fin du ménage.",
  delai: "Le délai de 48 h après la fin du ménage est dépassé. Écrivez à contact@cleaneroo.fr.",
  deja: "Un signalement est déjà en cours d'examen pour cette prestation.",
  description: "Décrivez le problème en au moins 20 caractères.",
  montant: "Indiquez le montant estimé du dommage (3 000 € maximum).",
};

const MOTIFS_ACCES = { ABSENT: "Client absent", CLE_INTROUVABLE: "Clé ou code introuvable", ACCES_REFUSE: "Accès refusé", DANGEREUX: "Logement inaccessible ou dangereux" };

export async function blocLitige(boite, reference, jeton, statut) {
  if (!boite || !["A_VALIDER", "TERMINEE", "ANNULEE"].includes(statut)) return;
  // Mission annulée : seulement si le Cleaneur a déclaré l'accès impossible (le client peut contester sous 48 h).
  const acces = statut === "ANNULEE" ? (await supabase.rpc("acces_impossible_de", { p_reference: reference, p_jeton: jeton })).data : null;
  if (statut === "ANNULEE" && !acces) return;
  const { data: liste } = await supabase.rpc("litiges_de", { p_reference: reference, p_jeton: jeton });
  if (!boite.isConnected) return;
  const infoAcces = acces ? `<div class="carte" style="margin:12px 0;border-color:var(--erreur)"><b>${tr("Accès impossible déclaré par le Cleaneur")}</b>
    <p class="petit" style="margin:4px 0 0">${dateLongue(new Date(acces.le))} · ${tr(MOTIFS_ACCES[acces.motif] || "Autre")}${acces.note ? ` · « ${String(acces.note).replace(/[<>&]/g, "")} »` : ""}</p>
    <p class="petit" style="margin:4px 0 0">${tr("Indemnité due au Cleaneur :")} <b>${euros(acces.indemnite_c)}</b>. ${tr("Vous pouvez la contester ci-dessous dans les 48 h.")}</p></div>` : "";
  const ouverts = (liste || []).filter(l => l.statut === "OUVERT");
  const suivi = (liste || []).map(l => `<div class="petit" style="margin-top:6px">${dateLongue(new Date(l.cree_le))} · ${l.genre === "DOMMAGE" ? tr("Dommage") : tr(MOTIFS_LITIGE.find(m => m[0] === l.motif)?.[1] || "Autre")}
    · <b>${tr(STATUTS_LITIGE[l.statut])}</b>${l.montant_decide_c ? ` · ${euros(l.montant_decide_c)}` : ""}${l.decision ? `<br>${l.decision.replace(/[<>&]/g, "")}` : ""}</div>`).join("");
  boite.innerHTML = infoAcces + `<details class="carte" style="margin:12px 0" ${ouverts.length || acces ? "open" : ""}><summary>${acces ? "Contester" : "Un problème avec ce ménage ?"}</summary>
    ${suivi ? `<div style="margin:8px 0">${suivi}</div>` : ""}
    ${ouverts.length ? `<p class="petit">Votre signalement est en cours d'examen : la prestation n'est pas validée automatiquement en attendant. Réponse sous 72 h.</p>` : `
    <p class="petit" style="margin:8px 0">Dans les ${REGLES.GARANTIE_DECLARATION_H} h après la fin du ménage, signalez un problème ou déclarez un dommage (Garantie Cleaneroo, jusqu'à ${euros(REGLES.GARANTIE_PLAFOND_C)}). Nous examinons votre demande sous 72 h.</p>
    <form data-form-litige novalidate>
      <div class="segments" style="margin-bottom:10px"><button type="button" data-genre="LITIGE" class="choisi">Signaler un problème</button><button type="button" data-genre="DOMMAGE">Déclarer un dommage</button></div>
      <label class="champ" data-champ-motif>Motif<select name="motif">${MOTIFS_LITIGE.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("")}</select></label>
      <label class="champ" data-champ-montant style="display:none">Montant estimé du dommage (€)<input name="montant" type="number" min="1" max="${REGLES.GARANTIE_PLAFOND_C / 100}" inputmode="numeric"></label>
      <label class="champ">Décrivez ce qui s'est passé<textarea name="description" rows="3" maxlength="2000"></textarea></label>
      <label class="bouton secondaire">Ajouter des photos<input type="file" accept="image/*" multiple hidden name="photos"></label>
      <p class="petit" data-nb-photos></p>
      <p class="erreur" data-erreur-litige></p>
      <button type="submit" class="bouton plein">Envoyer</button></form>`}</details>`;
  traduire(boite);
  const f = boite.querySelector("[data-form-litige]");
  if (!f) return;
  let genre = "LITIGE";
  boite.querySelectorAll("[data-genre]").forEach(b => b.onclick = () => {
    genre = b.dataset.genre;
    boite.querySelectorAll("[data-genre]").forEach(x => x.classList.toggle("choisi", x === b));
    boite.querySelector("[data-champ-motif]").style.display = genre === "DOMMAGE" ? "none" : "";
    boite.querySelector("[data-champ-montant]").style.display = genre === "DOMMAGE" ? "" : "none";
  });
  f.photos.onchange = () => { boite.querySelector("[data-nb-photos]").textContent = f.photos.files.length ? `${Math.min(6, f.photos.files.length)} photo(s)` : ""; };
  f.onsubmit = async e => {
    e.preventDefault();
    const err = boite.querySelector("[data-erreur-litige]");
    const description = f.description.value.trim();
    if (description.length < 20) { err.textContent = tr(MESSAGES.description); return; }
    const montant = Math.round((Number(f.montant.value) || 0) * 100);
    if (genre === "DOMMAGE" && (montant <= 0 || montant > REGLES.GARANTIE_PLAFOND_C)) { err.textContent = tr(MESSAGES.montant); return; }
    f.querySelector("[type=submit]").disabled = true;
    err.textContent = tr("Envoi en cours…");
    const chemins = [];
    for (const [i, fichier] of [...f.photos.files].slice(0, 6).entries()) {
      const chemin = `${reference}/litige-${Date.now()}-${i + 1}.jpg`;
      const { error } = await supabase.storage.from("photos-demandes").upload(chemin, await reduirePhoto(fichier), { contentType: "image/jpeg" });
      if (!error) chemins.push(chemin);
    }
    const { data, error } = await supabase.rpc("ouvrir_litige", { p_reference: reference, p_jeton: jeton, p_genre: genre,
      p_motif: genre === "DOMMAGE" ? "DOMMAGE" : f.motif.value, p_description: description, p_montant_c: genre === "DOMMAGE" ? montant : null, p_photos: chemins });
    if (error || data !== "ok") {
      f.querySelector("[type=submit]").disabled = false;
      err.textContent = tr(MESSAGES[data] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
      return;
    }
    blocLitige(boite, reference, jeton, statut);
  };
}
