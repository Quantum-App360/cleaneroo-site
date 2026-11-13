// Espace Conciergerie, outils de travail (13 novembre 2026) — inspirés des logiciels de conciergerie (Turno, Breezeway, Hostaway) :
//  • « Aujourd'hui » : poste de pilotage — alertes (départs sans ménage, stock bas, incidents, calendriers en erreur) et rotations du jour et du lendemain ;
//  • « Ménages » : tous les ménages des biens, à venir et passés, filtrés par bien et par état ;
//  • « Rapports » : par mois et par bien — ménages, coût, nuits occupées, taux d'occupation ; export pour les propriétaires ;
//  • fiche de chaque bien : stock (consommables et linge, alerte sous le seuil) et incidents (casse, panne, à réparer).
// Stock et incidents sont enregistrés avec le bien (champs stock / incidents). Même espace dans l'appli (Conciergerie.kt).
import { enregistrerBien } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, dateCourte } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { esc } from "./commun.js";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourDe = s => { const [a, m, j] = s.split("-").map(Number); return new Date(a, m - 1, j); };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const memeAdresse = (d, l) => (d.rue || "").trim().toLowerCase() === (l.rue || "").trim().toLowerCase() && (d.code_postal || d.codePostal) === l.codePostal;
export const ETATS = { VERIFICATION: "En vérification", PUBLIEE: "Recherche d'un Cleaneur", CONFIRMEE: "Cleaneur confirmé", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "Ménage en cours", A_VALIDER: "À valider", TERMINEE: "Terminé", ANNULEE: "Annulé" };

/* ------------------------------------------------------------------ Stock et incidents d'un bien */

/** Articles proposés au départ (consommables et linge). */
export const STOCK_CONSEILLE = ["Papier toilette", "Gel douche et shampoing", "Savon pour les mains", "Liquide vaisselle", "Éponges", "Sacs poubelle",
  "Café, thé, sucre", "Produits ménagers", "Jeux de draps", "Serviettes de bain", "Torchons"];
export const stockDe = l => Array.isArray(l?.stock) ? l.stock : [];
export const incidentsDe = l => Array.isArray(l?.incidents) ? l.incidents : [];
/** Articles sous le seuil d'alerte. Fonction pure, testée. */
export const stockBas = l => stockDe(l).filter(a => Number(a.qte) <= Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT));
const ouverts = l => incidentsDe(l).filter(i => i.statut !== "RESOLU");
const fichesOuvertes = new Set();

export function editeurStock(l) {
  const st = stockDe(l), bas = stockBas(l);
  return `<details class="outil-bien" data-outil="stock-${esc(l.id)}" ${fichesOuvertes.has("stock-" + l.id) ? "open" : ""}>
    <summary>📦 ${tr("Stock et linge")} ${bas.length ? `<span class="tampon spam">${bas.length} ${tr(bas.length > 1 ? "articles à racheter" : "article à racheter")}</span>` : st.length ? `<span class="tampon vert">${tr("OK")}</span>` : ""}</summary>
    <p class="petit">${tr("Ce qui doit être sur place pour les voyageurs. Une alerte apparaît dans « Aujourd'hui » quand un article passe sous son seuil.")}</p>
    ${st.length ? `<div class="table-stock">${st.map((a, i) => `<div class="ligne-stock ${bas.includes(a) ? "bas" : ""}"><span>${esc(tr(a.nom))}</span>
      <span class="qte"><button type="button" class="pas" data-stock="${esc(l.id)}:${i}:-1" aria-label="${esc(tr("Moins"))}">−</button><b>${Number(a.qte)}</b>
      <button type="button" class="pas" data-stock="${esc(l.id)}:${i}:1" aria-label="${esc(tr("Plus"))}">+</button></span>
      <span class="petit">${tr("seuil")} ${Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT)}</span>
      <button type="button" class="lien-bouton" data-stock-retirer="${esc(l.id)}:${i}">${tr("Retirer")}</button></div>`).join("")}</div>`
      : `<button type="button" class="bouton secondaire" data-stock-conseille="${esc(l.id)}">${tr("Ajouter la liste conseillée")}</button>`}
    <form class="ajout-ligne" data-stock-ajout="${esc(l.id)}" novalidate><input class="texte" name="nom" maxlength="60" placeholder="${esc(tr("Article (ex. : capsules de café)"))}">
      <input class="texte" name="qte" type="number" min="0" max="999" value="4" aria-label="${esc(tr("Quantité"))}"><input class="texte" name="seuil" type="number" min="0" max="99" value="${REGLES.STOCK_SEUIL_DEFAUT}" aria-label="${esc(tr("Seuil d'alerte"))}">
      <button class="lien-bouton" type="submit">${tr("Ajouter")}</button></form></details>`;
}

