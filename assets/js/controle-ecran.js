// Écrans du contrôle de fin de mission, pièce par pièce (même déroulé dans l'appli : ControlePieces.kt) :
// Cleaneur : tâches cochées › photo après › contrôle IA (écart → reprendre la photo ou justifier). Photo avant seulement si la
// réservation coche « Photos avant exigées » ; sinon « Signaler un problème à l'arrivée » (dégât, saleté, casse) avec photo au besoin.
// Client : compte rendu (signalements d'arrivée, photos, tâches, avis de l'IA, justification).
import { blocLitige } from "./litiges.js";
import { icone } from "./icones.js";
import { traduire, tr, langue } from "./langue.js";
import { piecesDe, pieceComplete } from "./controle.js";
import { blocSupplementCleaneur } from "./supplement.js";
import { controlesDe, enregistrerPieces, majPiece, deposerPhotoControle, lienPhotoControle, controleIA, signalerArrivee, signalementsDe } from "./donnees.js";
import { chargeur } from "./commun.js";
import { blocAvis } from "./avis.js";
import { suivre } from "./donnees.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const L = langue in { fr: 1, en: 1, it: 1, es: 1 } ? langue : "fr";
const GRAVITE = { faible: "Faible", moyenne: "Moyenne", forte: "Forte" };
const TYPES_SIGNAL = [["degat", "Dégât"], ["salete", "Saleté exceptionnelle"], ["casse", "Objet cassé"], ["autre", "Autre"]];

