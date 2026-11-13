// Étapes de ménage à valider en photo, fixées par logement (13 novembre 2026, demande pour les conciergeries).
// La conciergerie choisit, bien par bien, les étapes que le Cleaneur doit prouver par une photo ; elles sont enregistrées
// avec le bien (champ etapesPhoto) et reprises à chaque réservation de ménage de location de ce bien.
// Même écran dans l'appli (EtapesBien.kt).
import { ETAPES_LOCATION, PIECES_LOCATION, ETAPES_DEPART } from "./catalogue.js";
import { enregistrerBien } from "./donnees.js";
import { tr } from "./langue.js";
import { esc } from "./commun.js";

/** Étapes retenues pour un bien : celles enregistrées, sinon les étapes conseillées. */
export const etapesPhotoDe = l => Array.isArray(l?.etapesPhoto?.etapes) ? l.etapesPhoto.etapes : ETAPES_DEPART();
export const etapesPersoDe = l => Array.isArray(l?.etapesPhoto?.perso) ? l.etapesPhoto.perso : [];
/** Fiches restées ouvertes après un enregistrement (la page est redessinée). */
const ouverts = new Set();

/** Éditeur des étapes (fiche du bien, espace Pro). */
export function editeurEtapesPhoto(l) {
  const choisies = etapesPhotoDe(l), perso = etapesPersoDe(l);
  return `<details class="etapes-photo" ${ouverts.has(l.id) ? "open" : ""}><summary>📷 ${tr("Étapes de ménage à valider en photo")} (${choisies.length + perso.length})</summary>
    <p class="petit">${tr("Choisissez ce que le Cleaneur doit prouver par une photo dans ce logement. Ces étapes sont reprises à chaque ménage de location de ce bien ; les étapes payantes s'ajoutent au prix affiché à la réservation.")}</p>
    <form data-form-etapes="${esc(l.id)}" novalidate>
      ${PIECES_LOCATION.map(([piece, nom]) => {
        const es = ETAPES_LOCATION.filter(e => e.piece === piece), ps = perso.map((p, i) => [p, i]).filter(([p]) => p.piece === piece);
        return `<p class="petit" style="margin:12px 0 4px"><b>${tr(nom)}</b></p><div class="carte">`
          + es.map(e => `<label class="case"><input type="checkbox" name="etape" value="${e.id}" ${choisies.includes(e.id) ? "checked" : ""}><span>${tr(e.nom)}</span></label>`).join("")
          + ps.map(([p, i]) => `<div class="etape-perso"><span>• ${esc(p.texte)}</span><button type="button" class="lien-bouton" data-retirer-perso="${esc(l.id)}:${i}">${tr("Retirer")}</button></div>`).join("")
          + `</div>`;
      }).join("")}
      <div class="carte" style="margin-top:10px"><b>${tr("Ajouter une étape")}</b>
        <div class="ajout-etape-perso"><select name="piece" class="texte" aria-label="${esc(tr("Pièce"))}">${PIECES_LOCATION.map(([id, nom]) => `<option value="${id}">${tr(nom)}</option>`).join("")}</select>
          <input class="texte" name="texte" maxlength="120" placeholder="${esc(tr("Ex. : arroser l'olivier"))}">
          <button type="button" class="lien-bouton" data-ajouter-perso="${esc(l.id)}">${tr("Ajouter")}</button></div></div>
      <p class="erreur" data-erreur-etapes></p><button class="bouton plein" type="submit">${tr("Enregistrer les étapes")}</button>
    </form></details>`;
}

export function brancherEtapesPhoto(vue, biens, recharger) {
  const cocher = f => [...f.querySelectorAll("input[name=etape]:checked")].map(i => i.value);
  const sauver = async (f, l, perso) => {
    const err = f.querySelector("[data-erreur-etapes]");
    ouverts.add(l.id);
    try { await enregistrerBien({ ...l, etapesPhoto: { etapes: cocher(f), perso: perso.slice(0, 20) } }); recharger(); }
    catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
  vue.querySelectorAll("[data-form-etapes]").forEach(f => {
    const l = biens.find(x => x.id === f.dataset.formEtapes);
    if (!l) return;
    f.onsubmit = e => { e.preventDefault(); sauver(f, l, etapesPersoDe(l)); };
    f.querySelector("[data-ajouter-perso]").onclick = () => {
      const texte = f.texte.value.trim();
      if (!texte) { f.querySelector("[data-erreur-etapes]").textContent = tr("Écrivez l'étape à ajouter."); return; }
      sauver(f, l, [...etapesPersoDe(l), { piece: f.piece.value, texte }]);
    };
    f.querySelectorAll("[data-retirer-perso]").forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.retirerPerso.split(":").pop());
      sauver(f, l, etapesPersoDe(l).filter((_, k) => k !== i));
    });
  });
}