export function editeurIncidents(l) {
  const liste = incidentsDe(l), ouv = ouverts(l);
  return `<details class="outil-bien" data-outil="incidents-${esc(l.id)}" ${fichesOuvertes.has("incidents-" + l.id) ? "open" : ""}>
    <summary>🛠️ ${tr("Incidents et réparations")} ${ouv.length ? `<span class="tampon spam">${ouv.length} ${tr(ouv.length > 1 ? "ouverts" : "ouvert")}</span>` : ""}</summary>
    <p class="petit">${tr("Casse, panne, objet manquant : notez-le, transmettez-le à votre artisan, marquez-le résolu.")}</p>
    ${liste.slice().reverse().map(x => { const i = liste.indexOf(x); return `<div class="ligne-incident ${x.statut === "RESOLU" ? "resolu" : ""}">
      <div><b>${esc(x.texte)}</b><span class="petit"> · ${dateCourte(new Date(x.date))}${x.statut === "RESOLU" ? ` · ✓ ${tr("Résolu")}` : ""}</span></div>
      <div class="actions">${x.statut === "RESOLU" ? "" : `<a class="lien-bouton" href="sms:?&body=${encodeURIComponent(`${l.nom || l.rue} (${l.rue}, ${l.ville}) : ${x.texte}`)}">${tr("Envoyer à l'artisan")}</a>
        <button type="button" class="lien-bouton" data-incident-resolu="${esc(l.id)}:${i}">${tr("Marquer résolu")}</button>`}</div></div>`; }).join("")}
    <form class="ajout-ligne" data-incident-ajout="${esc(l.id)}" novalidate><input class="texte" name="texte" maxlength="160" placeholder="${esc(tr("Ex. : ampoule de la salle de bain grillée"))}">
      <button class="lien-bouton" type="submit">${tr("Signaler")}</button></form></details>`;
}

export function brancherOutilsBiens(vue, biens, recharger) {
  const bien = id => biens.find(b => b.id === id);
  const sauver = async (l, champs, cle) => { fichesOuvertes.add(cle); try { await enregistrerBien({ ...l, ...champs }); recharger(); } catch { alert(tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")); } };
  vue.querySelectorAll("[data-stock]").forEach(b => b.onclick = () => {
    const [id, i, pas] = b.dataset.stock.split(":"), l = bien(id), st = stockDe(l).slice();
    st[i] = { ...st[i], qte: Math.max(0, Number(st[i].qte) + Number(pas)) };
    sauver(l, { stock: st }, "stock-" + id);
  });
  vue.querySelectorAll("[data-stock-retirer]").forEach(b => b.onclick = () => {
    const [id, i] = b.dataset.stockRetirer.split(":"), l = bien(id);
    sauver(l, { stock: stockDe(l).filter((_, k) => k !== Number(i)) }, "stock-" + id);
  });
  vue.querySelectorAll("[data-stock-conseille]").forEach(b => b.onclick = () => {
    const l = bien(b.dataset.stockConseille);
    sauver(l, { stock: STOCK_CONSEILLE.map(nom => ({ nom, qte: 4, seuil: REGLES.STOCK_SEUIL_DEFAUT })) }, "stock-" + l.id);
  });
  vue.querySelectorAll("[data-stock-ajout]").forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const l = bien(f.dataset.stockAjout), nom = f.nom.value.trim();
    if (!nom) return;
    sauver(l, { stock: [...stockDe(l), { nom, qte: Number(f.qte.value) || 0, seuil: Number(f.seuil.value) || 0 }].slice(0, 60) }, "stock-" + l.id);
  });
  vue.querySelectorAll("[data-incident-ajout]").forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const l = bien(f.dataset.incidentAjout), texte = f.texte.value.trim();
    if (!texte) return;
    sauver(l, { incidents: [...incidentsDe(l), { id: `i${Date.now().toString(36)}`, date: new Date().toISOString(), texte, statut: "OUVERT" }].slice(-100) }, "incidents-" + l.id);
  });
  vue.querySelectorAll("[data-incident-resolu]").forEach(b => b.onclick = () => {
    const [id, i] = b.dataset.incidentResolu.split(":"), l = bien(id), liste = incidentsDe(l).slice();
    liste[i] = { ...liste[i], statut: "RESOLU", resolu_le: new Date().toISOString() };
    sauver(l, { incidents: liste }, "incidents-" + id);
  });
  vue.querySelectorAll("details.outil-bien").forEach(d => d.ontoggle = () => { d.open ? fichesOuvertes.add(d.dataset.outil) : fichesOuvertes.delete(d.dataset.outil); });
}