/** Signalements d'arrivée (Cleaneur et client) : type, texte, photo. */
async function listeSignalements(reference) {
  const liste = await signalementsDe(reference).catch(() => []);
  const liens = {};
  await Promise.all(liste.filter(s => s.photo).map(async s => { liens[s.photo] = await lienPhotoControle(s.photo).catch(() => ""); }));
  return liste.length ? `<div class="signalements">${liste.map(s => `<div class="signalement">${s.photo && liens[s.photo] ? `<a href="${esc(liens[s.photo])}" target="_blank" rel="noopener"><img src="${esc(liens[s.photo])}" alt=""></a>` : ""}
    <div><b>⚠️ ${tr((TYPES_SIGNAL.find(t => t[0] === s.type) || [, "Autre"])[1])}</b><p class="petit" style="margin:2px 0 0">${esc(s.texte)}</p>
      <span class="petit">${new Date(s.cree_le).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></div></div>`).join("")}</div>` : "";
}

/** Avis de l'IA dans la langue de l'écran. */
function avisIA(c) {
  const r = c.ia_resultat || {};
  if (c.ia_statut === "en_cours") return `<div class="ia ia-cours">${chargeur("L'IA vérifie la pièce…", { petit: true, variante: "vitre" })}</div>`;
  if (c.ia_statut === "ok") return `<div class="ia ia-ok">${icone("valide")}<div><b>${tr("Contrôle IA : rien à signaler")}</b>${r[`resume_${L}`] ? `<p>${esc(r[`resume_${L}`])}</p>` : ""}</div></div>`;
  if (c.ia_statut === "ecart") return `<div class="ia ia-ecart">${icone("avis")}<div><b>${tr("L'IA a repéré un écart")}</b>
      ${r.meme_piece === false ? `<p>${tr("Les deux photos ne semblent pas montrer la même pièce, ou la photo est inutilisable.")}</p>` : ""}
      <ul>${(r.ecarts || []).map(e => `<li><span class="gravite g-${esc(e.gravite)}">${tr(GRAVITE[e.gravite] || e.gravite)}</span> ${esc(e[`probleme_${L}`] || e.probleme_fr)}</li>`).join("")}</ul></div></div>`;
  if (c.ia_statut === "erreur") return `<div class="ia ia-erreur">${icone("avis")}<div><b>${tr("Contrôle IA indisponible pour cette pièce")}</b><p>${tr("Décrivez en quelques mots l'état de la pièce pour continuer.")}</p></div></div>`;
  return "";
}

/* ------------------------------------------------------------------ Cleaneur */
/** Bloc du contrôle dans la carte d'une mission sur place / en cours ; surFin(toutComplet) met à jour « J'ai terminé ». */
export async function brancherControle(boite, m, surFin) {
  boite.innerHTML = chargeur("Préparation de la liste des pièces…", { petit: true, variante: "eponge" });
  let liste = await controlesDe(m.reference).catch(() => null);
  if (liste && !liste.length) {
    await enregistrerPieces(m.reference, piecesDe(m.rubrique_id, m.details || {})).catch(() => null);
    liste = await controlesDe(m.reference).catch(() => null);
  }
  if (!liste) { boite.innerHTML = `<p class="erreur">${tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")}</p>`; return; }
  const photos = {};
  await Promise.all(liste.flatMap(c => [c.photo_avant, c.photo_apres].filter(Boolean).map(async p => { photos[p] = await lienPhotoControle(p).catch(() => ""); })));
  const avantExigee = !!(m.details || {}).photosAvantExigees;
  const complete = c => pieceComplete(c, avantExigee);
  const faites = liste.filter(complete).length;
  const ouverte = liste.find(c => !complete(c))?.piece_id;
  const signalements = await listeSignalements(m.reference);
  boite.innerHTML = `<div class="controle">
    <details class="signaler-arrivee"><summary>⚠️ ${tr("Signaler un problème à l'arrivée")}</summary>
      <p class="petit" style="margin:6px 0">${tr("Dégât, saleté exceptionnelle, objet cassé : signalez-le avant de commencer. Le client le voit dans le compte rendu.")}</p>
      <div class="choix-signal">${TYPES_SIGNAL.map(([id, nom], i) => `<label class="case"><input type="radio" name="type-signal" value="${id}" ${i === 0 ? "checked" : ""}><span>${tr(nom)}</span></label>`).join("")}</div>
      <label class="champ">${tr("Ce que vous constatez")}<textarea maxlength="600" rows="2" data-texte-signal></textarea></label>
      <label class="bouton secondaire">📷 ${tr("Ajouter une photo")}<input type="file" accept="image/*" capture="environment" hidden data-photo-signal></label>
      <span class="petit" data-nom-photo-signal></span>
      <button type="button" class="bouton" data-envoyer-signal style="margin-top:8px">${tr("Envoyer le signalement")}</button>
      <p class="erreur" data-erreur-signal></p></details>
    ${signalements}
    <div data-supplement></div>
    <div class="controle-tete"><b>${tr("Contrôle pièce par pièce")}</b><span>${faites} / ${liste.length}</span></div>
    <div class="jauge"><i style="width:${Math.round(faites / liste.length * 100)}%"></i></div>
    <p class="petit" style="margin:6px 0 10px">${tr(avantExigee ? "Photos avant exigées par le client : pour chaque pièce, photo avant, tâches cochées, photo après au même endroit. L'IA compare les deux photos."
      : "Pour chaque pièce : cochez les tâches, puis prenez une photo après. L'IA vérifie que la pièce est propre.")}</p>
    ${liste.map(c => {
      const ok = complete(c), toutes = (c.taches || []).every(t => t.fait), pret = !avantExigee || !!c.photo_avant;
      return `<details class="piece${ok ? " complete" : ""}" ${c.piece_id === ouverte ? "open" : ""} data-piece="${esc(c.piece_id)}">
        <summary><span class="pastille-piece">${ok ? "✓" : ""}</span><b>${esc(tr(c.nom))}</b><small>${(c.taches || []).filter(t => t.fait).length}/${(c.taches || []).length}</small></summary>
        <div class="piece-corps">
          <div class="photos-piece">
            ${(avantExigee ? ["avant", "apres"] : ["apres"]).map(moment => { const chemin = moment === "avant" ? c.photo_avant : c.photo_apres;
              const bloque = moment === "apres" && (!pret || !toutes);
              return `<label class="photo-piece${chemin ? " prise" : ""}${bloque ? " bloquee" : ""}">
                ${chemin && photos[chemin] ? `<img src="${esc(photos[chemin])}" alt="">` : icone("photo")}
                <span>${tr(moment === "avant" ? "Photo avant" : "Photo après")}${chemin ? ` · ${tr("reprendre")}` : ""}</span>
                <input type="file" accept="image/*" capture="environment" data-photo="${moment}" ${bloque ? "disabled" : ""}></label>`; }).join("")}
          </div>
          ${!pret ? `<p class="petit">${tr("Commencez par la photo avant.")}</p>` : ""}
          <div class="taches-piece">${(c.taches || []).map(t => `<label class="case"><input type="checkbox" data-tache="${esc(t.id)}" ${t.fait ? "checked" : ""} ${pret ? "" : "disabled"}><span>${esc(tr(t.nom))}</span></label>`).join("")}</div>
          ${pret && !toutes ? `<p class="petit">${tr("Cochez toutes les tâches, puis prenez la photo après.")}</p>` : ""}
          ${avisIA(c)}
          ${["ecart", "erreur"].includes(c.ia_statut) ? `<div class="justif"><label class="champ">${tr("Justification (visible par le client)")}
              <textarea maxlength="600" rows="2" data-justif placeholder="${esc(tr("Ex. tache incrustée, impossible à retirer sans abîmer le tissu."))}">${esc(c.justification)}</textarea></label>
              <button type="button" class="bouton secondaire" data-enregistrer-justif>${tr("Enregistrer la justification")}</button>
              <span class="petit">${tr("Ou corrigez, puis reprenez la photo après.")}</span></div>` : ""}
          <p class="erreur" data-erreur-piece></p>
        </div></details>`; }).join("")}
  </div>`;
  traduire(boite);
  surFin(faites === liste.length);
  const recharger = () => brancherControle(boite, m, surFin);
  // Signalement d'arrivée : type, texte, photo facultative.
  const photoSignal = boite.querySelector("[data-photo-signal]");
  photoSignal.onchange = () => { boite.querySelector("[data-nom-photo-signal]").textContent = photoSignal.files?.[0] ? "✓ " + tr("Photo ajoutée") : ""; };
  blocSupplementCleaneur(boite.querySelector("[data-supplement]"), m, !!signalements);
  boite.querySelector("[data-envoyer-signal]").onclick = async e => {
    const texte = boite.querySelector("[data-texte-signal]").value.trim(), err = boite.querySelector("[data-erreur-signal]");
    if (texte.length < 3 && !photoSignal.files?.[0]) { err.textContent = tr("Décrivez le problème ou ajoutez une photo."); return; }
    e.target.disabled = true;
    const r = await signalerArrivee(m.reference, boite.querySelector("[name=type-signal]:checked").value, texte, photoSignal.files?.[0] || null).catch(() => "erreur");
    if (r !== "ok") { e.target.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  };
  boite.querySelectorAll("details.piece").forEach(d => {
    const piece = d.dataset.piece, err = d.querySelector("[data-erreur-piece]");
    const echec = () => { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); };
    d.querySelectorAll("[data-tache]").forEach(cb => cb.onchange = async () => {
      if ((await majPiece(m.reference, piece, { taches: { [cb.dataset.tache]: cb.checked } }).catch(() => "erreur")) !== "ok") return echec();
      recharger();
    });
    d.querySelectorAll("[data-photo]").forEach(inp => inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const moment = inp.dataset.photo;
      inp.closest(".photo-piece").classList.add("envoi");
      try {
        const chemin = await deposerPhotoControle(m.reference, piece, moment, f);
        if ((await majPiece(m.reference, piece, moment === "avant" ? { photoAvant: chemin } : { photoApres: chemin })) !== "ok") throw new Error();
      } catch { return echec(); }
      if (moment === "apres") { await recharger(); await controleIA(m.reference, piece); }
      recharger();
    });
    d.querySelector("[data-enregistrer-justif]")?.addEventListener("click", async () => {
      const texte = d.querySelector("[data-justif]").value.trim();
      if (texte.length < 5) { err.textContent = tr("Écrivez au moins quelques mots."); return; }
      if ((await majPiece(m.reference, piece, { justification: texte }).catch(() => "erreur")) !== "ok") return echec();
      recharger();
    });
  });
}

