// Factures (onglet « Factures » de chaque espace : Particulier, Pro, Cleaneur). Créées par la base quand une prestation est terminée :
// prestation (du Cleaneur au client, établie par Cleaneroo pour son compte), frais de service et commission (de Cleaneroo).
// PDF : page imprimable (Enregistrer en PDF). Professionnels : fichier électronique Factur-X (XML CII, profil MINIMUM).
// Même écran dans l'appli (Factures.kt). Les montants viennent de la base, jamais de l'IA (elle rédige seulement la description).
import { supabase } from "./donnees.js";
import { euros, dateLongue } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPES = { prestation: "Prestation", frais: "Frais de service", commission: "Commission Cleaneroo" };

/** Factures de la personne connectée pour un espace : "personnel", "pro" (conciergerie et entreprise) ou "cleaneur". */
export async function mesFactures(espace) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  let q = supabase.from("factures").select("*").order("date_emission", { ascending: false }).order("numero", { ascending: false }).limit(200);
  if (espace === "cleaneur") q = q.or(`and(type.eq.prestation,cleaneur_id.eq.${session.user.id}),and(type.eq.commission,client_id.eq.${session.user.id})`);
  else q = q.eq("client_id", session.user.id).neq("type", "commission").in("espace", espace === "pro" ? ["conciergerie", "professionnel"] : ["personnel"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

/** Bloc « Mes factures » : liste, total de l'année, PDF et Factur-X. */
export function blocFactures(liste, espace) {
  const an = new Date().getFullYear();
  const total = liste.filter(f => new Date(f.date_emission).getFullYear() === an).reduce((s, f) => s + f.total_ttc_c, 0);
  return `<h2 class="titre-section">${icone("paiement", { tuile: true })}Mes factures</h2>
    <p class="petit" style="margin-top:0">${tr(espace === "cleaneur" ? "Les factures de vos prestations (établies pour votre compte) et les commissions Cleaneroo. Utile pour votre déclaration URSSAF."
      : "Une facture est créée automatiquement à la fin de chaque prestation.")}</p>
    ${liste.length ? `<div class="carte factures-liste">${liste.map(f => `<div class="ligne-facture">
        <div><b>${esc(f.numero)}</b><span class="petit">${esc(dateLongue(new Date(f.date_emission)))} · ${tr(TYPES[f.type])} · ${tr("prestation")} ${esc(f.reference)}</span></div>
        <b>${euros(f.total_ttc_c)}</b>
        <div class="actions-facture"><button type="button" class="bouton secondaire" data-pdf="${esc(f.id)}">PDF</button>
          ${espace === "pro" || espace === "cleaneur" ? `<button type="button" class="lien-bouton" data-xml="${esc(f.id)}">Factur-X</button>` : ""}</div></div>`).join("")}
      <p class="petit" style="margin:10px 0 0">${tr("Total")} ${an} : <b>${euros(total)}</b></p></div>`
      : `<div class="vide-compte"><p class="muet">${tr("Aucune facture pour l'instant.")}</p><p class="petit">${tr("Vos factures apparaîtront ici après chaque prestation terminée.")}</p></div>`}`;
}

export function brancherFactures(boite, liste) {
  boite.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => ouvrirPdf(liste.find(f => f.id === b.dataset.pdf)));
  boite.querySelectorAll("[data-xml]").forEach(b => b.onclick = () => telecharger(liste.find(f => f.id === b.dataset.xml)));
}

/** Remplit un conteneur [data-factures="espace"] (appelé par l'onglet de l'espace). */
export async function afficherFactures(conteneur) {
  if (!conteneur) return;
  styles();
  const espace = conteneur.dataset.factures;
  const liste = await mesFactures(espace).catch(() => []);
  if (!conteneur.isConnected) return;
  conteneur.innerHTML = blocFactures(liste, espace);
  traduire(conteneur);
  brancherFactures(conteneur, liste);
}

/* ------------------------------------------------------------------ Facture imprimable (PDF) */
function htmlFacture(f) {
  const e = f.emetteur || {}, d = f.destinataire || {}, pro = !!d.siret;
  const lignes = (f.lignes || []).map(l => `<tr><td>${esc(l.libelle)}</td><td class="n">${l.quantite}</td><td class="n">${euros(l.prix_ht_c)}</td><td class="n">${l.tva_pct} %</td><td class="n">${euros(l.prix_ht_c * l.quantite)}</td></tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(f.numero)}</title><style>
    body{font:14px/1.45 system-ui,sans-serif;color:#16343A;margin:32px;max-width:780px} h1{font-size:22px;margin:0} .entete{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px}
    .bloc{border:1px solid #d5e2e2;border-radius:10px;padding:12px 14px;flex:1} table{width:100%;border-collapse:collapse;margin:18px 0} th,td{padding:8px;border-bottom:1px solid #e3eded;text-align:left}
    .n{text-align:right;white-space:nowrap} .totaux{margin-left:auto;width:280px} .totaux div{display:flex;justify-content:space-between;padding:3px 0} .totaux .ttc{font-weight:800;font-size:16px;border-top:2px solid #16343A;margin-top:4px;padding-top:6px}
    .petit{font-size:12px;color:#425E62} .description{background:#f3f7f7;border-radius:10px;padding:10px 14px} @media print{body{margin:12mm}}</style></head><body>
    <div class="entete"><div><h1>Facture ${esc(f.numero)}</h1><p class="petit">Date : ${esc(new Date(f.date_emission).toLocaleDateString("fr-FR"))} · Prestation ${esc(f.reference)}</p></div>
      <div class="petit" style="text-align:right">Cleaneroo<br>cleaneroo.fr</div></div>
    <div class="entete"><div class="bloc"><b>Émetteur</b><br>${esc(e.nom)}<br>${e.siret ? `SIRET ${esc(e.siret)}<br>` : ""}${esc(e.adresse || "")}${e.tva_intracom ? `<br>TVA ${esc(e.tva_intracom)}` : ""}</div>
      <div class="bloc"><b>Client</b><br>${esc(d.societe || d.nom)}${d.societe ? `<br>${esc(d.nom)}` : ""}<br>${d.siret ? `SIRET ${esc(d.siret)}<br>` : ""}${esc(d.adresse || "")}</div></div>
    ${f.description ? `<p class="description">${esc(f.description)}</p>` : ""}
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unitaire HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead><tbody>${lignes}</tbody></table>
    <div class="totaux"><div><span>Total HT</span><span>${euros(f.total_ht_c)}</span></div><div><span>TVA</span><span>${euros(f.tva_c)}</span></div><div class="ttc"><span>Total TTC</span><span>${euros(f.total_ttc_c)}</span></div></div>
    <p class="petit">${esc(e.mention_tva || "")}${e.mandat ? `<br>${esc(e.mandat)}` : ""}<br>Facture acquittée : réglée en ligne par l'intermédiaire de Cleaneroo.
      ${pro ? "<br>En cas de retard de paiement : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce)." : ""}</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
}
function ouvrirPdf(f) {
  if (!f) return;
  const w = window.open("", "_blank");
  if (!w) return alert(tr("Autorisez les fenêtres de ce site pour ouvrir la facture."));
  w.document.write(htmlFacture(f));
  w.document.close();
}

/* ------------------------------------------------------------------ Factur-X : XML CII (profil MINIMUM) à joindre à la facture */
function xmlFacturX(f) {
  const e = f.emetteur || {}, d = f.destinataire || {}, x = s => esc(s || "");
  const date = String(f.date_emission).replaceAll("-", ""), m = c => (c / 100).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument><ram:ID>${x(f.numero)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${date}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>${x(e.nom)}</ram:Name>${e.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${x(e.siret.slice(0, 9))}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}<ram:PostalTradeAddress><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${e.tva_intracom ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(e.tva_intracom)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>${x(d.societe || d.nom)}</ram:Name>${d.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${x(d.siret.slice(0, 9))}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}</ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:TaxBasisTotalAmount>${m(f.total_ht_c)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${m(f.tva_c)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${m(f.total_ttc_c)}</ram:GrandTotalAmount><ram:DuePayableAmount>0.00</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
function telecharger(f) {
  if (!f) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xmlFacturX(f)], { type: "application/xml" }));
  a.download = `factur-x-${f.numero}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function styles() {
  if (document.getElementById("style-factures")) return;
  const st = document.createElement("style");
  st.id = "style-factures";
  st.textContent = `.factures-liste { display: grid; gap: 0; }
  .ligne-facture { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--separateur); }
  .ligne-facture div:first-child { display: flex; flex-direction: column; gap: 2px; }
  .actions-facture { display: flex; gap: 6px; align-items: center; }
  .actions-facture .bouton { min-height: 36px; padding: 0 14px; }
  @media (max-width: 520px) { .ligne-facture { grid-template-columns: 1fr auto; } .actions-facture { grid-column: 1 / -1; } }`;
  document.head.appendChild(st);
}