/* ------------------------------------------------------------------ Aujourd'hui : poste de pilotage */

/**
 * Alertes du jour. Fonction pure, testée : départs à moins de 48 h sans ménage, stock bas, incidents ouverts, calendriers en erreur.
 * sejours : [{ bienId, debut, fin }] ; menagePrevu(bienId, jourIso) ; erreurs : { url: raison }.
 */
export function alertes({ biens, sejours, menagePrevu, erreurs = {}, aujourdhui = new Date() }) {
  const auj = iso(aujourdhui), limite = iso(plusJours(aujourdhui, 2));
  const l = [];
  const departs = sejours.filter((s, i, t) => s.fin >= auj && s.fin <= limite && !menagePrevu(s.bienId, s.fin) && t.findIndex(x => x.bienId === s.bienId && x.fin === s.fin) === i);
  departs.forEach(s => l.push({ niveau: "urgent", type: "depart", bienId: s.bienId, jour: s.fin }));
  biens.forEach(b => {
    const bas = stockBas(b); if (bas.length) l.push({ niveau: "attention", type: "stock", bienId: b.id, n: bas.length, articles: bas.map(a => a.nom) });
    const ouv = ouverts(b); if (ouv.length) l.push({ niveau: "attention", type: "incident", bienId: b.id, n: ouv.length, texte: ouv[ouv.length - 1].texte });
    const ko = (b.calendriers || []).filter(c => erreurs[c.url]); if (ko.length) l.push({ niveau: "attention", type: "calendrier", bienId: b.id, n: ko.length });
  });
  return l;
}