/* ------------------------------------------------------------------ Client : compte rendu */
/** Compte rendu pièce par pièce (client connecté de la demande, administration) ; rien si aucune pièce. */
export async function compteRenduPieces(boite, reference) {
  // Validation, note en étoiles et pourboire (au-dessus du compte rendu), avec le lien de suivi de la page.
  const jeton = decodeURIComponent(location.hash.split("/")[3] || "");
  if (jeton && !boite.previousElementSibling?.matches?.("[data-avis]")) {
    const zone = document.createElement("div"); zone.dataset.avis = "1"; boite.before(zone);
    const zoneLitige = document.createElement("div"); zoneLitige.dataset.litige = "1"; boite.before(zoneLitige);
    suivre(reference, jeton).then(d => { if (!d) return; blocAvis(zone, reference, jeton, d.statut); blocLitige(zoneLitige, reference, jeton, d.statut); }).catch(() => null);
  }
  const liste = await controlesDe(reference).catch(() => []);
  if (!liste.length) { boite.innerHTML = ""; return; }
  const signalements = await listeSignalements(reference);
  const photos = {};
  await Promise.all(liste.flatMap(c => [c.photo_avant, c.photo_apres].filter(Boolean).map(async p => { photos[p] = await lienPhotoControle(p).catch(() => ""); })));
  const ecarts = liste.filter(c => c.ia_statut === "ecart").length;
  boite.innerHTML = `<h2 class="titre-section">${icone("photo", { tuile: true })}${tr("Compte rendu pièce par pièce")}</h2>
    ${signalements ? `<p style="margin:8px 0 4px"><b>${tr("Signalé par le Cleaneur à son arrivée")}</b></p>${signalements}` : ""}
    <p class="petit">${liste.filter(c => pieceComplete(c, !!c.photo_avant)).length} / ${liste.length} ${tr("pièces terminées")}${ecarts ? ` · ${ecarts} ${tr("écart(s) signalé(s) par l'IA")}` : ""}</p>
    ${liste.map(c => `<div class="carte piece-rendu">
      <div class="haut"><b>${esc(tr(c.nom))}</b>${c.ia_statut === "ok" ? `<span class="tampon vert">${tr("IA : rien à signaler")}</span>` : c.ia_statut === "ecart" ? `<span class="tampon corail">${tr("IA : écart")}</span>` : ""}</div>
      <div class="photos-rendu">${(c.photo_avant ? ["avant", "apres"] : ["apres"]).map(mo => { const ch = mo === "avant" ? c.photo_avant : c.photo_apres;
        return `<figure>${ch && photos[ch] ? `<a href="${esc(photos[ch])}" target="_blank" rel="noopener"><img src="${esc(photos[ch])}" alt=""></a>` : `<div class="sans-photo">${icone("photo")}</div>`}
          <figcaption>${tr(mo === "avant" ? "Avant" : "Après")}${(mo === "avant" ? c.photo_avant_le : c.photo_apres_le) ? ` · ${new Date(mo === "avant" ? c.photo_avant_le : c.photo_apres_le).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}</figcaption></figure>`; }).join("")}</div>
      <ul class="taches-rendu">${(c.taches || []).map(t => `<li class="${t.fait ? "fait" : ""}">${t.fait ? "✓" : "○"} ${esc(tr(t.nom))}</li>`).join("")}</ul>
      ${c.ia_statut === "ecart" || c.ia_statut === "ok" ? avisIA(c) : ""}
      ${c.justification ? `<p class="justif-rendu"><b>${tr("Justification du Cleaneur :")}</b> ${esc(c.justification)}</p>` : ""}
    </div>`).join("")}`;
  traduire(boite);
}

(() => {
  if (document.getElementById("style-signalements")) return;
  const st = document.createElement("style");
  st.id = "style-signalements";
  st.textContent = `.signaler-arrivee { border: 1px dashed var(--alerte); border-radius: 14px; padding: 10px 14px; margin-bottom: 12px; }
  .signaler-arrivee summary { cursor: pointer; font-weight: 700; color: var(--corail-texte); }
  .choix-signal { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 6px 0; }
  .signalements { display: grid; gap: 8px; margin-bottom: 12px; }
  .signalement { display: flex; gap: 10px; align-items: flex-start; background: color-mix(in srgb, var(--alerte) 10%, var(--surface)); border-radius: 12px; padding: 10px; }
  .signalement img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; }`;
  document.head.appendChild(st);
})();
