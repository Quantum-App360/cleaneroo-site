// Périodes fermées du Cleaneur (12 novembre 2026, reprises de l'appli iPhone de Vincent) : vacances, obligation familiale,
// rendez-vous médical, formation, autre. Aucune mission n'est proposée ni ne peut être prise pendant ces périodes.
// Même écran dans l'appli (Periodes.kt). Base : outils/base-periodes-fermees.sql.
import { supabase } from "./donnees.js";
import { dateLongue } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

export const MOTIFS_PERIODE = [["VACANCES", "Vacances"], ["FAMILLE", "Obligation familiale"], ["MEDICAL", "Rendez-vous médical"], ["FORMATION", "Formation"], ["AUTRE", "Autre"]];

/** Début et fin d'une période à partir des jours choisis (du premier jour 0 h au lendemain du dernier jour 0 h). */
export function bornesPeriode(du, au) {
  const debut = new Date(`${du}T00:00:00`), fin = new Date(`${au}T00:00:00`);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin, valide: !isNaN(debut) && !isNaN(fin) && fin > debut && (fin - debut) <= 366 * 86400000 };
}

/** Section « Mes périodes fermées » du tableau de bord du Cleaneur. */
export async function blocPeriodes(boite) {
  if (!boite) return;
  const { data } = await supabase.from("periodes_fermees").select("*").gt("fin", new Date().toISOString()).order("debut");
  if (!boite.isConnected) return;
  const liste = data || [];
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nom = id => MOTIFS_PERIODE.find(m => m[0] === id)?.[1] || id;
  boite.innerHTML = `<h2 class="titre-section">🏖️ ${tr("Mes périodes fermées")}</h2>
    <p class="petit" style="margin-top:0">${tr("Vacances, obligation familiale, rendez-vous… Pendant ces périodes, aucune mission ne vous est proposée ni notifiée.")}</p>
    ${liste.map(p => { const f = new Date(p.fin); f.setDate(f.getDate() - 1);
      return `<div class="carte ligne-periode"><div><b>${tr(nom(p.motif))}</b><span class="petit">${tr("du")} ${esc(dateLongue(new Date(p.debut)))} ${tr("au")} ${esc(dateLongue(f))}</span></div>
        <button type="button" class="bouton secondaire" data-rouvrir="${esc(p.id)}">${tr("Rouvrir cette période")}</button></div>`; }).join("")}
    <details class="carte"${liste.length ? "" : " open"}><summary><b>${tr("Fermer une période")}</b></summary>
      <div class="grille-periode">
        <label class="champ">${tr("Du")}<input type="date" name="du" min="${aujourdhui}" value="${aujourdhui}"></label>
        <label class="champ">${tr("Au")}<input type="date" name="au" min="${aujourdhui}" value="${aujourdhui}"></label>
        <label class="champ">${tr("Motif")}<select name="motif">${MOTIFS_PERIODE.map(([v, t]) => `<option value="${v}">${tr(t)}</option>`).join("")}</select></label>
      </div>
      <p class="erreur" data-erreur-periode></p>
      <button type="button" class="bouton" data-fermer-periode>${tr("Fermer cette période")}</button></details>`;
  traduire(boite);
  styles();
  boite.querySelectorAll("[data-rouvrir]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await supabase.from("periodes_fermees").delete().eq("id", b.dataset.rouvrir);
    blocPeriodes(boite);
  });
  boite.querySelector("[data-fermer-periode]").onclick = async e => {
    const v = n => boite.querySelector(`[name=${n}]`).value;
    const err = boite.querySelector("[data-erreur-periode]");
    const { debut, fin, valide } = bornesPeriode(v("du"), v("au"));
    if (!valide) { err.textContent = tr("Choisissez une date de fin après la date de début (un an au plus)."); return; }
    e.target.disabled = true;
    const { error } = await supabase.from("periodes_fermees").insert({ debut: debut.toISOString(), fin: fin.toISOString(), motif: v("motif") });
    if (error) { e.target.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    blocPeriodes(boite);
  };
}

function styles() {
  if (document.getElementById("styles-periodes")) return;
  const s = document.createElement("style");
  s.id = "styles-periodes";
  s.textContent = `.ligne-periode{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ligne-periode div{display:flex;flex-direction:column;gap:2px}
    .grille-periode{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
    @media (max-width:560px){.grille-periode{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}
