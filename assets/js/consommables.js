// Consommables à contrôler en location saisonnière (12 novembre 2026, repris de l'appli iPhone de Vincent) : le Cleaneur note
// chaque consommable choisi par le client ; stock bas ou manquant = alerte « Consommables à prévoir » au client.
// Le Cleaneur n'apporte jamais de consommables. Même écran dans l'appli (Consommables.kt). Base : noter_consommable, consommables_de.
import { supabase } from "./donnees.js";
import { CONSOMMABLES_LOCATION } from "./catalogue.js";
import { tr, traduire } from "./langue.js";

export const STATUTS_CONSOMMABLE = [["REAPPRO", "Réapprovisionné"], ["SUFFISANT", "Stock suffisant"], ["BAS", "Stock bas"], ["MANQUANT", "Manquant"]];
const nom = id => CONSOMMABLES_LOCATION.find(c => c[0] === id)?.[1] || id;

/** Bloc du Cleaneur (mission sur place ou en cours, location saisonnière). */
export async function blocConsommablesCleaneur(boite, reference) {
  if (!boite) return;
  const { data } = await supabase.rpc("consommables_de", { p_reference: reference });
  if (!boite.isConnected || !data?.choisis?.length) return;
  const statuts = data.statuts || {};
  boite.innerHTML = `<div class="carte" style="margin-top:10px"><b>🧻 ${tr("Consommables à contrôler")}</b>
    <p class="petit" style="margin:4px 0 8px">${tr("Notez chaque consommable. Vous n'en apportez jamais : ils doivent être sur place.")}</p>
    ${data.choisis.map(id => `<div class="ligne-conso"><span>${tr(nom(id))}</span><select data-conso="${id}">
      <option value="">${tr("À vérifier")}</option>${STATUTS_CONSOMMABLE.map(([v, t]) => `<option value="${v}" ${statuts[id] === v ? "selected" : ""}>${tr(t)}</option>`).join("")}</select></div>`).join("")}</div>`;
  traduire(boite);
  boite.querySelectorAll("[data-conso]").forEach(s => s.onchange = async () => {
    if (!s.value) return;
    s.disabled = true;
    await supabase.rpc("noter_consommable", { p_reference: reference, p_id: s.dataset.conso, p_statut: s.value });
    s.disabled = false;
  });
  if (!document.getElementById("styles-conso")) {
    const st = document.createElement("style"); st.id = "styles-conso";
    st.textContent = `.ligne-conso{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.06)}.ligne-conso select{max-width:180px}`;
    document.head.appendChild(st);
  }
}

/** Bloc du client : consommables notés par le Cleaneur (compte rendu). */
export async function blocConsommablesClient(boite, reference, jeton) {
  if (!boite) return;
  const { data } = await supabase.rpc("consommables_de", { p_reference: reference, p_jeton: jeton || null });
  const notes = Object.entries(data?.statuts || {});
  if (!boite.isConnected || !notes.length) return;
  const couleur = s => s === "MANQUANT" ? "var(--erreur)" : s === "BAS" ? "var(--corail-texte,#C2552F)" : "var(--succes)";
  boite.innerHTML = `<div class="carte" style="margin-bottom:12px"><b>🧻 ${tr("Consommables")}</b>
    ${notes.map(([id, s]) => `<p class="petit" style="margin:4px 0;display:flex;justify-content:space-between;gap:10px"><span>${tr(nom(id))}</span>
      <b style="color:${couleur(s)}">${tr(STATUTS_CONSOMMABLE.find(x => x[0] === s)?.[1] || s)}</b></p>`).join("")}
    ${notes.some(([, s]) => s === "BAS" || s === "MANQUANT") ? `<p class="petit">${tr("Pensez à racheter les consommables en stock bas ou manquants avant le prochain voyageur.")}</p>` : ""}</div>`;
  traduire(boite);
}