export function blocAujourdhui(boite, { biens, sejours, demandes, menageDe, erreurs, nomBien, couleur, programmer, aujourdhui = new Date() }) {
  if (!boite) return;
  const auj = iso(aujourdhui), demain = iso(plusJours(aujourdhui, 1));
  const al = alertes({ biens, sejours, menagePrevu: (b, j) => !!menageDe(b, j), erreurs, aujourdhui });
  const bien = id => biens.find(b => b.id === id);
  const texteAlerte = a => ({
    depart: () => `${tr("Départ sans ménage")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${a.jour === auj ? tr("aujourd'hui") : a.jour === demain ? tr("demain") : dateCourte(jourDe(a.jour))}`,
    stock: () => `${tr("Stock bas")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${a.articles.slice(0, 3).map(x => esc(tr(x))).join(", ")}${a.n > 3 ? "…" : ""}`,
    incident: () => `${a.n} ${tr(a.n > 1 ? "incidents ouverts" : "incident ouvert")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${esc(a.texte)}`,
    calendrier: () => `${tr("Calendrier injoignable")} · <b>${esc(nomBien(bien(a.bienId)))}</b>`,
  })[a.type]();
  const rotation = (l, j) => {
    const dep = sejours.find(s => s.bienId === l.id && s.fin === j), arr = sejours.find(s => s.bienId === l.id && s.debut === j);
    if (!dep && !arr) return "";
    const m = menageDe(l.id, j), prochaine = sejours.filter(s => s.bienId === l.id && s.debut >= j).sort((a, b) => a.debut.localeCompare(b.debut))[0];
    return `<div class="rotation" style="--c:${couleur(l.id)}">
      <div class="rot-bien"><span class="pl-pastille"></span><b>${esc(nomBien(l))}</b><span class="petit">${esc(l.ville || "")}</span></div>
      <div class="rot-flux">
        ${dep ? `<span class="rot-etape">🧳 ${tr("Départ")} <b>${REGLES.DEPART_VOYAGEURS_DEFAUT_H} h</b></span>` : ""}
        ${dep ? (m ? `<span class="rot-etape menage etat-${esc(m.statut)}">${icone(rubrique(m.rubrique_id)?.icone || "termine")} ${tr(ETATS[m.statut] || "")}</span>`
          : `<button type="button" class="bouton petit" data-programmer="${esc(l.id)}" data-jour="${j}">${tr("Programmer le ménage")}</button>`) : ""}
        ${arr || (dep && prochaine && prochaine.debut === j) ? `<span class="rot-etape">🔑 ${tr("Arrivée")} <b>${REGLES.ARRIVEE_SUIVANTE_DEFAUT_H} h</b></span>` : prochaine ? `<span class="rot-etape petit">${tr("Prochaine arrivée")} ${dateCourte(jourDe(prochaine.debut))}</span>` : ""}
        ${dep && arr ? `<span class="tampon">${tr("Rotation le jour même")}</span>` : ""}
      </div></div>`;
  };
  const jour = (j, titre) => { const r = biens.map(l => rotation(l, j)).filter(Boolean);
    return `<div class="carte jour-rotations"><h3>${titre} <span class="petit">${dateLongue(jourDe(j))}</span></h3>${r.length ? r.join("") : `<p class="muet petit">${tr("Aucun départ ni arrivée.")}</p>`}</div>`; };
  boite.innerHTML = `<div class="alertes-concierge">${al.length ? al.map(a => `<div class="alerte-concierge ${a.niveau}">${{ depart: "⏰", stock: "📦", incident: "🛠️", calendrier: "📅" }[a.type]}
      <span>${texteAlerte(a)}</span>${a.type === "depart" ? `<button type="button" class="bouton petit" data-programmer="${esc(a.bienId)}" data-jour="${a.jour}">${tr("Programmer")}</button>` : ""}</div>`).join("")
    : `<div class="alerte-concierge ok">✅ <span>${tr("Tout est en ordre : chaque départ des prochaines 48 h a son ménage, aucun stock bas, aucun incident ouvert.")}</span></div>`}</div>
    <div class="grille-rotations">${jour(auj, tr("Aujourd'hui"))}${jour(demain, tr("Demain"))}</div>`;
  boite.querySelectorAll("[data-programmer]").forEach(b => b.onclick = () => programmer(b.dataset.programmer, b.dataset.jour));
  traduire(boite);
}

