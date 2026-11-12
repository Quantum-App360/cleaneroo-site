// Attestations fiscales et relevés comptables (12 novembre 2026). Cleaneroo n'avance pas le crédit d'impôt : le particulier reçoit
// chaque mois une attestation (à joindre) et une attestation annuelle (déclaration de revenus, case 7DB) ; le client professionnel
// (conciergerie, entreprise) reçoit chaque mois un relevé comptable (PDF et tableau CSV). Le 1er du mois, une notification prévient
// que le document du mois précédent est prêt (prevenir_documents_du_mois). Base : outils/base-attestations.sql. Même chose dans
// l'appli (Attestations.kt).
import { supabase } from "./donnees.js";
import { euros, REGLES } from "./regles.js";
import { rubrique } from "./catalogue.js";
import { tr, LOCALE, langue } from "./langue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomMois = (a, m) => new Date(a, m - 1, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
const dateCourte = d => new Date(d).toLocaleDateString(LOCALE);

/** Mois (année, mois) présents dans les factures, du plus récent au plus ancien. */
function moisDes(liste) {
  const vus = new Map();
  liste.forEach(f => { const d = new Date(f.date_emission); vus.set(`${d.getFullYear()}-${d.getMonth() + 1}`, [d.getFullYear(), d.getMonth() + 1]); });
  return [...vus.values()].sort((x, y) => y[0] - x[0] || y[1] - x[1]);
}

/** Bloc sous « Mes factures » : attestations fiscales (particulier) ou relevés comptables (pro). */
export function blocAttestations(liste, espace) {
  if (espace === "cleaneur" || !liste.length) return "";
  const mois = moisDes(liste.filter(f => f.type === "prestation" || (espace === "pro" && f.type === "frais")));
  if (!mois.length) return "";
  if (espace === "pro") return `<div class="carte attestations" style="margin-top:12px"><b>📊 ${tr("Relevés comptables")}</b>
    <p class="petit" style="margin:4px 0 8px">${tr("Chaque mois, toutes vos factures en un document pour votre comptabilité (PDF et tableau).")}</p>
    ${mois.map(([a, m]) => `<div class="ligne-attestation"><span>${esc(nomMois(a, m))}</span>
      <button type="button" class="bouton secondaire" data-releve="${a}-${m}">PDF</button><button type="button" class="lien-bouton" data-releve-csv="${a}-${m}">${tr("Tableau")}</button></div>`).join("")}</div>`;
  const annees = [...new Set(mois.map(([a]) => a))];
  return `<div class="carte attestations" style="margin-top:12px"><b>🧾 ${tr("Attestations fiscales (crédit d'impôt)")}</b>
    <p class="petit" style="margin:4px 0 8px">${tr("Cleaneroo n'avance pas le crédit d'impôt : déclarez vos dépenses de services à la personne, les impôts vous remboursent 50 %. Une attestation par mois, et une pour l'année à joindre à votre déclaration.")}</p>
    ${annees.map(a => `<div class="ligne-attestation"><b>${tr("Année")} ${a}</b><button type="button" class="bouton" data-attestation="${a}">${tr("Attestation annuelle")}</button></div>`).join("")}
    ${mois.map(([a, m]) => `<div class="ligne-attestation"><span>${esc(nomMois(a, m))}</span><button type="button" class="bouton secondaire" data-attestation="${a}-${m}">PDF</button></div>`).join("")}</div>`;
}

export function brancherAttestations(boite) {
  boite.querySelectorAll("[data-attestation]").forEach(b => b.onclick = () => { const [a, m] = b.dataset.attestation.split("-").map(Number); ouvrirAttestation(a, m || null); });
  boite.querySelectorAll("[data-releve]").forEach(b => b.onclick = () => { const [a, m] = b.dataset.releve.split("-").map(Number); ouvrirReleve(a, m); });
  boite.querySelectorAll("[data-releve-csv]").forEach(b => b.onclick = () => { const [a, m] = b.dataset.releveCsv.split("-").map(Number); telechargerReleve(a, m); });
  if (!document.getElementById("style-attestations")) {
    const s = document.createElement("style"); s.id = "style-attestations";
    s.textContent = ".ligne-attestation{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--separateur)}.ligne-attestation>span,.ligne-attestation>b{flex:1;text-transform:capitalize}";
    document.head.appendChild(s);
  }
}

