// « Mon activité » du Cleaneur (12 novembre 2026, repris de l'appli iPhone de Vincent) : chiffre d'affaires du mois ou de
// l'année (factures de prestation + pourboires), commission Cleaneroo, cotisations URSSAF estimées (ACRE, versement libératoire),
// plafond de la micro-entreprise, rappel de déclaration, export tableur et créateur de devis (page imprimable en PDF).
// Calculs dans regles.js (calculActivite, copie dans ReglesMetier.kt). Même écran dans l'appli (Activite.kt).
import { supabase } from "./donnees.js";
import { mesFactures } from "./factures.js";
import { euros, REGLES, calculActivite, netPortefeuille, dateVersement, dateLongue } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

const CLE = "cleaneroo-activite";
const lireReglages = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } };
const garder = r => { try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* rien */ } };
const pct = n => String(n).replace(".", ",") + " %";

/** Section « Mon activité » de l'espace Cleaneur. */
export async function blocActivite(boite, profil) {
  if (!boite) return;
  styles();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const [factures, avis] = await Promise.all([mesFactures("cleaneur").catch(() => []),
    supabase.from("avis").select("reference, pourboire_c, cree_le").eq("cleaneur_id", session.user.id).gt("pourboire_c", 0).then(r => r.data || [])]);
  if (!boite.isConnected) return;
  const reglages = { periode: "mois", acre: false, liberatoire: false, ...lireReglages() };
  const portefeuille = (await supabase.rpc("mon_portefeuille")).data || {};
  const afficher = () => {
    const a = calculActivite({ factures, pourboires: avis, ...reglages });
    boite.innerHTML = `<h2 class="titre-section">📊 ${tr("Mon activité")}</h2>
      <div class="choix-periode" role="tablist">${[["mois", "Ce mois-ci"], ["annee", "Cette année"]].map(([v, t]) =>
        `<button type="button" role="tab" aria-selected="${reglages.periode === v}" data-periode="${v}">${tr(t)}</button>`).join("")}</div>
      <div class="carte">
        <b>${tr(reglages.periode === "mois" ? "Chiffre d'affaires du mois" : "Chiffre d'affaires de l'année")}</b>
        <div class="ligne-activite"><span>${tr("Encaissé (prestations et pourboires)")}</span><b>${euros(a.caC)}</b></div>
        <div class="ligne-activite"><span>${tr("Commission Cleaneroo")}</span><span>−${euros(a.commissionC)}</span></div>
        <div class="ligne-activite"><span>${tr("Cotisations URSSAF estimées")} (${pct(a.tauxPct)})</span><span>−${euros(a.cotisationsC)}</span></div>
        <div class="ligne-activite total"><span>${tr("Reste estimé")}</span><b>${euros(a.resteC)}</b></div>
        <label class="case-activite"><input type="checkbox" data-reglage="acre" ${reglages.acre ? "checked" : ""}> ${tr("ACRE (1re année, taux réduit)")}</label>
        <label class="case-activite"><input type="checkbox" data-reglage="liberatoire" ${reglages.liberatoire ? "checked" : ""}> ${tr("Versement libératoire de l'impôt")} (+${pct(REGLES.VERSEMENT_LIBERATOIRE_PCT)})</label>
        <p class="petit">${tr("Taux 2026 des prestations de services (dont le nettoyage) :")} ${pct(REGLES.URSSAF_SERVICES_PCT)}, ${tr("ou")} ${pct(REGLES.URSSAF_ACRE_PCT)} ${tr("avec l'ACRE. Estimation indicative, hors contribution à la formation professionnelle.")}</p>
      </div>
      <div class="carte">
        <b>${tr("Plafond de la micro-entreprise")}</b>
        <div class="jauge-activite ${a.plafondPct >= 90 ? "alerte" : ""}"><i style="width:${a.plafondPct}%"></i></div>
        <p class="petit" style="margin:6px 0 0">${euros(a.caAnneeC)} ${tr("sur")} ${euros(REGLES.PLAFOND_MICRO_SERVICES_C)} ${tr("cette année")} (${a.plafondPct} %)</p>
        <p class="petit">${tr("Au-delà du plafond des prestations de services, vous sortez du régime micro. Surveillez-le en fin d'année.")}</p>
      </div>
      <div class="carte">
        <b>${tr("Déclaration URSSAF")}</b>
        <p class="petit">${tr("Déclarez votre chiffre d'affaires chaque mois ou chaque trimestre, même s'il est nul :")} <b>${euros(a.caC)}</b> ${tr(reglages.periode === "mois" ? "ce mois-ci selon Cleaneroo." : "cette année selon Cleaneroo.")}</p>
        <a class="bouton secondaire" href="https://autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">autoentrepreneur.urssaf.fr ↗</a>
      </div>
      <div class="carte">
        <b>👛 ${tr("Portefeuille de l'année")}</b>
        <div class="ligne-activite"><span>${tr("Prestations")}</span><span>${euros(portefeuille.prestations_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Commission Cleaneroo")}</span><span>−${euros(portefeuille.commissions_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Pourboires")}</span><span>+${euros(portefeuille.pourboires_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Primes d'urgence")}</span><span>+${euros(portefeuille.primes_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Moins-values")}</span><span>−${euros(portefeuille.moins_values_c || 0)}</span></div>
        <div class="ligne-activite total"><span>${tr("Net de l'année")}</span><b>${euros(netPortefeuille(portefeuille))}</b></div>
        <p class="petit">${tr("Prochain versement :")} ${dateLongue(dateVersement(new Date()))}. ${tr("Votre IBAN sera saisi auprès du prestataire de paiement sécurisé à l'ouverture des paiements : Cleaneroo ne le conserve pas.")}</p>
      </div>
      <div class="carte">
        <b>${tr("Documents")}</b>
        <div class="actions-activite">
          <button type="button" class="bouton secondaire" data-export ${factures.length || avis.length ? "" : "disabled"}>${tr("Exporter mes missions (tableur)")}</button>
          <button type="button" class="bouton secondaire" data-devis>${tr("Créer un devis")}</button>
        </div>
        <div class="devis-activite" hidden></div>
      </div>
      <p class="petit">${tr("Outil d'aide à la gestion : il ne remplace pas votre déclaration officielle ni l'avis d'un expert-comptable.")}</p>`;
    boite.querySelectorAll("[data-periode]").forEach(b => b.onclick = () => { reglages.periode = b.dataset.periode; garder(reglages); afficher(); });
    boite.querySelectorAll("[data-reglage]").forEach(c => c.onchange = () => { reglages[c.dataset.reglage] = c.checked; garder(reglages); afficher(); });
    boite.querySelector("[data-export]").onclick = () => exporter(factures, avis);
    boite.querySelector("[data-devis]").onclick = () => devis(boite.querySelector(".devis-activite"), profil);
  };
  afficher();
}

