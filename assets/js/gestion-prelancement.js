// Back-office « Pré-lancement » (27/11/2026, validé par Michael) : avoir de la visibilité sur les clients et les Cleaneurs
// avant d'ouvrir, et savoir où ouvrir en premier. Données : tableau_prelancement() (base-inscriptions-fiables.sql).
import { supabase } from "./donnees.js";
import { esc } from "./commun.js";
import { icone } from "./icones.js";

const NOMS = { particulier: "Particuliers", entreprise: "Entreprises", pro: "Conciergeries", hotellerie: "Hôtellerie", cleaneur: "Cleaneurs" };
const DOSSIERS = [["BROUILLON", "Documents à envoyer"], ["A_VERIFIER", "À vérifier"], ["VALIDE", "Validés"], ["REFUSE", "Refusés"]];
const dateHeure = d => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function ecranPrelancement(vue, titre, brancherOnglets) {
  const { data: t, error } = await supabase.rpc("tableau_prelancement");
  if (error || !t) { vue.innerHTML = `${titre}<p class="erreur">${esc(error?.message || "Indisponible")}</p>`; brancherOnglets(); return; }
  const totaux = t.totaux || {}, jours = t.jours || [], secteurs = t.secteurs || [], incidents = t.incidents || [];
  const clients = Object.entries(totaux).filter(([k]) => k !== "cleaneur").reduce((s, [, n]) => s + n, 0);
  const max = Math.max(1, ...jours.map(j => j.clients + j.cleaneurs));
  const s = t.sentinelle;
  const prets = secteurs.filter(x => x.valides > 0 && x.attente > 0);
  vue.innerHTML = `${titre}
    <p class="note">${s ? (s.ok ? `${icone("valide")} Inscriptions vérifiées automatiquement le ${dateHeure(s.le)} : elles fonctionnent.` : `${icone("alerte")} <b>Inscriptions en panne</b> (vérification du ${dateHeure(s.le)}) : ${esc(s.detail || "")}`) : "Première vérification automatique des inscriptions dans l'heure."}</p>
    ${incidents.length ? `<div class="carte" style="border-color:var(--corail);margin:12px 0"><h2 style="margin:0 0 6px;font-size:17px">${icone("alerte")} ${incidents.length} incident(s) d'inscription</h2>
      <p class="petit muet">Ces comptes ont été créés avec un profil minimal : complétez-les ou recontactez la personne.</p>
      ${incidents.map(i => `<div class="petit" style="padding:6px 0;border-top:1px solid var(--separateur)"><b>${esc(i.email || "?")}</b> · ${dateHeure(i.le)}<br><span class="muet">${esc(i.erreur)}</span>
        <button type="button" class="lien-bouton" data-incident="${esc(i.id)}">Marquer comme traité</button></div>`).join("")}</div>` : ""}
    <div class="bo-kpi" style="margin:12px 0">
      <div class="kpi"><b>${clients}</b><span>Clients inscrits</span></div>
      <div class="kpi"><b>${totaux.cleaneur || 0}</b><span>Cleaneurs inscrits</span></div>
      <div class="kpi"><b>${(t.dossiers || {}).VALIDE || 0}</b><span>Cleaneurs validés</span></div>
      <div class="kpi ${prets.length ? "" : "alerte"}"><b>${prets.length}</b><span>Secteurs prêts à ouvrir</span></div>
    </div>
    <div class="grille-2">
      <div class="carte"><h2 style="margin:0 0 8px;font-size:17px">Clients par type</h2>
        ${["particulier", "entreprise", "pro", "hotellerie"].map(k => `<p class="petit" style="margin:4px 0">${NOMS[k]} : <b>${totaux[k] || 0}</b></p>`).join("")}</div>
      <div class="carte"><h2 style="margin:0 0 8px;font-size:17px">Dossiers des Cleaneurs</h2>
        ${DOSSIERS.map(([k, n]) => `<p class="petit" style="margin:4px 0">${n} : <b>${(t.dossiers || {})[k] || 0}</b></p>`).join("")}</div>
    </div>
    <div class="carte" style="margin-top:12px"><h2 style="margin:0 0 4px;font-size:17px">Inscriptions des 30 derniers jours</h2>
      <p class="petit muet" style="margin:0 0 8px"><span class="leg leg-clients"></span> Clients <span class="leg leg-cleaneurs"></span> Cleaneurs</p>
      <div class="histo-inscriptions">${jours.map(j => `<div class="histo-col" title="${new Date(j.jour).toLocaleDateString("fr-FR")} : ${j.clients} client(s), ${j.cleaneurs} Cleaneur(s)">
        <span class="h-cleaneurs" style="height:${(j.cleaneurs / max) * 100}%"></span><span class="h-clients" style="height:${(j.clients / max) * 100}%"></span></div>`).join("")}</div></div>
    <div class="carte" style="margin-top:12px"><h2 style="margin:0 0 4px;font-size:17px">Secteurs</h2>
      <p class="petit muet" style="margin:0 0 8px">Prêt à ouvrir : au moins un Cleaneur validé et une demande qui attend. Les demandes en attente sont prévenues automatiquement à l'ouverture.</p>
      ${secteurs.length ? `<table class="tableau-simple"><tr><th>Ville</th><th>Clients</th><th>Demandes en attente</th><th>Cleaneurs validés</th><th>Cleaneurs en cours</th><th></th></tr>
      ${secteurs.map(x => `<tr><td>${esc(x.ville || "—")}</td><td>${x.clients}</td><td>${x.attente}</td><td>${x.valides ?? "—"}</td><td>${x.en_cours ?? "—"}</td>
        <td>${x.valides > 0 && x.attente > 0 ? `<b style="color:var(--succes)">Prêt à ouvrir</b>` : x.attente > 0 ? "Recruter ici" : ""}</td></tr>`).join("")}</table>`
      : `<p class="muet">Aucun secteur pour l'instant.</p>`}</div>`;
  vue.querySelectorAll("[data-incident]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { error: e } = await supabase.rpc("incident_resolu", { p_id: b.dataset.incident });
    if (!e) b.closest("div").remove(); else b.disabled = false;
  });
  brancherOnglets();
}
