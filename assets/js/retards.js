// Retards déclarés (12 novembre 2026, repris de l'appli iPhone de Vincent) : le Cleaneur annonce son retard, le client est
// prévenu sur son suivi ; au-delà de 30 min (REGLES.RETARD_TOLERE_MIN), il peut annuler sans frais.
// Même écran dans l'appli (Retards.kt). Base : outils/base-retards.sql.
import { supabase } from "./donnees.js";
import { REGLES } from "./regles.js";
import { tr, traduire } from "./langue.js";

export const MOTIFS_RETARD = [["MISSION_PRECEDENTE", "Intervention Cleaneroo précédente prolongée"], ["CIRCULATION", "Circulation ou transports"], ["AUTRE", "Autre imprévu"]];
const heure = iso => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");

/** Bouton et formulaire « J'aurai du retard » d'une mission (Cleaneur). */
export function blocRetardCleaneur(m) {
  if (!["CONFIRMEE", "EN_ROUTE"].includes(m.statut)) return "";
  return `<details class="retard-cleaneur" style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">⏱ ${tr("J'aurai du retard")}</summary>
    <div class="grille-retard" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:8px">
      <label class="champ">${tr("Retard prévu")}<select data-retard-minutes>${[10, 15, 20, 30, 45, 60, 90].map(n => `<option value="${n}">${n} min</option>`).join("")}</select></label>
      <label class="champ">${tr("Motif")}<select data-retard-motif>${MOTIFS_RETARD.map(([v, t]) => `<option value="${v}">${tr(t)}</option>`).join("")}</select></label>
    </div>
    <p class="petit">${tr("Le client est prévenu tout de suite. Seul un retard de 30 min au plus dû à une intervention Cleaneroo précédente est justifié ; au-delà de 30 min, le client peut annuler sans frais.")}</p>
    <button type="button" class="bouton secondaire" data-declarer-retard="${m.reference}">${tr("Prévenir le client")}</button>
    <p class="petit" data-retard-resultat></p></details>`;
}
export function brancherRetards(boite) {
  boite.querySelectorAll("[data-declarer-retard]").forEach(b => b.onclick = async () => {
    const d = b.closest(".retard-cleaneur");
    b.disabled = true;
    const { data } = await supabase.rpc("declarer_retard", { p_reference: b.dataset.declarerRetard,
      p_minutes: Number(d.querySelector("[data-retard-minutes]").value), p_motif: d.querySelector("[data-retard-motif]").value });
    b.disabled = false;
    d.querySelector("[data-retard-resultat]").textContent = tr(data === "ok" ? "Retard annoncé : le client est prévenu." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
}

/** Retard annoncé sur la page de suivi du client (avec annulation sans frais au-delà de 30 min). */
export async function blocRetardClient(boite, reference, jeton) {
  if (!boite) return;
  const { data: r } = await supabase.rpc("retard_annonce", { p_reference: reference, p_jeton: jeton || null });
  if (!r || !boite.isConnected) return;
  const motif = MOTIFS_RETARD.find(x => x[0] === r.motif)?.[1] || "";
  const trop = r.minutes > REGLES.RETARD_TOLERE_MIN;
  boite.innerHTML = `<div class="carte" style="margin-bottom:14px;border:1px solid var(--corail,#FA8C66)"><b>⏱ ${tr("Votre Cleaneur a annoncé un retard")}</b>
    <p class="petit" style="margin:4px 0 0">${r.minutes} min · ${tr(motif)} · ${tr("arrivée prévue vers")} ${heure(r.arrivee)}</p>
    ${trop ? `<p class="petit">${tr("Plus de 30 minutes de retard : vous pouvez annuler sans frais.")}</p>
      <button type="button" class="bouton danger" data-annuler-retard>${tr("Annuler sans frais")}</button><p class="erreur" data-erreur-retard></p>` : ""}</div>`;
  traduire(boite);
  boite.querySelector("[data-annuler-retard]")?.addEventListener("click", async e => {
    if (!confirm(tr("Annuler cette prestation sans frais ?"))) return;
    e.target.disabled = true;
    const { data } = await supabase.rpc("annuler_pour_retard", { p_reference: reference, p_jeton: jeton || null });
    if (data === "ok") location.reload();
    else { e.target.disabled = false; boite.querySelector("[data-erreur-retard]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  });
}