/* ------------------------------------------------------------------ Ménages : tous les ménages des biens */
let filtreMenages = { bien: "", periode: "avenir" };
export function blocMenages(boite, { biens, demandes, nomBien }) {
  if (!boite) return;
  const maintenant = new Date().toISOString();
  const lesMiens = demandes.filter(d => biens.some(b => memeAdresse(d, b)));
  const dessiner = () => {
    const liste = lesMiens.filter(d => (!filtreMenages.bien || memeAdresse(d, biens.find(b => b.id === filtreMenages.bien)))
      && (filtreMenages.periode === "avenir" ? !["TERMINEE", "ANNULEE"].includes(d.statut) : ["TERMINEE", "ANNULEE"].includes(d.statut) || (d.creneau || "") < maintenant))
      .sort((a, b) => (filtreMenages.periode === "avenir" ? 1 : -1) * String(a.creneau || a.cree_le).localeCompare(String(b.creneau || b.cree_le)));
    boite.innerHTML = `<div class="filtres-menages">
        <div class="segments"><button type="button" data-periode="avenir" class="${filtreMenages.periode === "avenir" ? "choisi" : ""}">${tr("À venir")}</button>
          <button type="button" data-periode="passes" class="${filtreMenages.periode === "passes" ? "choisi" : ""}">${tr("Passés")}</button></div>
        ${biens.length > 1 ? `<select class="texte" data-filtre-bien aria-label="${esc(tr("Bien"))}"><option value="">${tr("Tous les biens")}</option>${biens.map(b => `<option value="${esc(b.id)}" ${filtreMenages.bien === b.id ? "selected" : ""}>${esc(nomBien(b))}</option>`).join("")}</select>` : ""}
      </div>
      ${liste.length ? `<div class="liste-menages">${liste.map(d => { const b = biens.find(x => memeAdresse(d, x)), r = rubrique(d.rubrique_id);
        return `<a class="carte ligne-menage" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">
          <span class="b-menage b-presta grand etat-${esc(d.statut)}">${icone(r?.icone || "termine")}</span>
          <span class="corps"><b>${esc(b ? nomBien(b) : d.ville)}</b><span class="petit">${esc(r?.nom || "")} · ${d.creneau ? `${dateCourte(new Date(d.creneau))} ${new Date(d.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}` : tr("Date à fixer")}</span></span>
          <span class="droite"><span class="etat-texte etat-${esc(d.statut)}">${tr(ETATS[d.statut] || d.statut)}</span><b>${d.sur_devis ? tr("Sur devis") : euros(d.estimation_c)}</b></span></a>`; }).join("")}</div>`
        : `<div class="vide-compte"><p class="muet">${tr(filtreMenages.periode === "avenir" ? "Aucun ménage à venir." : "Aucun ménage passé.")}</p></div>`}`;
    boite.querySelectorAll("[data-periode]").forEach(b => b.onclick = () => { filtreMenages.periode = b.dataset.periode; dessiner(); });
    const s = boite.querySelector("[data-filtre-bien]"); if (s) s.onchange = () => { filtreMenages.bien = s.value; dessiner(); };
    traduire(boite);
  };
  dessiner();
}

/* ------------------------------------------------------------------ Rapports : par mois et par bien */

/** Chiffres d'un mois pour un bien. Fonction pure, testée. mois : Date du 1er du mois. */
export function chiffresMois(bien, mois, sejours, demandes) {
  const debut = iso(mois), finMois = iso(new Date(mois.getFullYear(), mois.getMonth() + 1, 1)), jours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const nuits = sejours.filter(s => s.bienId === bien.id).reduce((n, s) => {
    const a = s.debut > debut ? s.debut : debut, b = s.fin < finMois ? s.fin : finMois;
    return n + Math.max(0, Math.round((jourDe(b) - jourDe(a)) / 864e5));
  }, 0);
  const menages = demandes.filter(d => d.statut !== "ANNULEE" && d.creneau && memeAdresse(d, bien) && d.creneau.slice(0, 10) >= debut && d.creneau.slice(0, 10) < finMois);
  return { nuits: Math.min(nuits, jours), occupation: Math.round(100 * Math.min(nuits, jours) / jours), menages: menages.length,
    coutC: menages.reduce((s, d) => s + (d.estimation_c || 0), 0), sejours: sejours.filter(s => s.bienId === bien.id && s.fin > debut && s.debut < finMois).length };
}

let moisRapport = null;
export function blocRapports(boite, { biens, sejours, demandes, nomBien, societe }) {
  if (!boite) return;
  moisRapport = moisRapport || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const dessiner = () => {
    const lignes = biens.map(b => ({ b, ...chiffresMois(b, moisRapport, sejours, demandes) }));
    const total = lignes.reduce((t, x) => ({ nuits: t.nuits + x.nuits, menages: t.menages + x.menages, coutC: t.coutC + x.coutC, sejours: t.sejours + x.sejours }), { nuits: 0, menages: 0, coutC: 0, sejours: 0 });
    const nomMois = moisRapport.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
    boite.innerHTML = `<div class="entete-rapport"><button type="button" class="lien-bouton" data-mois="-1" aria-label="${esc(tr("Mois précédent"))}">‹</button>
        <b>${nomMois}</b><button type="button" class="lien-bouton" data-mois="1" aria-label="${esc(tr("Mois suivant"))}">›</button>
        <span class="espace"></span><button type="button" class="bouton secondaire petit" data-export>${tr("Exporter (Excel)")}</button>
        <button type="button" class="bouton secondaire petit" data-imprimer>${tr("Relevé à imprimer")}</button></div>
      <div class="tuiles-chiffres tuiles-conciergerie">
        <div class="tuile-chiffre"><b>${total.sejours}</b><span>${tr("Séjours")}</span></div>
        <div class="tuile-chiffre"><b>${total.nuits}</b><span>${tr("Nuits occupées")}</span></div>
        <div class="tuile-chiffre"><b>${total.menages}</b><span>${tr("Ménages")}</span></div>
        <div class="tuile-chiffre"><b>${euros(total.coutC)}</b><span>${tr("Coût des ménages")}</span></div></div>
      <div class="table-rapport" role="table"><div class="tr entete" role="row"><span>${tr("Bien")}</span><span>${tr("Séjours")}</span><span>${tr("Nuits")}</span><span>${tr("Occupation")}</span><span>${tr("Ménages")}</span><span>${tr("Coût")}</span></div>
        ${lignes.map(x => `<div class="tr" role="row"><span><b>${esc(nomBien(x.b))}</b></span><span>${x.sejours}</span><span>${x.nuits}</span>
          <span><i class="jauge-occ"><i style="width:${x.occupation}%"></i></i> ${x.occupation} %</span><span>${x.menages}</span><span>${euros(x.coutC)}</span></div>`).join("")}</div>
      <p class="petit">${tr("Nuits lues dans vos calendriers et séjours saisis ; coût des ménages au prix estimé de chaque réservation.")}</p>`;
    boite.querySelectorAll("[data-mois]").forEach(b => b.onclick = () => { moisRapport = new Date(moisRapport.getFullYear(), moisRapport.getMonth() + Number(b.dataset.mois), 1); dessiner(); });
    boite.querySelector("[data-export]").onclick = () => {
      const csv = [["bien", "adresse", "sejours", "nuits", "occupation_pct", "menages", "cout_eur"], ...lignes.map(x => [nomBien(x.b), `${x.b.rue}, ${x.b.codePostal} ${x.b.ville}`, x.sejours, x.nuits, x.occupation, x.menages, (x.coutC / 100).toFixed(2).replace(".", ",")])]
        .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `cleaneroo-rapport-${iso(moisRapport).slice(0, 7)}.csv`; a.click();
    };
    boite.querySelector("[data-imprimer]").onclick = () => {
      const w = window.open("", "_blank"); if (!w) return;
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(tr("Relevé"))} ${esc(nomMois)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#14232E}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#EEF6F5}</style>
        <h1>${esc(tr("Relevé d'activité"))} · ${esc(nomMois)}</h1><p>${esc(societe || "")}</p>
        <table><tr><th>${esc(tr("Bien"))}</th><th>${esc(tr("Séjours"))}</th><th>${esc(tr("Nuits"))}</th><th>${esc(tr("Occupation"))}</th><th>${esc(tr("Ménages"))}</th><th>${esc(tr("Coût"))}</th></tr>
        ${lignes.map(x => `<tr><td>${esc(nomBien(x.b))}<br><small>${esc(x.b.rue)}, ${esc(x.b.codePostal)} ${esc(x.b.ville)}</small></td><td>${x.sejours}</td><td>${x.nuits}</td><td>${x.occupation} %</td><td>${x.menages}</td><td>${euros(x.coutC)}</td></tr>`).join("")}
        <tr><th>${esc(tr("Total"))}</th><th>${total.sejours}</th><th>${total.nuits}</th><th></th><th>${total.menages}</th><th>${euros(total.coutC)}</th></tr></table>
        <p><small>Cleaneroo · cleaneroo.fr</small></p><script>print()<\/script>`);
      w.document.close();
    };
    traduire(boite);
  };
  dessiner();
}
