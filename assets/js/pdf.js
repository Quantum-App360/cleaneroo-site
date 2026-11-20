// Documents PDF de Cleaneroo (20 novembre 2026) : vraies factures PDF au format Factur-X (le XML CII, profil BASIC, est joint
// dans le PDF : un logiciel comptable ou une plateforme agréée lit la facture sans ressaisie), relevé mensuel, archive ZIP,
// export comptable (CSV) et dossier de preuves pour l'assurance en cas de dommage. Tout est fabriqué dans le navigateur
// (bibliothèques pdf-lib et fflate chargées à la demande) : rien à installer, rien d'envoyé à un tiers.
// Même contenu dans l'appli (Factures.kt). Les montants viennent de la base (table factures), jamais d'un calcul ici.

const PDFLIB = "https://esm.sh/pdf-lib@1.17.1";
const FFLATE = "https://esm.sh/fflate@0.8.2";
let lib = null;
const charger = async () => (lib ||= await import(PDFLIB));

/* ------------------------------------------------------------------ Outils */
// Police standard (Helvetica, encodage WinAnsi) : accents français et « € » pris en charge ; le reste (émojis, espaces fines) est remplacé.
const propre = s => String(s ?? "").replace(/[   ]/g, " ").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, "-")
  .replace(/…/g, "...").replace(/[^\x20-\x7E -ÿ€\n]/g, "");
const eur = c => propre(((c || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }));
const dateFr = d => propre(new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
const x = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const m2 = c => ((c || 0) / 100).toFixed(2);
const siren = s => String(s || "").replace(/\D/g, "").slice(0, 9);

/** Mise en page simple : texte avec retour à la ligne automatique et nouvelles pages. */
class Page {
  constructor(doc, polices) { this.doc = doc; this.f = polices; this.nouvelle(); }
  nouvelle() { this.p = this.doc.addPage([595.28, 841.89]); this.y = 800; }
  place(h) { if (this.y - h < 50) this.nouvelle(); }
  texte(t, { taille = 10, gras = false, x = 50, couleur = [0.09, 0.2, 0.23], largeur = 495, interligne = 1.35 } = {}) {
    const police = gras ? this.f.gras : this.f.normal, { rgb } = lib;
    for (const para of propre(t).split("\n")) {
      const mots = para.split(" "); let ligne = "";
      const ecrire = l => { this.place(taille * interligne); this.p.drawText(l, { x, y: this.y, size: taille, font: police, color: rgb(...couleur) }); this.y -= taille * interligne; };
      for (const m of mots) { const essai = ligne ? `${ligne} ${m}` : m; if (police.widthOfTextAtSize(essai, taille) > largeur && ligne) { ecrire(ligne); ligne = m; } else ligne = essai; }
      ecrire(ligne);
    }
  }
  droite(t, xDroite, y, { taille = 10, gras = false } = {}) {
    const police = gras ? this.f.gras : this.f.normal, s = propre(t);
    this.p.drawText(s, { x: xDroite - police.widthOfTextAtSize(s, taille), y, size: taille, font: police, color: lib.rgb(0.09, 0.2, 0.23) });
  }
  trait(y = this.y + 4) { this.p.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.6, color: lib.rgb(0.83, 0.89, 0.89) }); }
  espace(h = 8) { this.y -= h; }
}
async function nouveauDoc(titre) {
  const { PDFDocument, StandardFonts } = await charger();
  const doc = await PDFDocument.create();
  doc.setTitle(propre(titre)); doc.setProducer("Cleaneroo"); doc.setCreator("cleaneroo.fr"); doc.setLanguage("fr-FR");
  const polices = { normal: await doc.embedFont(StandardFonts.Helvetica), gras: await doc.embedFont(StandardFonts.HelveticaBold) };
  return { doc, page: new Page(doc, polices) };
}
function enTete(pg, titre, sousTitre) {
  pg.p.drawRectangle({ x: 0, y: 815, width: 595.28, height: 27, color: lib.rgb(0.05, 0.78, 0.55) });
  pg.p.drawText("Cleaneroo", { x: 50, y: 823, size: 12, font: pg.f.gras, color: lib.rgb(1, 1, 1) });
  pg.p.drawText("cleaneroo.fr", { x: 470, y: 823, size: 9, font: pg.f.normal, color: lib.rgb(1, 1, 1) });
  pg.y = 785; pg.texte(titre, { taille: 18, gras: true }); if (sousTitre) pg.texte(sousTitre, { taille: 9, couleur: [0.26, 0.37, 0.38] }); pg.espace(6);
}