const STYLE_DOC = `body{font:14px/1.5 "Plus Jakarta Sans",system-ui,sans-serif;color:#16343A;margin:32px auto;max-width:780px;padding:0 16px}
  h1{font-size:21px;margin:0 0 4px;color:#146B63}.petit{font-size:12.5px;color:#425E62}.bloc{border:1px solid #d5e2e2;border-radius:12px;padding:12px 14px;margin:14px 0}
  table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:7px 8px;border-bottom:1px solid #e3eded;text-align:left;vertical-align:top}th{background:#f3f7f7}
  .n{text-align:right;white-space:nowrap}.total{font-weight:800;font-size:16px}.marque{font-weight:800;color:#146B63;font-size:18px}
  .encadre{background:#eef7f5;border-radius:12px;padding:12px 14px}button{margin-top:16px}@media print{button{display:none}body{margin:12mm auto}}`;

async function ouvrirAttestation(annee, mois) {
  const w = window.open("", "_blank");
  if (!w) return alert(tr("Autorisez les fenêtres de ce site pour ouvrir le document."));
  const { data: a } = await supabase.rpc("attestation_fiscale", { p_annee: annee, p_mois: mois });
  const c = a?.client || {}, lignes = a?.lignes || [];
  const periode = mois ? nomMois(annee, mois) : `${tr("année")} ${annee}`;
  const credit = Math.round(Math.min(a?.total_eligible_c || 0, REGLES.CREDIT_IMPOT_PLAFOND_C) * REGLES.CREDIT_IMPOT_PCT / 100);
  w.document.write(`<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><title>${esc(tr("Attestation fiscale"))} ${esc(periode)}</title><style>${STYLE_DOC}</style></head><body>
    <p class="marque">Cleaneroo</p><h1>${esc(tr("Attestation fiscale — services à la personne"))}</h1><p class="petit">${esc(periode)}</p>
    <div class="bloc"><b>${esc(tr("Bénéficiaire"))}</b><br>${esc(c.nom || "")}<br>${esc(c.adresse || "")}</div>
    <p>${esc(tr("Sommes payées pour des prestations de services à la personne réalisées au domicile (article 199 sexdecies du Code général des impôts) :"))}</p>
    <table><thead><tr><th>${esc(tr("Date"))}</th><th>${esc(tr("Prestation"))}</th><th>${esc(tr("Intervenant"))}</th><th>${esc(tr("Facture"))}</th><th class="n">${esc(tr("Montant payé"))}</th></tr></thead><tbody>
    ${lignes.map(l => `<tr><td>${esc(dateCourte(l.date))}</td><td>${esc(tr(rubrique(l.rubrique_id)?.nom || ""))}</td><td>${esc(l.cleaneur)}${l.siret ? `<br><span class="petit">SIRET ${esc(l.siret)}</span>` : ""}${l.eligible ? "" : `<br><span class="petit">${esc(tr("Non déclaré services à la personne : n'ouvre pas droit"))}</span>`}</td>
      <td>${esc(l.numero)}</td><td class="n">${euros(l.montant_c)}</td></tr>`).join("") || `<tr><td colspan="5">${esc(tr("Aucune prestation ouvrant droit sur cette période."))}</td></tr>`}</tbody></table>
    <p class="total">${esc(tr("Total ouvrant droit au crédit d'impôt"))} : ${euros(a?.total_eligible_c || 0)}</p>
    ${!mois ? `<div class="encadre">${esc(tr("Crédit d'impôt estimé"))} : <b>${euros(credit)}</b> (${REGLES.CREDIT_IMPOT_PCT} %)<br>
      <span class="petit">${esc(tr("À déclarer dans votre déclaration de revenus de l'année suivante, rubrique « Emploi d'un salarié à domicile ou services à la personne » (case 7DB). Le crédit d'impôt vous est remboursé par l'administration fiscale. Conservez ce document."))}</span></div>`
      : `<div class="encadre petit">${esc(tr("Attestation mensuelle : à conserver. Pour votre déclaration de revenus, utilisez l'attestation annuelle (case 7DB)."))}</div>`}
    <p class="petit">${esc(tr("Attestation établie par Cleaneroo au nom et pour le compte des prestataires déclarés « services à la personne », dans le cadre de leur mandat de facturation. Sommes réglées en ligne par carte bancaire, aucun paiement en espèces."))}</p>
    <button onclick="print()">${esc(tr("Imprimer ou enregistrer en PDF"))}</button></body></html>`);
  w.document.close();
}