/** Tableur (CSV, séparateur « ; », lisible par Excel) : factures et pourboires, du plus ancien au plus récent. */
export function lignesExport(factures, pourboires) {
  const TYPES = { prestation: "Prestation", commission: "Commission Cleaneroo" };
  const l = [...factures.map(f => [f.date_emission, f.numero, TYPES[f.type] || f.type, f.reference, (f.type === "commission" ? -1 : 1) * f.total_ttc_c]),
    ...pourboires.map(a => [String(a.cree_le).slice(0, 10), "", "Pourboire", a.reference, a.pourboire_c])].sort((a, b) => a[0].localeCompare(b[0]));
  const montant = c => (c / 100).toFixed(2).replace(".", ",");
  return [["Date", "Numéro", "Type", "Prestation", "Montant TTC (€)"].join(";"),
    ...l.map(([d, n, t, r, c]) => [d, n, tr(t), r, montant(c)].map(x => String(x).replace(/;/g, ",")).join(";"))].join("\r\n");
}
function exporter(factures, pourboires) {
  const blob = new Blob(["﻿" + lignesExport(factures, pourboires)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Cleaneroo-activite-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Créateur de devis : client, lignes (désignation + montant), puis page imprimable (Enregistrer en PDF). */
function devis(zone, profil) {
  const lignes = [];
  zone.hidden = false;
  const dessiner = () => {
    const total = lignes.reduce((s, l) => s + l.montantC, 0);
    zone.innerHTML = `<label class="champ">${tr("Nom du client")}<input name="client" maxlength="120" value="${esc(zone.dataset.client || "")}"></label>
      ${lignes.map((l, i) => `<div class="ligne-activite"><span>${esc(l.libelle)}</span><span>${euros(l.montantC)} <button type="button" class="lien-bouton" data-retirer="${i}" aria-label="${tr("Retirer")}">✕</button></span></div>`).join("")}
      <div class="ajout-devis"><label class="champ">${tr("Désignation")}<input name="libelle" maxlength="160"></label>
        <label class="champ">${tr("Montant (€)")}<input name="montant" type="number" min="1" max="50000" step="1" inputmode="decimal"></label>
        <button type="button" class="bouton secondaire" data-ajouter-ligne>${tr("Ajouter la ligne")}</button></div>
      <div class="ligne-activite total"><span>${tr("Total")}</span><b>${euros(total)}</b></div>
      <p class="petit">${tr("TVA non applicable, art. 293 B du CGI (franchise en base). Devis valable 30 jours.")}</p>
      <p class="erreur" data-erreur-devis></p>
      <button type="button" class="bouton" data-generer>${tr("Générer le devis (PDF)")}</button>`;
    const client = zone.querySelector("[name=client]");
    client.oninput = () => { zone.dataset.client = client.value; };
    zone.querySelectorAll("[data-retirer]").forEach(b => b.onclick = () => { lignes.splice(Number(b.dataset.retirer), 1); dessiner(); });
    zone.querySelector("[data-ajouter-ligne]").onclick = () => {
      const libelle = zone.querySelector("[name=libelle]").value.trim();
      const montantC = Math.round(Number(String(zone.querySelector("[name=montant]").value).replace(",", ".")) * 100);
      if (!libelle || !(montantC > 0)) { zone.querySelector("[data-erreur-devis]").textContent = tr("Indiquez une désignation et un montant."); return; }
      lignes.push({ libelle, montantC });
      dessiner();
    };
    zone.querySelector("[data-generer]").onclick = () => {
      if (!client.value.trim() || !lignes.length) { zone.querySelector("[data-erreur-devis]").textContent = tr("Indiquez le client et au moins une ligne."); return; }
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(htmlDevis({ numero: numeroDevis(), date: new Date(), emetteur: { nom: [profil?.prenom, profil?.nom].filter(Boolean).join(" "), siret: profil?.siret || "",
        ville: [profil?.code_postal, profil?.ville].filter(Boolean).join(" ") }, client: client.value.trim(), lignes }));
      w.document.close();
    };
  };
  dessiner();
}
export const numeroDevis = (d = new Date()) => `DEV-${d.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Devis imprimable (français, document remis au client). */
export function htmlDevis({ numero, date, emetteur, client, lignes }) {
  const total = lignes.reduce((s, l) => s + l.montantC, 0);
  const fin = new Date(date.getTime() + REGLES.DEVIS_VALIDITE_JOURS * 86400000);
  const jour = d => d.toLocaleDateString("fr-FR");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Devis ${esc(numero)}</title><style>
    body{font:14px/1.45 system-ui,sans-serif;color:#16343A;margin:32px;max-width:780px} h1{font-size:22px;margin:0} .entete{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px}
    .bloc{border:1px solid #d5e2e2;border-radius:10px;padding:12px 14px;flex:1} table{width:100%;border-collapse:collapse;margin:18px 0} th,td{padding:8px;border-bottom:1px solid #e3eded;text-align:left}
    .n{text-align:right;white-space:nowrap} .total{font-weight:800;font-size:16px} .petit{font-size:12px;color:#425E62} .signature{margin-top:36px;border:1px dashed #9db5b5;border-radius:10px;padding:14px 14px 60px} @media print{body{margin:12mm}}</style></head><body>
    <div class="entete"><div><h1>Devis ${esc(numero)}</h1><p class="petit">Établi le ${jour(date)} · valable jusqu'au ${jour(fin)}</p></div><div class="petit" style="text-align:right">Réalisé avec Cleaneroo<br>cleaneroo.fr</div></div>
    <div class="entete"><div class="bloc"><b>Émetteur</b><br>${esc(emetteur.nom)}<br>${emetteur.siret ? `SIRET ${esc(emetteur.siret)}<br>` : ""}${esc(emetteur.ville)}<br>Micro-entrepreneur · Cleaneur Cleaneroo</div>
      <div class="bloc"><b>Client</b><br>${esc(client)}</div></div>
    <table><thead><tr><th>Désignation</th><th class="n">Montant</th></tr></thead><tbody>${lignes.map(l => `<tr><td>${esc(l.libelle)}</td><td class="n">${euros(l.montantC)}</td></tr>`).join("")}
      <tr><td class="total">Total</td><td class="n total">${euros(total)}</td></tr></tbody></table>
    <p class="petit">TVA non applicable, art. 293 B du CGI. Devis gratuit, valable ${REGLES.DEVIS_VALIDITE_JOURS} jours.</p>
    <div class="signature"><b>Bon pour accord</b><br><span class="petit">Date et signature du client, précédées de la mention « Bon pour accord »</span></div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
}

function styles() {
  if (document.getElementById("styles-activite")) return;
  const s = document.createElement("style");
  s.id = "styles-activite";
  s.textContent = `
    .choix-periode{display:inline-flex;gap:4px;background:rgba(31,138,128,.08);border-radius:99px;padding:4px;margin-bottom:10px}
    .choix-periode button{border:none;background:none;font:inherit;font-weight:600;padding:7px 16px;border-radius:99px;cursor:pointer;color:inherit}
    .choix-periode button[aria-selected=true]{background:var(--fond,#fff);box-shadow:0 1px 4px rgba(0,0,0,.12);color:var(--primaire,#1F8A80)}
    .ligne-activite{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(0,0,0,.06)}
    .ligne-activite.total{border-bottom:none;border-top:2px solid currentColor;margin-top:4px;font-size:1.05rem}
    .case-activite{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:.92rem;cursor:pointer}
    .jauge-activite{height:10px;border-radius:99px;background:rgba(31,138,128,.12);margin-top:10px;overflow:hidden}
    .jauge-activite i{display:block;height:100%;background:var(--primaire,#1F8A80);border-radius:99px}
    .jauge-activite.alerte i{background:#E0654B}
    .actions-activite{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .devis-activite{margin-top:14px;border-top:1px solid rgba(0,0,0,.08);padding-top:12px}
    .ajout-devis{display:grid;grid-template-columns:1fr 140px auto;gap:8px;align-items:end;margin:8px 0}
    @media (max-width:560px){.ajout-devis{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}
