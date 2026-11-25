// « Mon activité » du Cleaneur (12 novembre 2026, repris de l'appli iPhone de Vincent) : chiffre d'affaires du mois ou de
// l'année (factures de prestation + pourboires), commission Cleaneroo, cotisations URSSAF estimées (ACRE, versement libératoire),
// plafond de la micro-entreprise, rappel de déclaration, export tableur et créateur de devis (page imprimable en PDF).
// Calculs dans regles.js (calculActivite, copie dans ReglesMetier.kt). Même écran dans l'appli (Activite.kt).
import { icone } from "./icones.js";
import { supabase, mesMissions } from "./donnees.js";
import { mesFactures } from "./factures.js";
import { euros, REGLES, netPortefeuille, dateVersement, dateLongue } from "./regles.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { esc } from "./commun.js";

const CLE = "cleaneroo-activite";
const lireReglages = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } };
const garder = r => { try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* rien */ } };
const pct = n => String(n).replace(".", ",") + " %";

/* Chiffre d'affaires (prompt 4, lot 6, validé par Michael le 25/11) : en tête de l'onglet Gains, au mois ou à l'année.
   CA brut = prestations facturées + pourboires (le montant à déclarer à l'URSSAF) ; commission Cleaneroo ; net versé ;
   cotisations estimées (mêmes taux que calculActivite) ; reste. Comparaison à la même date de la période précédente,
   graphique (semaines du mois, ou 12 mois brut / net), prévisionnel des missions confirmées, objectif du mois,
   montant à déclarer avec sa date limite, plafond de la micro-entreprise (alerte à 80 %). */
const jourIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Lignes datées : CA (prestations, pourboires) et commissions. */
function lignesCA(factures, pourboires) {
  return [...factures.filter(f => f.type === "prestation").map(f => ({ jour: String(f.date_emission).slice(0, 10), ca: f.total_ttc_c || 0, com: 0, mission: 1 })),
    ...factures.filter(f => f.type === "commission").map(f => ({ jour: String(f.date_emission).slice(0, 10), ca: 0, com: f.total_ttc_c || 0, mission: 0 })),
    ...pourboires.map(x => ({ jour: String(x.cree_le).slice(0, 10), ca: x.pourboire_c || 0, com: 0, mission: 0 }))];
}
const somme = (l, de, a) => l.filter(x => x.jour >= de && x.jour <= a).reduce((s, x) => ({ ca: s.ca + x.ca, com: s.com + x.com, missions: s.missions + x.mission }), { ca: 0, com: 0, missions: 0 });
/** Chiffre d'affaires de la période (mois ou année) jusqu'à aujourd'hui, et la même durée de la période précédente. */
export function chiffreAffaires({ factures = [], pourboires = [], periode = "mois", acre = false, liberatoire = false, maintenant = new Date() }) {
  const l = lignesCA(factures, pourboires), auj = jourIso(maintenant);
  const an = maintenant.getFullYear(), m = maintenant.getMonth(), j = maintenant.getDate();
  const debut = periode === "mois" ? jourIso(new Date(an, m, 1)) : `${an}-01-01`;
  const avantDebut = periode === "mois" ? jourIso(new Date(an, m - 1, 1)) : `${an - 1}-01-01`;
  const avantFin = periode === "mois" ? jourIso(new Date(an, m - 1, Math.min(j, new Date(an, m, 0).getDate()))) : jourIso(new Date(an - 1, m, j));
  const ici = somme(l, debut, auj), avant = somme(l, avantDebut, avantFin);
  const tauxPct = Math.round(((acre ? REGLES.URSSAF_ACRE_PCT : REGLES.URSSAF_SERVICES_PCT) + (liberatoire ? REGLES.VERSEMENT_LIBERATOIRE_PCT : 0)) * 10) / 10;
  const cotisations = Math.round(ici.ca * tauxPct / 100);
  const graphe = periode === "mois"
    ? Array.from({ length: 5 }, (_, i) => { const d = 1 + i * 7, f = Math.min(d + 6, new Date(an, m + 1, 0).getDate());
        return d > new Date(an, m + 1, 0).getDate() ? null : { libelle: `${d}-${f}`, ...somme(l, jourIso(new Date(an, m, d)), jourIso(new Date(an, m, f))), futur: d > j }; }).filter(Boolean)
    : Array.from({ length: 12 }, (_, i) => ({ mois: new Date(an, i, 1), ...somme(l, jourIso(new Date(an, i, 1)), jourIso(new Date(an, i + 1, 0))), futur: i > m }));
  const caAnnee = somme(l, `${an}-01-01`, auj).ca;
  return { caC: ici.ca, commissionC: ici.com, netC: ici.ca - ici.com, cotisationsC: cotisations, resteC: Math.max(0, ici.ca - ici.com - cotisations), tauxPct,
    missions: ici.missions, avantC: avant.ca, evolutionPct: avant.ca ? Math.round((ici.ca - avant.ca) * 100 / avant.ca) : null, graphe,
    caAnneeC: caAnnee, plafondPct: Math.min(100, Math.round(100 * caAnnee / REGLES.PLAFOND_MICRO_SERVICES_C)) };
}
/** Montant à déclarer à l'URSSAF : période précédente (mois ou trimestre) et date limite (fin du mois suivant). */
export function aDeclarer({ factures = [], pourboires = [], rythme = "mois", maintenant = new Date() }) {
  const l = lignesCA(factures, pourboires), an = maintenant.getFullYear(), m = maintenant.getMonth();
  let debut, fin, libelle;
  if (rythme === "trimestre") {
    const t = Math.floor(m / 3), td = new Date(an, (t - 1) * 3, 1);
    debut = td; fin = new Date(td.getFullYear(), td.getMonth() + 3, 0);
    libelle = `T${Math.floor(td.getMonth() / 3) + 1} ${td.getFullYear()}`;
  } else {
    debut = new Date(an, m - 1, 1); fin = new Date(an, m, 0);
    libelle = debut.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  }
  return { libelle, caC: somme(l, jourIso(debut), jourIso(fin)).ca, limite: new Date(fin.getFullYear(), fin.getMonth() + 2, 0) };
}
/** CA prévu en fin de période : missions confirmées (pas encore terminées) d'ici la fin du mois ou de l'année. */
export function previsionnel(missions, periode = "mois", maintenant = new Date()) {
  const fin = periode === "mois" ? new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1) : new Date(maintenant.getFullYear() + 1, 0, 1);
  const l = (missions || []).filter(x => x.creneau && ["CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS", "A_VALIDER"].includes(x.statut)
    && new Date(x.creneau) >= new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()) && new Date(x.creneau) < fin);
  return { nombre: l.length, c: l.reduce((s, x) => s + (x.estimation_c || 0), 0) };
}
const nomMois = (d, f = "long") => d.toLocaleDateString(LOCALE, { month: f });
function blocChiffreAffaires(c, reglages, prevu) {
  const mois = reglages.periode === "mois", maintenant = new Date();
  const titrePeriode = mois ? nomMois(maintenant) : String(maintenant.getFullYear());
  const max = Math.max(1, ...c.graphe.map(g => g.ca));
  const objectif = mois ? reglages.objectifC || 0 : 0;
  const prevuTotal = c.caC + prevu.c;
  const comparaison = c.evolutionPct === null ? "" : `<span class="evolution ${c.evolutionPct >= 0 ? "hausse" : "baisse"}">${c.evolutionPct >= 0 ? "+" : ""}${c.evolutionPct} %</span>
      <span class="petit muet">${tr(mois ? "par rapport au mois dernier à la même date" : "par rapport à l'an dernier à la même date")} (${euros(c.avantC)})</span>`;
  return `<div class="choix-periode" role="tablist">${[["mois", "Mois"], ["annee", "Année"]].map(([v, t]) =>
      `<button type="button" role="tab" aria-selected="${reglages.periode === v}" data-periode="${v}">${tr(t)}</button>`).join("")}</div>
    <div class="carte ca-principal">
      <span class="ca-libelle">${tr("Chiffre d'affaires brut")} · ${esc(titrePeriode)}</span>
      <b class="ca-montant">${euros(c.caC)}</b>
      <div class="ca-comparaison">${comparaison || `<span class="petit muet">${tr("Pas encore de comparaison possible.")}</span>`}</div>
      <p class="petit muet" style="margin:4px 0 10px">${c.missions} ${tr(c.missions > 1 ? "missions facturées" : "mission facturée")}${c.missions ? ` · ${tr("moyenne par mission :")} ${euros(Math.round((c.caC) / c.missions))}` : ""} · ${tr("prestations et pourboires, le montant à déclarer")}</p>
      <div class="ligne-activite"><span>${tr("Commission Cleaneroo")}</span><span>−${euros(c.commissionC)}</span></div>
      <div class="ligne-activite"><span>${tr("Net versé par Cleaneroo")}</span><b>${euros(c.netC)}</b></div>
      <div class="ligne-activite"><span>${tr("Cotisations URSSAF estimées")} (${pct(c.tauxPct)})</span><span>−${euros(c.cotisationsC)}</span></div>
      <div class="ligne-activite total"><span>${tr("Reste pour vous")}</span><b>${euros(c.resteC)}</b></div>
      <label class="case-activite"><input type="checkbox" data-reglage="acre" ${reglages.acre ? "checked" : ""}> ${tr("ACRE (1re année, taux réduit)")}</label>
      <label class="case-activite"><input type="checkbox" data-reglage="liberatoire" ${reglages.liberatoire ? "checked" : ""}> ${tr("Versement libératoire de l'impôt")} (+${pct(REGLES.VERSEMENT_LIBERATOIRE_PCT)})</label>
      <p class="petit">${tr("Taux 2026 des prestations de services (dont le nettoyage) :")} ${pct(REGLES.URSSAF_SERVICES_PCT)}, ${tr("ou")} ${pct(REGLES.URSSAF_ACRE_PCT)} ${tr("avec l'ACRE. Estimation indicative, hors contribution à la formation professionnelle.")}</p>
    </div>
    <div class="carte">
      <b>${tr(mois ? "Semaine par semaine" : "Mois par mois")}</b>${mois ? "" : `<span class="legende-ca"><i class="brut"></i>${tr("Brut")} <i class="net"></i>${tr("Net versé")}</span>`}
      <div class="barres-ca ${mois ? "semaines" : "annee"}" role="img" aria-label="${esc(tr(mois ? "Chiffre d'affaires semaine par semaine" : "Chiffre d'affaires mois par mois"))}">
        ${c.graphe.map(g => `<div class="barre-ca${g.futur ? " futur" : ""}" title="${esc(`${g.libelle || nomMois(g.mois)} : ${euros(g.ca)}`)}">
          <span class="valeur">${g.ca ? esc(euros(g.ca).replace(/,00\s?€/, " €")) : ""}</span>
          <span class="colonnes"><i class="brut" style="height:${Math.round(g.ca / max * 100)}%"></i>${mois ? "" : `<i class="net" style="height:${Math.round(Math.max(0, g.ca - g.com) / max * 100)}%"></i>`}</span>
          <span class="lib-barre">${esc(g.libelle || nomMois(g.mois, "short"))}</span></div>`).join("")}</div>
    </div>
    <div class="carte">
      <b>${tr("Prévisionnel")}</b>
      ${prevu.nombre ? `<p style="margin:6px 0 0">${tr("Avec vos")} ${prevu.nombre} ${tr(prevu.nombre > 1 ? "missions confirmées" : "mission confirmée")}, ${tr(mois ? "votre chiffre d'affaires du mois serait de" : "votre chiffre d'affaires de l'année serait de")} <b>${euros(prevuTotal)}</b>.</p>
        <p class="petit muet" style="margin:2px 0 0">${tr("Si toutes sont réalisées et validées.")}</p>`
        : `<p class="petit muet" style="margin:6px 0 0">${tr(mois ? "Aucune autre mission confirmée d'ici la fin du mois." : "Aucune autre mission confirmée d'ici la fin de l'année.")}</p>`}
      ${mois ? `<div class="objectif-ca">
        <label class="champ"><span>${tr("Mon objectif du mois (facultatif)")}</span><input type="number" min="0" step="50" inputmode="numeric" data-objectif value="${objectif ? Math.round(objectif / 100) : ""}" placeholder="1500"></label>
        ${objectif ? `<div class="jauge-activite objectif"><i style="width:${Math.min(100, Math.round(c.caC * 100 / objectif))}%"></i><i class="prevu" style="width:${Math.min(100, Math.round(prevuTotal * 100 / objectif))}%"></i></div>
          <p class="petit" style="margin:6px 0 0">${euros(c.caC)} ${tr("sur")} ${euros(objectif)} (${Math.round(c.caC * 100 / objectif)} %)${prevu.nombre ? ` · ${tr("prévu :")} ${Math.round(prevuTotal * 100 / objectif)} %` : ""}</p>` : ""}
      </div>` : ""}
    </div>`;
}

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
  const missions = await mesMissions().catch(() => []);
  const afficher = () => {
    const c = chiffreAffaires({ factures, pourboires: avis, ...reglages });
    const decl = aDeclarer({ factures, pourboires: avis, rythme: reglages.rythme || "mois" });
    const prevu = previsionnel(missions, reglages.periode);
    boite.innerHTML = `<h2 class="titre-section">${icone("paiement")} ${tr("Mon chiffre d'affaires")}</h2>
      ${blocChiffreAffaires(c, reglages, prevu)}
      <div class="carte">
        <b>${tr("À déclarer à l'URSSAF")}</b>
        <label class="champ" style="margin:8px 0 0"><span>${tr("Je déclare")}</span><select data-rythme>
          <option value="mois"${(reglages.rythme || "mois") === "mois" ? " selected" : ""}>${tr("chaque mois")}</option>
          <option value="trimestre"${reglages.rythme === "trimestre" ? " selected" : ""}>${tr("chaque trimestre")}</option></select></label>
        <p style="margin:10px 0 0">${tr("Chiffre d'affaires de")} ${esc(decl.libelle)} : <b>${euros(decl.caC)}</b></p>
        <p class="petit" style="margin:2px 0 10px">${tr("À déclarer avant le")} <b>${esc(dateLongue(decl.limite))}</b>, ${tr("même s'il est nul.")}</p>
        <a class="bouton secondaire" href="https://autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">autoentrepreneur.urssaf.fr ↗</a>
      </div>
      <div class="carte">
        <b>${tr("Plafond de la micro-entreprise")}</b>
        <div class="jauge-activite ${c.plafondPct >= 80 ? "alerte" : ""}"><i style="width:${c.plafondPct}%"></i></div>
        <p class="petit" style="margin:6px 0 0">${euros(c.caAnneeC)} ${tr("sur")} ${euros(REGLES.PLAFOND_MICRO_SERVICES_C)} ${tr("cette année")} (${c.plafondPct} %)</p>
        ${c.plafondPct >= 80 ? `<p class="petit" style="margin:6px 0 0;color:var(--alerte);font-weight:700">${icone("alerte")} ${tr("Vous approchez du plafond : parlez-en à un expert-comptable avant de le dépasser.")}</p>` : ""}
        <p class="petit">${tr("Au-delà du plafond des prestations de services, vous sortez du régime micro. Surveillez-le en fin d'année.")}</p>
      </div>
      <div class="carte">
        <b>${icone("paiement")} ${tr("Portefeuille de l'année")}</b>
        <div class="ligne-activite"><span>${tr("Prestations")}</span><span>${euros(portefeuille.prestations_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Commission Cleaneroo")}</span><span>−${euros(portefeuille.commissions_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Pourboires")}</span><span>+${euros(portefeuille.pourboires_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Primes d'urgence")}</span><span>+${euros(portefeuille.primes_c || 0)}</span></div>
        <div class="ligne-activite"><span>${tr("Moins-values")}</span><span>−${euros(portefeuille.moins_values_c || 0)}</span></div>
        <div class="ligne-activite total"><span>${tr("Net de l'année")}</span><b>${euros(netPortefeuille(portefeuille))}</b></div>
        <p class="petit">${tr("Prochain versement :")} ${dateLongue(dateVersement(new Date()))}.</p>
      </div>
      <div class="carte" id="versements"><b>${icone("carte-bancaire")} ${tr("Mes versements")}</b><p class="petit">…</p></div>
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
    boite.querySelectorAll("[data-reglage]").forEach(x => x.onchange = () => { reglages[x.dataset.reglage] = x.checked; garder(reglages); afficher(); });
    boite.querySelector("[data-rythme]").onchange = e => { reglages.rythme = e.target.value; garder(reglages); afficher(); };
    const obj = boite.querySelector("[data-objectif]");
    if (obj) obj.onchange = () => { reglages.objectifC = Math.max(0, Math.round(Number(obj.value) || 0)) * 100; garder(reglages); afficher(); };
    boite.querySelector("[data-export]").onclick = () => exporter(factures, avis);
    boite.querySelector("[data-devis]").onclick = () => devis(boite.querySelector(".devis-activite"), profil);
    blocVersements(boite.querySelector("#versements"));
  };
  afficher();
}

/** Versements (Stripe Connect, 22/11/2026) : identité et IBAN saisis sur la page sécurisée de Stripe, jamais chez Cleaneroo.
 *  Chaque prestation validée est versée au Cleaneur (prestation − commission + pourboire), puis virée sur son IBAN le vendredi. */
async function blocVersements(el) {
  if (!el) return;
  const appeler = async action => {
    const { data, error } = await supabase.functions.invoke("paiement", { body: { action } });
    if (error) { try { return await error.context?.json(); } catch { return { erreur: "service" }; } }
    return data || {};
  };
  const e = await appeler("connect_etat");
  if (!el.isConnected) return;
  const [texte, bouton] = e.actif ? ["✓ Versements activés : chaque prestation vous est versée 48 h après la fin (délai de réclamation du client), puis virée sur votre compte bancaire le vendredi.", "Modifier mes informations bancaires"]
    : e.compte ? ["Votre compte de versement est à compléter (identité, IBAN) pour recevoir vos paiements.", "Compléter mon compte de versement"]
    : ["Renseignez votre identité et votre IBAN sur la page sécurisée de Stripe pour recevoir vos paiements : Cleaneroo ne conserve pas votre IBAN.", "Activer mes versements"];
  el.innerHTML = `<b>${icone("carte-bancaire")} ${tr("Mes versements")}</b><p class="petit" style="margin:4px 0 10px">${tr(texte)}</p>
    <p class="petit" style="margin:0 0 10px">${tr("Moins-values (pénalité, remboursement après un litige) : retenues sur vos versements suivants, jamais plus de la moitié d'un versement.")}</p>
    <button type="button" class="bouton ${e.actif ? "secondaire" : "plein"}" data-versements>${tr(bouton)}</button><p class="erreur" data-erreur-versements style="margin:8px 0 0"></p>`;
  traduire(el);
  el.querySelector("[data-versements]").onclick = async ev => {
    ev.target.disabled = true;
    const r = await appeler("connect");
    if (r.url) { location.href = r.url; return; }
    ev.target.disabled = false;
    el.querySelector("[data-erreur-versements]").textContent = tr(r.erreur === "connect_inactif" ? "Les versements en ligne ne sont pas encore activés. Réessayez bientôt."
      : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
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
    .tuiles-revenus{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
    .tuile-revenu{display:grid;gap:2px;padding:10px 12px;border-radius:14px;background:var(--creux)}
    .tuile-revenu span{font-size:12px;color:var(--texte2)}
    .tuile-revenu b{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
    .graphe-revenus{margin:14px 0 0}
    .graphe-revenus .barres{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end;height:150px;margin-top:6px}
    .graphe-revenus .barre{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:4px;min-width:0}
    .graphe-revenus .barre .colonne{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
    .graphe-revenus .barre i{display:block;width:100%;max-width:44px;border-radius:8px 8px 3px 3px;background:color-mix(in srgb,var(--turquoise) 45%,var(--surface))}
    .graphe-revenus .barre.actuelle i{background:linear-gradient(180deg,#04BEE5,#0DC88D)}
    .graphe-revenus .valeur{font-size:11px;font-weight:700;color:var(--texte2);white-space:nowrap}
    .graphe-revenus .mois{font-size:12px;color:var(--texte3);text-transform:capitalize}
    @media (max-width:560px){.tuiles-revenus{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .ca-principal{display:grid;gap:2px}
    .ligne-activite>*:last-child{white-space:nowrap}
    .ca-libelle{font-weight:700;color:var(--texte2);text-transform:none}
    .ca-montant{font-size:clamp(34px,5vw,44px);font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1;color:var(--primaire)}
    .ca-comparaison{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .evolution{padding:2px 9px;border-radius:999px;font-size:13px;font-weight:800}
    .evolution.hausse{background:color-mix(in srgb,var(--succes) 16%,var(--surface));color:var(--succes)}
    .evolution.baisse{background:color-mix(in srgb,var(--alerte) 16%,var(--surface));color:var(--alerte)}
    .legende-ca{float:right;display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--texte2)}
    .legende-ca i{display:inline-block;width:10px;height:10px;border-radius:3px}
    .legende-ca .brut,.barres-ca .brut{background:color-mix(in srgb,var(--turquoise) 55%,var(--surface))}
    .legende-ca .net,.barres-ca .net{background:linear-gradient(180deg,#04BEE5,#0DC88D)}
    .barres-ca{display:grid;gap:6px;align-items:end;height:170px;margin-top:12px}
    .barres-ca.semaines{grid-template-columns:repeat(5,1fr)}
    .barres-ca.annee{grid-template-columns:repeat(12,1fr)}
    .barre-ca{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:4px;min-width:0}
    .barre-ca .colonnes{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:2px}
    .barre-ca .colonnes i{display:block;flex:1;max-width:26px;border-radius:6px 6px 2px 2px}
    .barres-ca.semaines .colonnes i{max-width:48px}
    .barre-ca.futur{opacity:.45}
    .barre-ca .valeur{font-size:10.5px;font-weight:700;color:var(--texte2);white-space:nowrap}
    .barres-ca.annee .valeur{display:none}
    .barre-ca .lib-barre{font-size:11.5px;color:var(--texte3);text-transform:capitalize;white-space:nowrap}
    .objectif-ca{margin-top:12px}
    .objectif-ca .champ{margin:0;max-width:240px}
    .jauge-activite.objectif{position:relative}
    .jauge-activite.objectif i.prevu{position:absolute;left:0;top:0;bottom:0;opacity:.3}
    @media (max-width:560px){.barres-ca.annee{gap:3px}.barres-ca.annee .lib-barre{font-size:10px}}
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