async function ouvrirReleve(annee, mois) {
  const w = window.open("", "_blank");
  if (!w) return alert(tr("Autorisez les fenêtres de ce site pour ouvrir le document."));
  const { data: r } = await supabase.rpc("releve_comptable", { p_annee: annee, p_mois: mois });
  const c = r?.client || {}, lignes = r?.lignes || [];
  w.document.write(`<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><title>${esc(tr("Relevé comptable"))} ${esc(nomMois(annee, mois))}</title><style>${STYLE_DOC}</style></head><body>
    <p class="marque">Cleaneroo</p><h1>${esc(tr("Relevé comptable mensuel"))}</h1><p class="petit">${esc(nomMois(annee, mois))}</p>
    <div class="bloc"><b>${esc(c.societe || c.nom || "")}</b>${c.siret ? `<br>SIRET ${esc(c.siret)}` : ""}<br>${esc(c.adresse || "")}</div>
    <table><thead><tr><th>${esc(tr("Date"))}</th><th>${esc(tr("Facture"))}</th><th>${esc(tr("Émetteur"))}</th><th class="n">HT</th><th class="n">TVA</th><th class="n">TTC</th></tr></thead><tbody>
    ${lignes.map(l => `<tr><td>${esc(dateCourte(l.date))}</td><td>${esc(l.numero)}<br><span class="petit">${esc(tr(l.type === "frais" ? "Frais de service" : "Prestation"))} · ${esc(l.reference)}</span></td>
      <td>${esc(l.emetteur)}${l.siret ? `<br><span class="petit">SIRET ${esc(l.siret)}</span>` : ""}</td><td class="n">${euros(l.ht_c)}</td><td class="n">${euros(l.tva_c)}</td><td class="n">${euros(l.ttc_c)}</td></tr>`).join("")}</tbody>
    <tfoot><tr class="total"><td colspan="3">${esc(tr("Total du mois"))}</td><td class="n">${euros(r?.total_ht_c || 0)}</td><td class="n">${euros(r?.total_tva_c || 0)}</td><td class="n">${euros(r?.total_ttc_c || 0)}</td></tr></tfoot></table>
    <p class="petit">${esc(tr("Factures disponibles une par une (PDF et Factur-X) dans votre espace Cleaneroo. Prestations facturées au nom et pour le compte des Cleaneurs ; frais de service facturés par Cleaneroo."))}</p>
    <button onclick="print()">${esc(tr("Imprimer ou enregistrer en PDF"))}</button></body></html>`);
  w.document.close();
}

async function telechargerReleve(annee, mois) {
  const { data: r } = await supabase.rpc("releve_comptable", { p_annee: annee, p_mois: mois });
  const m = c => (c / 100).toFixed(2).replace(".", ",");
  const lignes = [["Date", "Facture", "Type", "Prestation", "Emetteur", "SIRET", "HT", "TVA", "TTC"].join(";"),
    ...(r?.lignes || []).map(l => [l.date, l.numero, l.type === "frais" ? "Frais de service" : "Prestation", l.reference, l.emetteur, l.siret, m(l.ht_c), m(l.tva_c), m(l.ttc_c)].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `cleaneroo-releve-${annee}-${String(mois).padStart(2, "0")}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
