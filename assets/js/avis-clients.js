// Le Cleaneur note aussi le client (11 novembre 2026, repris de l'appli iPhone de Vincent).
// Après la mission (14 jours) : étoiles et étiquettes. Notes visibles des seuls Cleaneurs (moyenne du client sur les missions
// disponibles) et de l'administration, jamais du client. Même écran dans l'appli (AvisClients.kt). Base : outils/base-avis-clients.sql.
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { dateLongue } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

export const ETIQUETTES_CLIENT = [
  ["ACCUEIL_AGREABLE", "Accueil agréable", true], ["LOGEMENT_CONFORME", "Logement conforme", true], ["ACCES_FACILE", "Accès facile", true],
  ["CONSIGNES_CLAIRES", "Consignes claires", true], ["LOGEMENT_NON_CONFORME", "Logement non conforme", false],
  ["ACCES_COMPLIQUE", "Accès compliqué", false], ["COMPORTEMENT_DEPLACE", "Comportement déplacé", false],
];

/** Section « Notez vos derniers clients » du tableau de bord du Cleaneur (rien si aucune mission à noter). */
export async function blocNoterClients(boite) {
  if (!boite) return;
  const { data: liste } = await supabase.rpc("missions_a_noter");
  if (!boite.isConnected || !liste?.length) { if (boite) boite.innerHTML = ""; return; }
  boite.innerHTML = `<h2 class="titre-section">⭐ ${tr("Notez vos derniers clients")}</h2>
    <p class="petit" style="margin-top:0">${tr("Votre note n'est visible que des Cleaneurs et de Cleaneroo, jamais du client.")}</p>
    ${liste.map(m => `<div class="carte noter-client" data-noter="${esc(m.reference)}">
      <b>${esc(rubrique(m.rubrique_id)?.nom || "")}</b> · ${esc(m.prenom)} · ${esc(m.ville)}${m.creneau ? ` · ${esc(dateLongue(new Date(m.creneau)))}` : ""}
      <div class="etoiles-client" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-etoile="${n}" aria-label="${n} / 5">☆</button>`).join("")}</div>
      <div class="etiquettes-client">${ETIQUETTES_CLIENT.map(([id, nom, bien]) => `<button type="button" class="${bien ? "bien" : "mal"}" data-etiquette="${id}">${nom}</button>`).join("")}</div>
      <p class="erreur" data-erreur-noter></p>
      <button type="button" class="bouton secondaire" data-envoyer-note>${tr("Envoyer ma note")}</button></div>`).join("")}`;
  traduire(boite);
  styles();
  boite.querySelectorAll("[data-noter]").forEach(carte => {
    let note = 0;
    const etiquettes = new Set();
    carte.querySelectorAll("[data-etoile]").forEach(b => b.onclick = () => {
      note = Number(b.dataset.etoile);
      carte.querySelectorAll("[data-etoile]").forEach(x => { x.textContent = Number(x.dataset.etoile) <= note ? "★" : "☆"; x.classList.toggle("allumee", Number(x.dataset.etoile) <= note); });
    });
    carte.querySelectorAll("[data-etiquette]").forEach(b => b.onclick = () => {
      etiquettes.has(b.dataset.etiquette) ? etiquettes.delete(b.dataset.etiquette) : etiquettes.add(b.dataset.etiquette);
      b.classList.toggle("choisi", etiquettes.has(b.dataset.etiquette));
    });
    carte.querySelector("[data-envoyer-note]").onclick = async e => {
      const err = carte.querySelector("[data-erreur-noter]");
      if (!note) { err.textContent = tr("Choisissez une note de 1 à 5 étoiles."); return; }
      e.target.disabled = true;
      const { data } = await supabase.rpc("noter_client", { p_reference: carte.dataset.noter, p_note: note, p_etiquettes: [...etiquettes], p_commentaire: "" });
      if (data !== "ok") { e.target.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
      carte.innerHTML = `<p class="petit" style="margin:0;color:var(--succes)"><b>${tr("Merci, votre note est enregistrée.")}</b></p>`;
    };
  });
}

/** Note moyenne des clients des missions disponibles : remplit les emplacements [data-note-client]. */
export async function remplirNotesClients(boite) {
  const places = [...(boite?.querySelectorAll("[data-note-client]") || [])];
  if (!places.length) return;
  const { data } = await supabase.rpc("notes_clients", { p_references: places.map(p => p.dataset.noteClient) });
  for (const l of data || []) {
    const p = places.find(x => x.dataset.noteClient === l.reference);
    if (p) { p.textContent = `⭐ ${tr("Client noté")} ${String(l.note_moyenne).replace(".", ",")} / 5 (${l.nb})`; }
  }
}

function styles() {
  if (document.getElementById("style-avis-clients")) return;
  const st = document.createElement("style");
  st.id = "style-avis-clients";
  st.textContent = `.noter-client { margin-bottom: 10px; }
  .etoiles-client { display: flex; gap: 4px; margin: 8px 0; }
  .etoiles-client button { font-size: 30px; line-height: 1; background: none; border: 0; cursor: pointer; color: var(--texte3); padding: 2px; }
  .etoiles-client button.allumee { color: #F5B301; }
  .etiquettes-client { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .etiquettes-client button { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--separateur); background: var(--surface); color: var(--texte); cursor: pointer; font-size: 14px; }
  .etiquettes-client button.bien.choisi { background: var(--succes); border-color: var(--succes); color: #fff; }
  .etiquettes-client button.mal.choisi { background: var(--erreur); border-color: var(--erreur); color: #fff; }`;
  document.head.appendChild(st);
}
