// Fin de prestation côté client : « Valider la prestation », note en étoiles (1 à 5), commentaire et pourboire (100 % pour le Cleaneur).
// Validation automatique 48 h après la fin (REGLES.VALIDATION_AUTO_H) ; note possible pendant REGLES.AVIS_DELAI_JOURS jours.
// Même écran dans l'appli (Avis.kt). Le pourboire sera débité avec le paiement en ligne.
import { supabase } from "./donnees.js";
import { REGLES, euros } from "./regles.js";
import { traduire, tr } from "./langue.js";

const rpc = async (nom, args) => { const { data, error } = await supabase.rpc(nom, args); if (error) throw new Error(error.message); return data; };

/** Bloc à afficher sur la page de suivi d'une demande (statut À valider ou Terminée). */
export async function blocAvis(boite, reference, jeton, statut) {
  if (!boite || !["A_VALIDER", "TERMINEE"].includes(statut)) return;
  styles();
  const deja = await rpc("avis_de", { p_reference: reference, p_jeton: jeton }).catch(() => null);
  if (!boite.isConnected) return;
  if (deja?.note) {
    boite.innerHTML = `<div class="carte avis-donne"><b>${tr("Merci pour votre avis !")}</b>
      <p class="etoiles-fixes" aria-label="${deja.note} / 5">${"★".repeat(deja.note)}${"☆".repeat(5 - deja.note)}</p>
      ${deja.commentaire ? `<p class="petit">« ${deja.commentaire.replace(/[<>&]/g, "")} »</p>` : ""}
      ${deja.pourboire_c ? `<p class="petit">${tr("Pourboire pour votre Cleaneur :")} <b>${euros(deja.pourboire_c)}</b></p>` : ""}</div>`;
    traduire(boite);
    return;
  }
  let note = 0, pourboire = 0;
  boite.innerHTML = `<div class="carte avis-form">
    <b>${tr(statut === "A_VALIDER" ? "Votre ménage est terminé : validez-le" : "Notez votre ménage")}</b>
    ${statut === "A_VALIDER" ? `<p class="petit" style="margin:4px 0 0">${tr("Sans réponse, la prestation est validée automatiquement")} ${REGLES.VALIDATION_AUTO_H} h ${tr("après la fin du ménage.")}</p>` : ""}
    <div class="etoiles" role="radiogroup" aria-label="${tr("Note")}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-etoile="${n}" aria-label="${n} / 5">☆</button>`).join("")}</div>
    <label class="champ">${tr("Un mot pour votre Cleaneur (facultatif)")}<textarea maxlength="1000" rows="2" data-commentaire></textarea></label>
    <p style="margin:8px 0 4px;font-weight:600">${tr("Laisser un pourboire ?")} <span class="petit">${tr("100 % pour votre Cleaneur")}</span></p>
    <div class="pourboires">${[0, ...REGLES.POURBOIRE_CHOIX_C].map(c => `<button type="button" data-pourboire="${c}" class="${c === 0 ? "choisi" : ""}">${c ? euros(c) : tr("Non merci")}</button>`).join("")}
      <label class="pourboire-libre">${tr("Autre")}<input type="number" min="1" max="200" step="1" inputmode="numeric" data-pourboire-libre placeholder="€"></label></div>
    <p class="erreur" data-erreur-avis></p>
    <button type="button" class="bouton plein" data-valider-avis>${tr(statut === "A_VALIDER" ? "Valider la prestation" : "Envoyer mon avis")}</button></div>`;
  traduire(boite);
  const dessinerEtoiles = () => boite.querySelectorAll("[data-etoile]").forEach(b => { b.textContent = Number(b.dataset.etoile) <= note ? "★" : "☆"; b.classList.toggle("allumee", Number(b.dataset.etoile) <= note); });
  boite.querySelectorAll("[data-etoile]").forEach(b => b.onclick = () => { note = Number(b.dataset.etoile); dessinerEtoiles(); });
  boite.querySelectorAll("[data-pourboire]").forEach(b => b.onclick = () => {
    pourboire = Number(b.dataset.pourboire);
    boite.querySelector("[data-pourboire-libre]").value = "";
    boite.querySelectorAll("[data-pourboire]").forEach(x => x.classList.toggle("choisi", x === b));
  });
  boite.querySelector("[data-pourboire-libre]").oninput = e => {
    pourboire = Math.round(Math.max(0, Math.min(200, Number(e.target.value) || 0)) * 100);
    boite.querySelectorAll("[data-pourboire]").forEach(x => x.classList.remove("choisi"));
  };
  boite.querySelector("[data-valider-avis]").onclick = async e => {
    const err = boite.querySelector("[data-erreur-avis]");
    if (statut === "TERMINEE" && !note) { err.textContent = tr("Choisissez une note de 1 à 5 étoiles."); return; }
    e.target.disabled = true;
    const r = await rpc("valider_prestation", { p_reference: reference, p_jeton: jeton, p_note: note || null,
      p_commentaire: boite.querySelector("[data-commentaire]").value.trim(), p_pourboire_c: pourboire }).catch(() => "erreur");
    if (r !== "ok") { e.target.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    if (statut === "A_VALIDER") location.reload(); else blocAvis(boite, reference, jeton, "TERMINEE");
  };
}

function styles() {
  if (document.getElementById("style-avis")) return;
  const st = document.createElement("style");
  st.id = "style-avis";
  st.textContent = `.avis-form, .avis-donne { margin: 12px 0; border: 1px solid color-mix(in srgb, var(--or) 45%, transparent); }
  .etoiles { display: flex; gap: 6px; margin: 10px 0; }
  .etoiles button { font-size: 34px; line-height: 1; background: none; border: 0; cursor: pointer; color: var(--texte3); padding: 2px; transition: transform .15s; }
  .etoiles button.allumee { color: #F5B301; transform: scale(1.08); }
  .etoiles-fixes { font-size: 26px; color: #F5B301; margin: 6px 0; letter-spacing: 2px; }
  .pourboires { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
  .pourboires button { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--separateur); background: var(--surface); color: var(--texte); font-weight: 700; cursor: pointer; }
  .pourboires button.choisi { background: var(--primaire); border-color: var(--primaire); color: #fff; }
  .pourboire-libre { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
  .pourboire-libre input { width: 80px; min-height: 40px; border-radius: 10px; border: 1px solid var(--separateur); padding: 0 8px; background: var(--surface); color: var(--texte); }`;
  document.head.appendChild(st);
}