/* ------------------------------------------------------------------ Factur-X (XML CII, profil BASIC) */
const exonere = f => (f.lignes || []).every(l => !l.tva_pct);
export function xmlFacturX(f) {
  const e = f.emetteur || {}, d = f.destinataire || {}, date = String(f.date_emission).slice(0, 10).replaceAll("-", "");
  const lignes = f.lignes?.length ? f.lignes : [{ libelle: f.description || "Prestation", quantite: 1, prix_ht_c: f.total_ht_c, tva_pct: f.total_ht_c ? Math.round(f.tva_c * 100 / f.total_ht_c) : 0 }];
  const motif = e.mention_tva || "TVA non applicable, art. 293 B du CGI";
  const cat = l => (l.tva_pct ? "S" : "E");
  const taux = [...new Set(lignes.map(l => l.tva_pct || 0))];
  const ventilation = taux.map(t => {
    const base = lignes.filter(l => (l.tva_pct || 0) === t).reduce((s, l) => s + l.prix_ht_c * (l.quantite || 1), 0);
    return `<ram:ApplicableTradeTax><ram:CalculatedAmount>${m2(Math.round(base * t / 100))}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${t ? "" : `<ram:ExemptionReason>${x(motif)}</ram:ExemptionReason>`}<ram:BasisAmount>${m2(base)}</ram:BasisAmount><ram:CategoryCode>${t ? "S" : "E"}</ram:CategoryCode><ram:RateApplicablePercent>${t}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
  }).join("");
  const partie = (role, p) => `<ram:${role}><ram:Name>${x(p.societe || p.nom)}</ram:Name>${siren(p.siret) ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren(p.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}<ram:PostalTradeAddress>${p.code_postal ? `<ram:PostcodeCode>${x(p.code_postal)}</ram:PostcodeCode>` : ""}${p.adresse ? `<ram:LineOne>${x(p.adresse)}</ram:LineOne>` : ""}${p.ville ? `<ram:CityName>${x(p.ville)}</ram:CityName>` : ""}<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${p.tva_intracom ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(p.tva_intracom)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:${role}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${x(f.numero)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${date}</udt:DateTimeString></ram:IssueDateTime>${f.reference ? `<ram:IncludedNote><ram:Content>Prestation ${x(f.reference)}</ram:Content></ram:IncludedNote>` : ""}</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${lignes.map((l, i) => `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${x(l.libelle)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${m2(l.prix_ht_c)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${l.quantite || 1}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat(l)}</ram:CategoryCode><ram:RateApplicablePercent>${l.tva_pct || 0}</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${m2(l.prix_ht_c * (l.quantite || 1))}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join("\n")}
<ram:ApplicableHeaderTradeAgreement>${d.reference_acheteur ? `<ram:BuyerReference>${x(d.reference_acheteur)}</ram:BuyerReference>` : ""}${partie("SellerTradeParty", e)}${partie("BuyerTradeParty", d)}</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${date}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${ventilation}<ram:SpecifiedTradePaymentTerms><ram:Description>Facture acquittée : réglée en ligne par l'intermédiaire de Cleaneroo.</ram:Description></ram:SpecifiedTradePaymentTerms>
<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${m2(f.total_ht_c)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${m2(f.total_ht_c)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${m2(f.tva_c)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${m2(f.total_ttc_c)}</ram:GrandTotalAmount><ram:TotalPrepaidAmount>${m2(f.total_ttc_c)}</ram:TotalPrepaidAmount><ram:DuePayableAmount>0.00</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
function xmpFacturX(titre, date) {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${x(titre)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>cleaneroo.fr</xmp:CreatorTool><xmp:CreateDate>${date}</xmp:CreateDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>BASIC</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>${["DocumentFileName", "DocumentType", "Version", "ConformanceLevel"].map(n => `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${n}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${n}</pdfaProperty:description></rdf:li>`).join("")}</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

/* ------------------------------------------------------------------ Facture */
const TYPES = { prestation: "Prestation de ménage", frais: "Frais de service", commission: "Commission Cleaneroo" };
export async function facturePdf(f) {
  const { doc, page: pg } = await nouveauDoc(`Facture ${f.numero}`);
  const e = f.emetteur || {}, d = f.destinataire || {}, pro = !!d.siret;
  enTete(pg, `Facture ${f.numero}`, `Émise le ${dateFr(f.date_emission)}${f.reference ? ` · prestation ${f.reference}` : ""} · ${TYPES[f.type] || ""}`);
  const haut = pg.y, bloc = (titre, lignes, xx) => { let y = haut; pg.p.drawText(propre(titre), { x: xx, y, size: 9, font: pg.f.gras, color: lib.rgb(0.05, 0.55, 0.5) }); y -= 14;
    lignes.filter(Boolean).forEach(l => { pg.p.drawText(propre(l).slice(0, 60), { x: xx, y, size: 10, font: pg.f.normal, color: lib.rgb(0.09, 0.2, 0.23) }); y -= 13; }); return y; };
  const y1 = bloc("ÉMETTEUR", [e.nom, e.siret && `SIRET ${e.siret}`, e.adresse, [e.code_postal, e.ville].filter(Boolean).join(" "), e.tva_intracom && `TVA ${e.tva_intracom}`], 50);
  const y2 = bloc("CLIENT", [d.societe || d.nom, d.societe && d.nom, d.siret && `SIRET ${d.siret}`, d.adresse, [d.code_postal, d.ville].filter(Boolean).join(" "), d.tva_intracom && `TVA ${d.tva_intracom}`], 320);
  pg.y = Math.min(y1, y2) - 10;
  if (f.description) { pg.texte(f.description, { taille: 9.5, couleur: [0.26, 0.37, 0.38] }); pg.espace(4); }
  // Tableau des lignes
  pg.trait(); pg.espace(4);
  const col = [50, 330, 390, 465, 545];
  const ligneTab = (cells, gras = false) => { pg.place(16); const y = pg.y;
    pg.p.drawText(propre(cells[0]).slice(0, 52), { x: col[0], y, size: 9.5, font: gras ? pg.f.gras : pg.f.normal, color: lib.rgb(0.09, 0.2, 0.23) });
    pg.droite(cells[1], col[2] - 10, y, { taille: 9.5, gras }); pg.droite(cells[2], col[3] - 10, y, { taille: 9.5, gras }); pg.droite(cells[3], col[3] + 25, y, { taille: 9.5, gras }); pg.droite(cells[4], col[4], y, { taille: 9.5, gras });
    pg.y -= 16; };
  ligneTab(["Désignation", "Qté", "PU HT", "TVA", "Total HT"], true); pg.trait();
  (f.lignes || []).forEach(l => ligneTab([l.libelle, String(l.quantite || 1), eur(l.prix_ht_c), `${l.tva_pct || 0} %`, eur(l.prix_ht_c * (l.quantite || 1))]));
  pg.trait(); pg.espace(6);
  [["Total HT", f.total_ht_c], ["TVA", f.tva_c], ["Total TTC", f.total_ttc_c]].forEach(([t, v], i) => { pg.place(16); pg.droite(t, 450, pg.y, { gras: i === 2, taille: i === 2 ? 12 : 10 }); pg.droite(eur(v), 545, pg.y, { gras: i === 2, taille: i === 2 ? 12 : 10 }); pg.y -= i === 2 ? 20 : 15; });
  pg.texte("Facture acquittée : réglée en ligne par l'intermédiaire de Cleaneroo. Net à payer : 0,00 €.", { taille: 9, gras: true });
  if (e.mention_tva) pg.texte(e.mention_tva, { taille: 8.5 });
  if (e.mandat) pg.texte(e.mandat, { taille: 8.5 });
  if (pro) pg.texte("En cas de retard de paiement : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).", { taille: 8 });
  pg.espace(6);
  pg.texte("Facture électronique Factur-X (profil BASIC, norme EN 16931) : le fichier factur-x.xml joint à ce PDF contient les mêmes données, lisibles directement par votre logiciel comptable ou votre plateforme de facturation.", { taille: 7.5, couleur: [0.4, 0.5, 0.5] });
  // Pièce jointe Factur-X + métadonnées XMP
  const { AFRelationship, PDFName, PDFArray } = lib;
  const xml = new TextEncoder().encode(xmlFacturX(f)), maintenant = new Date();
  await doc.attach(xml, "factur-x.xml", { mimeType: "text/xml", description: "Factur-X", creationDate: maintenant, modificationDate: maintenant, afRelationship: AFRelationship?.Data });
  try {
    const meta = doc.context.stream(new TextEncoder().encode(xmpFacturX(`Facture ${f.numero}`, maintenant.toISOString())), { Type: "Metadata", Subtype: "XML" });
    doc.catalog.set(PDFName.of("Metadata"), doc.context.register(meta));
  } catch { /* métadonnées facultatives : le PDF reste valable */ }
  // pdf-lib n'écrit la pièce jointe qu'à l'enregistrement : on relit le PDF pour ajouter le lien AF du document
  // (exigé par PDF/A-3 pour le fichier associé factur-x.xml).
  const octets = await doc.save();
  try {
    const d2 = await lib.PDFDocument.load(octets, { updateMetadata: false });
    const ef = d2.catalog.lookup(PDFName.of("Names"))?.lookup(PDFName.of("EmbeddedFiles"))?.lookup(PDFName.of("Names"));
    if (ef instanceof PDFArray && ef.size() >= 2) { d2.catalog.set(PDFName.of("AF"), d2.context.obj([ef.get(1)])); return d2.save({ updateFieldAppearances: false }); }
  } catch { /* sans le lien AF, la facture reste lisible et le XML présent */ }
  return octets;
}

/* ------------------------------------------------------------------ Relevé mensuel (récapitulatif pour la comptabilité) */
export async function relevePdf(liste, { titre, qui }) {
  const { doc, page: pg } = await nouveauDoc(titre);
  enTete(pg, titre, `${qui ? `${qui} · ` : ""}${liste.length} facture(s) · édité le ${dateFr(new Date())}`);
  const tot = k => liste.reduce((s, f) => s + (f[k] || 0), 0);
  pg.trait(); pg.espace(4);
  const l = (c, gras = false) => { pg.place(15); const y = pg.y; pg.p.drawText(propre(c[0]), { x: 50, y, size: 9, font: gras ? pg.f.gras : pg.f.normal });
    pg.p.drawText(propre(c[1]).slice(0, 48), { x: 120, y, size: 9, font: gras ? pg.f.gras : pg.f.normal }); pg.droite(c[2], 420, y, { taille: 9, gras }); pg.droite(c[3], 480, y, { taille: 9, gras }); pg.droite(c[4], 545, y, { taille: 9, gras }); pg.y -= 15; };
  l(["Date", "Facture · objet", "HT", "TVA", "TTC"], true); pg.trait();
  liste.slice().sort((a, b) => String(a.date_emission).localeCompare(String(b.date_emission))).forEach(f =>
    l([new Date(f.date_emission).toLocaleDateString("fr-FR"), `${f.numero} · ${TYPES[f.type] || ""}`, eur(f.total_ht_c), eur(f.tva_c), eur(f.total_ttc_c)]));
  pg.trait(); l(["", "Total", eur(tot("total_ht_c")), eur(tot("tva_c")), eur(tot("total_ttc_c"))], true);
  pg.espace(8); pg.texte("Chaque facture du relevé est jointe en PDF Factur-X dans l'archive ZIP téléchargée avec ce relevé.", { taille: 8, couleur: [0.4, 0.5, 0.5] });
  return doc.save();
}

/** Export comptable (CSV, séparateur « ; », compatible Excel) : une ligne par facture. */
export function csvComptable(liste) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`, n = c => ((c || 0) / 100).toFixed(2).replace(".", ",");
  return "﻿" + [["Date", "Numéro", "Type", "Prestation", "Émetteur", "SIRET émetteur", "Client", "HT", "TVA", "TTC"].join(";"),
    ...liste.map(f => [new Date(f.date_emission).toLocaleDateString("fr-FR"), f.numero, TYPES[f.type] || f.type, f.reference, f.emetteur?.nom, f.emetteur?.siret,
      f.destinataire?.societe || f.destinataire?.nom, n(f.total_ht_c), n(f.tva_c), n(f.total_ttc_c)].map(q).join(";"))].join("\r\n");
}

/** Archive ZIP : toutes les factures PDF (Factur-X), le relevé et l'export comptable. */
export async function archiveZip(liste, { titre, qui }) {
  const { zipSync } = await import(FFLATE);
  const fichiers = {};
  for (const f of liste) fichiers[`factures/${String(f.numero).replace(/[^\w.-]/g, "_")}.pdf`] = await facturePdf(f);
  fichiers["releve.pdf"] = await relevePdf(liste, { titre, qui });
  fichiers["export-comptable.csv"] = new TextEncoder().encode(csvComptable(liste));
  return zipSync(fichiers, { level: 6 });
}

/* ------------------------------------------------------------------ Dossier pour l'assurance (dommage) */
export async function dossierAssurancePdf({ litige, demande, client, cleaneur, photos = [] }) {
  const { doc, page: pg } = await nouveauDoc(`Dossier de déclaration ${demande?.reference || ""}`);
  enTete(pg, "Dossier de déclaration de dommage", `Prestation ${demande?.reference || ""} · préparé par Cleaneroo le ${dateFr(new Date())}`);
  const section = t => { pg.espace(6); pg.texte(t, { taille: 11, gras: true, couleur: [0.05, 0.55, 0.5] }); };
  section("1. Les parties");
  pg.texte(`Client : ${[client?.prenom, client?.nom].filter(Boolean).join(" ")}${client?.email ? ` · ${client.email}` : ""}${client?.telephone ? ` · ${client.telephone}` : ""}`);
  pg.texte(`Cleaneur (prestataire indépendant) : ${[cleaneur?.prenom, cleaneur?.nom].filter(Boolean).join(" ")}${cleaneur?.siret ? ` · SIRET ${cleaneur.siret}` : ""}`);
  if (cleaneur?.assureur || cleaneur?.police_rc) pg.texte(`Assurance RC Pro : ${cleaneur.assureur || ""}${cleaneur.police_rc ? ` · contrat ${cleaneur.police_rc}` : ""}`);
  section("2. La prestation");
  pg.texte(`${demande?.rubrique || ""} · ${demande?.adresse || ""}`);
  if (demande?.creneau) pg.texte(`Date prévue : ${propre(new Date(demande.creneau).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }))}`);
  (demande?.etapes || []).forEach(e => pg.texte(`• ${e}`, { taille: 9 }));
  section("3. Le dommage déclaré");
  pg.texte(`Déclaré le ${dateFr(litige?.cree_le || new Date())}${litige?.montant_c ? ` · montant estimé : ${eur(litige.montant_c)}` : ""}`);
  pg.texte(litige?.description || "(sans description)");
  section("4. Preuves enregistrées pendant la mission");
  pg.texte(`${photos.length} photo(s) horodatée(s), jointes ci-après.`, { taille: 9 });
  for (const ph of photos) {
    try {
      const octets = new Uint8Array(await (await fetch(ph.url)).arrayBuffer());
      const img = /png/i.test(ph.type || ph.url) ? await doc.embedPng(octets) : await doc.embedJpg(octets);
      const l = Math.min(240, img.width), h = img.height * l / img.width;
      pg.place(h + 24); pg.texte(ph.legende || "", { taille: 8.5, gras: true });
      pg.p.drawImage(img, { x: 50, y: pg.y - h + 8, width: l, height: h }); pg.y -= h + 6;
    } catch { pg.texte(`(photo non disponible : ${ph.legende || ""})`, { taille: 8 }); }
  }
  section("5. À savoir");
  pg.texte("Cleaneroo est une plateforme de mise en relation : elle n'est pas assureur et ne verse pas d'indemnité. Ce dossier réunit les éléments enregistrés par l'application pour faciliter la déclaration auprès de l'assurance responsabilité civile professionnelle du Cleaneur ou de l'assurance habitation du client.", { taille: 8.5 });
  return doc.save();
}

/* ------------------------------------------------------------------ Remettre un fichier à l'utilisateur */
/** Téléchargement ; sur téléphone, propose le partage (e-mail, messagerie, Drive…) quand c'est possible. */
export async function remettre(octets, nom, type, { partager = false } = {}) {
  const fichier = new File([octets], nom, { type });
  if (partager && navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], title: nom }); return "partage"; } catch (e) { if (e?.name === "AbortError") return "annule"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(fichier); a.download = nom; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "telecharge";
}
