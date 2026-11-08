// Missions du Cleaneur (onglet Cleaneur de « Mon compte ») : missions disponibles, « Prendre la mission » (rattachement
// automatique), étapes Je pars › Je suis arrivé › Je commence › J'ai terminé, et partage de la position pendant le trajet.
// Mêmes écrans que l'application (EspacesCompte.kt / ServiceTrajet.kt).
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure, duree } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr } from "./langue.js";
import { missionsDisponibles, mesMissions, prendreMission, avancerMission, envoyerPosition, lienPhotoDemande,
  selfieDuJour, deposerSelfie, quitterLogement, selfiesAVerifier, deciderSelfie, lienSelfie, lienDocument,
  mesAvertissements, avertissementsCleaneurs, avertirCleaneur, leverBannissement } from "./donnees.js";
import { afficherCarte, coordonnees } from "./cartes.js";
import { brancherControle } from "./controle-ecran.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ETAPE = {
  CONFIRMEE: ["🚗 Je pars", "EN_ROUTE", "Confirmée"],
  EN_ROUTE: ["📍 Je suis arrivé", "SUR_PLACE", "En route"],
  SUR_PLACE: ["🧽 Je commence", "EN_COURS", "Sur place"],
  EN_COURS: ["✅ J'ai terminé", "A_VALIDER", "En cours"],
  A_VALIDER: ["🚪 Je quitte le logement", "DEPART", "À valider par le client"],
};

/* ------------------------------------------------------------------ Frise de la mission (curseur qui suit le Cleaneur)
   En route › Arrivé sur place › Début du ménage › Fin du ménage › Départ du logement, avec l'heure de chaque étape. */
const ETAPES_FRISE = [["en_route", "En route"], ["sur_place", "Arrivé sur place"], ["debut", "Début du ménage"], ["fin", "Fin du ménage"], ["depart", "Départ du logement"]];
export function friseMission(m) {
  const e = m.etapes || {}, faites = ETAPES_FRISE.filter(([k]) => e[k]).length;
  const courante = faites < ETAPES_FRISE.length ? faites : -1;   // étape en cours (le curseur avance vers elle)
  const depuis = faites ? e[ETAPES_FRISE[faites - 1][0]] : null;
  const pct = Math.min(100, (faites === 0 ? 0 : (faites - 1) / (ETAPES_FRISE.length - 1) * 100) + (faites && faites < ETAPES_FRISE.length ? 100 / (ETAPES_FRISE.length - 1) / 2 : 0));
  return `<div class="frise-mission" role="list" aria-label="${esc(tr("Étapes de la mission"))}" data-depuis="${esc(depuis || "")}">
    <div class="frise-rail"><span class="frise-plein" style="width:${faites ? pct : 0}%"></span>${faites ? `<i class="frise-curseur" style="left:${pct}%"></i>` : ""}</div>
    <ol>${ETAPES_FRISE.map(([k, nom], i) => `<li role="listitem" class="${e[k] ? "fait" : i === courante ? "courante" : ""}">
      <b>${e[k] ? "✓" : i + 1}</b><span>${nom}</span><small>${e[k] ? heure(new Date(e[k]).getHours(), new Date(e[k]).getMinutes()) : ""}</small></li>`).join("")}</ol>
    ${depuis && faites < ETAPES_FRISE.length ? `<p class="petit frise-temps" data-temps-etape></p>` : ""}</div>`;
}
/** « depuis 12 min » sous la frise, mis à jour chaque minute. */
function majTemps(boite) {
  boite.querySelectorAll(".frise-mission").forEach(f => {
    const t = f.querySelector("[data-temps-etape]");
    if (!t || !f.dataset.depuis) return;
    const min = Math.max(0, Math.round((Date.now() - new Date(f.dataset.depuis)) / 60000));
    t.textContent = tr("Étape en cours depuis {n} min").replace("{n}", min);
  });
}
let minuterieFrise = 0;

/* Style des nouveaux blocs (frise, selfie), ajouté une seule fois. */
export function styles() {
  if (document.getElementById("style-missions-etapes")) return;
  const st = document.createElement("style");
  st.id = "style-missions-etapes";
  st.textContent = `
  .frise-mission { margin: 12px 0 4px; }
  .frise-rail { position: relative; height: 6px; border-radius: 3px; background: var(--creux); margin: 10px 14px 0; }
  .frise-plein { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--degrade); transition: width .5s; }
  .frise-curseur { position: absolute; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: #fff;
    border: 4px solid var(--turquoise); box-shadow: 0 2px 8px rgba(8,38,42,.25); transition: left .5s; }
  .frise-curseur::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; background: rgba(42,157,147,.30); animation: onde-frise 1.8s ease-out infinite; }
  @keyframes onde-frise { from { transform: scale(.5); opacity: .9; } to { transform: scale(1.4); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .frise-curseur::after { animation: none; } }
  .frise-mission ol { list-style: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; padding: 0; margin: 8px 0 0; text-align: center; }
  .frise-mission li { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11.5px; color: var(--texte3); line-height: 1.2; }
  .frise-mission li b { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--creux); font-size: 12px; }
  .frise-mission li.fait { color: var(--texte); } .frise-mission li.fait b { background: var(--succes); color: #fff; }
  .frise-mission li.courante { color: var(--primaire); font-weight: 700; } .frise-mission li.courante b { background: var(--primaire); color: #fff; }
  .frise-mission small { color: var(--texte2); font-weight: 600; }
  .frise-temps { text-align: center; margin: 6px 0 0; }
  .selfie-jour { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .selfie-jour img, .selfie-apercu { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid var(--surface); box-shadow: var(--ombre); }
  .avertissements.alerte { border-left: 4px solid var(--alerte); }
  .avertissements.banni { border-left: 4px solid var(--erreur); background: color-mix(in srgb, var(--erreur) 8%, var(--surface)); }
  .jauge-avert { display: inline-flex; gap: 5px; }
  .jauge-avert i { width: 14px; height: 14px; border-radius: 50%; background: var(--creux); border: 2px solid var(--separateur); }
  .jauge-avert i.pris { background: var(--alerte); border-color: var(--alerte); }
  .jauge-avert i.dernier { border-color: var(--erreur); }
  .selfies-admin .paire { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .selfies-admin img { width: 120px; height: 120px; object-fit: cover; border-radius: 12px; background: var(--creux); }`;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------------ Avertissements (2 autorisés, banni au suivant) */
export function blocAvertissements(a) {
  if (!a) return "";
  const max = a.maximum ?? REGLES.AVERTISSEMENTS_MAX, n = a.nombre || 0;
  if (a.banni) return `<div class="carte avertissements banni"><b>⛔ Compte suspendu</b>
    <p class="petit" style="margin:4px 0 0">Vous avez dépassé les ${max} avertissements autorisés : vous ne pouvez plus prendre de missions. Écrivez à contact@cleaneroo.fr pour en parler.</p></div>`;
  const pastilles = Array.from({ length: max + 1 }, (_, i) => `<i class="${i < n ? "pris" : ""}${i === max ? " dernier" : ""}"></i>`).join("");
  return `<div class="carte avertissements${n ? " alerte" : ""}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <b>${n ? "⚠️" : "🛡️"} Avertissements : ${n} / ${max}</b><span class="jauge-avert" aria-hidden="true">${pastilles}</span></div>
    <p class="petit" style="margin:4px 0 0">${n === 0 ? `Aucun avertissement. Vous avez droit à ${max} avertissements : au suivant, votre compte est banni.`
      : n < max ? `Encore ${max - n} avertissement possible : au-delà de ${max}, votre compte est banni.`
      : `Dernier avertissement : au prochain manquement, votre compte sera banni.`}</p>
    ${(a.liste || []).map(x => `<p class="petit" style="margin:4px 0 0">• ${esc(dateLongue(new Date(x.le)))} : ${esc(x.motif)}</p>`).join("")}</div>`;
}

/** Administration : avertir un Cleaneur, lever un bannissement. */
async function blocAvertissementsAdmin(boite) {
  const liste = await avertissementsCleaneurs().catch(() => []);
  if (!boite.isConnected) return;
  boite.innerHTML = `<h2 class="titre-section">⚠️ ${tr("Avertissements des Cleaneurs")}</h2>
    <p class="petit" style="margin-top:0">${tr("2 avertissements autorisés : au 3e, le Cleaneur est banni et ne peut plus prendre de missions.")}</p>
    ${liste.length ? liste.map(c => `<div class="carte ligne-compte" data-avert-admin="${esc(c.id)}"><div class="corps">
      <b>${esc(`${c.prenom || ""} ${c.nom || ""}`.trim() || "—")}</b> <span class="tampon${c.banni ? "" : c.nombre ? "" : " vert"}">${c.banni ? tr("Banni") : `${c.nombre} / ${REGLES.AVERTISSEMENTS_MAX}`}</span>
      <p class="petit" style="margin:2px 0 0">${esc(c.ville || "")}${c.dernier ? ` · ${esc(c.dernier)}` : ""}</p></div>
      ${c.banni ? `<button type="button" class="bouton secondaire" data-lever>${tr("Lever le bannissement")}</button>` : `<button type="button" class="bouton secondaire" data-avertir>${tr("Donner un avertissement")}</button>`}</div>`).join("")
      : `<div class="vide-compte"><p class="muet">${tr("Aucun Cleaneur inscrit pour l'instant.")}</p></div>`}`;
  traduire(boite);
  boite.querySelectorAll("[data-avertir]").forEach(b => b.onclick = async () => {
    const motif = (prompt(tr("Motif de l'avertissement (visible par le Cleaneur) :")) || "").trim();
    if (motif.length < 3) return;
    await avertirCleaneur(b.closest("[data-avert-admin]").dataset.avertAdmin, motif).catch(() => null);
    blocAvertissementsAdmin(boite);
  });
  boite.querySelectorAll("[data-lever]").forEach(b => b.onclick = async () => {
    if (!confirm(tr("Lever le bannissement et effacer les avertissements de ce Cleaneur ?"))) return;
    await leverBannissement(b.closest("[data-avert-admin]").dataset.avertAdmin).catch(() => null);
    blocAvertissementsAdmin(boite);
  });
}

/* ------------------------------------------------------------------ Selfie du jour (identité avant la première mission) */
export function blocSelfie(statut) {
  if (statut === "VALIDE" || statut === "A_VERIFIER")
    return `<div class="carte selfie-jour" id="selfie-jour"><span style="font-size:28px">✅</span><div><b>Selfie du jour envoyé</b>
      <p class="petit" style="margin:2px 0 0">${statut === "VALIDE" ? "Identité vérifiée par Cleaneroo." : "Votre identité est confirmée pour la journée."}</p></div></div>`;
  return `<div class="carte teintee selfie-jour" id="selfie-jour"><span style="font-size:28px">🤳</span>
    <div style="flex:1 1 220px"><b>Selfie du jour</b>
      <p class="petit" style="margin:2px 0 8px">${statut === "REFUSE" ? "Votre selfie n'a pas été accepté : reprenez-en un, visage bien visible." : "Avant votre première mission de la journée, prenez-vous en photo : le client sait que c'est bien vous qui venez."}</p>
      <label class="bouton">📷 Prendre mon selfie<input type="file" accept="image/*" capture="user" hidden data-selfie></label>
      <p class="erreur" data-erreur-selfie style="margin:6px 0 0"></p></div></div>`;
}
async function envoyerSelfie(input, err) {
  const f = input.files?.[0];
  if (!f) return false;
  err.textContent = tr("Envoi en cours…");
  try { await deposerSelfie(f); err.textContent = ""; return true; }
  catch { err.textContent = tr("Le selfie n'a pas pu être envoyé. Réessayez."); return false; }
}

/** Administration : selfies récents à côté de la pièce d'identité, pour confirmer que c'est la même personne. */
async function blocSelfiesAdmin(boite) {
  const liste = await selfiesAVerifier().catch(() => []);
  if (!boite.isConnected) return;
  boite.innerHTML = `<h2 class="titre-section">🤳 ${tr("Selfies des Cleaneurs (7 derniers jours)")}</h2>
    ${liste.length ? liste.map(s => `<div class="carte" data-selfie-admin="${esc(s.id)}"><div class="paire">
      <img alt="${esc(tr("Selfie du jour"))}" data-lien-selfie="${esc(s.chemin)}"><img alt="${esc(tr("Pièce d'identité"))}" ${s.identite ? `data-lien-identite="${esc(s.identite)}"` : ""}>
      <div style="flex:1 1 180px"><b>${esc(`${s.prenom || ""} ${s.nom || ""}`.trim())}</b><p class="petit" style="margin:2px 0 6px">${esc(dateLongue(new Date(s.jour)))} · ${tr({ A_VERIFIER: "À vérifier", VALIDE: "Validé", REFUSE: "Refusé" }[s.statut])}</p>
        ${s.statut === "A_VERIFIER" ? `<div class="boutons" style="margin:0"><button type="button" class="bouton" data-decider="1">C'est bien la même personne</button>
          <button type="button" class="bouton secondaire" data-decider="0">Refuser</button></div>` : ""}</div></div></div>`).join("")
      : `<div class="vide-compte"><p class="muet">${tr("Aucun selfie pour l'instant.")}</p></div>`}`;
  traduire(boite);
  boite.querySelectorAll("[data-lien-selfie]").forEach(async i => { try { i.src = await lienSelfie(i.dataset.lienSelfie); } catch { /* rien */ } });
  boite.querySelectorAll("[data-lien-identite]").forEach(async i => { try { i.src = await lienDocument(i.dataset.lienIdentite); } catch { /* rien */ } });
  boite.querySelectorAll("[data-decider]").forEach(b => b.onclick = async () => {
    const id = b.closest("[data-selfie-admin]").dataset.selfieAdmin, ok = b.dataset.decider === "1";
    const motif = ok ? "" : (prompt(tr("Motif du refus (visible par le Cleaneur) :")) ?? "");
    await deciderSelfie(id, ok, motif).catch(() => null);
    blocSelfiesAdmin(boite);
  });
}

/* ------------------------------------------------------------------ Géolocalisation */

/** "granted", "prompt", "denied" ou "absent" (navigateur sans géolocalisation). */
export async function etatGeoloc() {
  if (!("geolocation" in navigator)) return "absent";
  try { return (await navigator.permissions.query({ name: "geolocation" })).state; } catch { return "prompt"; }
}
/** Demande l'autorisation (fenêtre du navigateur). true si accordée. */
export function demanderGeoloc() {
  return new Promise(ok => {
    if (!("geolocation" in navigator)) return ok(false);
    navigator.geolocation.getCurrentPosition(() => ok(true), e => ok(e.code !== 1), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

let partage = null;   // { ref, id, dernier }
/** Envoie la position pendant le trajet (au plus toutes les Regles.SUIVI_INTERVALLE_S secondes), tant que la page est ouverte. */
export function partagerPosition(ref) {
  if (partage?.ref === ref || !("geolocation" in navigator)) return;
  arreterPartage();
  partage = { ref, dernier: 0, id: navigator.geolocation.watchPosition(async pos => {
    if (!partage || Date.now() - partage.dernier < REGLES.SUIVI_INTERVALLE_S * 1000) return;
    partage.dernier = Date.now();
    const r = await envoyerPosition(ref, pos.coords.latitude, pos.coords.longitude, pos.coords.heading).catch(() => "erreur");
    if (r === "statut" || r === "interdit") arreterPartage();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 }) };
}
export function arreterPartage() { if (partage) navigator.geolocation.clearWatch(partage.id); partage = null; }

/* ------------------------------------------------------------------ Affichage */

const quand = m => m.creneau ? `${dateLongue(new Date(m.creneau))} · ${heure(new Date(m.creneau).getHours(), new Date(m.creneau).getMinutes())}` : tr("Date à fixer");

function carteMission(m) {
  const r = rubrique(m.rubrique_id), [bouton, , etat] = ETAPE[m.statut] || [];
  return `<div class="carte mission" data-mission="${esc(m.reference)}">
    <div class="ligne-compte" style="padding:0;box-shadow:none;border:0;background:none">${icone(r.icone, { tuile: true })}
      <div class="corps"><div class="haut"><h3>${r.nom}</h3><span class="tampon${m.statut === "A_VALIDER" ? " gris" : ""}">${etat}</span></div>
      <p class="muet" style="margin:2px 0 0">${quand(m)} · ${duree(m.duree_min)}</p></div></div>
    <p style="margin:10px 0 0"><b>${esc(m.rue)}, ${esc(m.code_postal)} ${esc(m.ville)}</b></p>
    <p class="petit" style="margin:2px 0 0">Client : ${esc(m.prenom)}${m.telephone ? ` · <a href="tel:${esc(m.telephone)}">${esc(m.telephone)}</a>` : ""} · ${m.sur_devis ? "Sur devis" : euros(m.estimation_c)}</p>
    ${m.remarque ? `<p class="petit" style="margin:4px 0 0">« ${esc(m.remarque)} »</p>` : ""}
    ${m.statut !== "CONFIRMEE" ? friseMission(m) : ""}
    ${blocAcces(m)}
    ${m.statut === "EN_ROUTE" ? `<p class="petit partage-actif" style="margin:8px 0 0">📍 Position partagée avec le client pendant le trajet</p>` : ""}
    ${["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<div class="controle-mission" data-controle="${esc(m.reference)}"></div>` : ""}
    <div class="boutons" style="margin-top:10px">
      ${bouton ? `<button type="button" class="bouton" data-etape="${esc(m.reference)}">${bouton}</button>` : ""}
      <a class="bouton secondaire" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${m.rue} ${m.code_postal} ${m.ville}`)}">Itinéraire</a>
    </div><p class="erreur" data-erreur-mission style="margin:6px 0 0"></p></div>`;
}

/** Accès au logement (transmis une fois la mission confirmée) : boîte à clés avec sa photo, personne sur place, accès autonome. */
function blocAcces(m) {
  const a = m.acces || {};
  const ligne = (titre, texte) => `<p class="petit" style="margin:2px 0 0"><b>${titre}</b> ${esc(texte)}</p>`;
  let corps = "";
  if (m.accueil === "BOITE") corps = ligne(tr("Boîte à clés :"), a.emplacement || "") + (a.code ? ligne(tr("Code :"), a.code) : "")
    + (a.photo ? `<img class="photo-boite-mission" alt="${esc(tr("Boîte à clés"))}" data-photo-boite="${esc(a.photo)}">` : "");
  else if (m.accueil === "TIERS") corps = ligne(tr("Accueil par :"), [a.nom, a.telephone].filter(Boolean).join(" · "));
  else if (m.accueil === "AUTONOME") corps = ligne(tr("Accès autonome :"), a.code || "");
  else corps = `<p class="petit" style="margin:2px 0 0">${tr("Le client sera présent.")}</p>`;
  return `<div class="acces-mission">${icone("cle")}<div>${corps}</div></div>`;
}

function carteDisponible(m) {
  const r = rubrique(m.rubrique_id);
  return `<div class="carte ligne-compte">${icone(r.icone, { tuile: true })}
    <div class="corps"><div class="haut"><h3>${r.nom}</h3><b>${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}</b></div>
      <p class="muet" style="margin:2px 0 0">${quand(m)} · ${duree(m.duree_min)}${m.nombre_cleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
      <p class="petit" style="margin:2px 0 0">${esc(m.code_postal)} ${esc(m.ville)}</p><p class="erreur" data-erreur-prendre style="margin:4px 0 0"></p></div>
    <button type="button" class="bouton" data-prendre="${esc(m.reference)}">Prendre la mission</button></div>`;
}

const vide = (t, plus = "") => `<div class="vide-compte"><p class="muet">${t}</p>${plus ? `<p class="petit">${plus}</p>` : ""}</div>`;

/** Carte : mes missions à l'adresse exacte (vert), missions disponibles autour de leur commune (corail, adresse donnée à la prise). */
async function carteDesMissions(boite, miennes, dispo) {
  if (!boite) return;
  const marqueurs = [];
  for (const m of miennes) {
    const pos = await coordonnees(m.rue, m.code_postal, m.ville);
    if (pos) marqueurs.push({ ...pos, couleur: "#1F8A80", titre: rubrique(m.rubrique_id).nom, popup: `<b>${esc(rubrique(m.rubrique_id).nom)}</b><br>${esc(quand(m))}<br>${esc(m.rue)}, ${esc(m.ville)}` });
  }
  for (const m of dispo) {
    const pos = await coordonnees("", m.code_postal, m.ville);
    if (pos) marqueurs.push({ ...pos, couleur: "#FA8C66", approx: 1500, titre: rubrique(m.rubrique_id).nom,
      popup: `<b>${esc(rubrique(m.rubrique_id).nom)}</b><br>${esc(quand(m))}<br>${esc(m.code_postal)} ${esc(m.ville)} · ${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}` });
  }
  if (!boite.isConnected) return;
  if (!marqueurs.length) { boite.nextElementSibling?.remove(); boite.remove(); return; }
  afficherCarte(boite, { marqueurs, zoom: 13 }).catch(() => boite.remove());
}

/** Remplit l'onglet Cleaneur : géolocalisation, aujourd'hui, prochaines missions, missions disponibles. */
export async function brancherMissions(vue, p) {
  const boite = vue.querySelector("#missions-cleaneur");
  if (!boite) return;
  styles();
  const [miennes, dispo, geo, selfie, avert] = await Promise.all([mesMissions().catch(() => []), missionsDisponibles().catch(() => []), etatGeoloc(),
    selfieDuJour().catch(() => "aucun"), p.role === "admin" ? null : mesAvertissements().catch(() => null)]);
  if (!document.body.contains(boite)) return;
  const auj = new Date().toDateString();
  const duJour = miennes.filter(m => m.statut !== "CONFIRMEE" || (m.creneau && new Date(m.creneau).toDateString() === auj));
  const plusTard = miennes.filter(m => !duJour.includes(m));
  boite.innerHTML = `
    ${geo !== "granted" ? `<div class="carte teintee geoloc"><b>📍 Géolocalisation</b>
      <p class="petit" style="margin:4px 0 10px">${geo === "denied" ? "La géolocalisation est bloquée dans votre navigateur : autorisez-la dans les réglages du site (cadenas à gauche de l'adresse)."
        : "Elle sert à prévenir le client pendant votre trajet et à confirmer votre arrivée. Votre position n'est partagée que pendant le trajet."}</p>
      ${geo === "prompt" ? `<button type="button" class="bouton" id="autoriser-geoloc">Autoriser la géolocalisation</button>` : ""}</div>` : ""}
    ${blocAvertissements(avert)}
    ${avert?.banni ? "" : blocSelfie(selfie)}
    <div class="carte mise-en-avant"><span class="surtitre">Aujourd'hui</span>
      ${duJour.length ? `<h2 style="margin:6px 0 10px">${duJour.length} mission${duJour.length > 1 ? "s" : ""}</h2>` : `<h2 style="margin:6px 0 2px">Aucune mission aujourd'hui</h2>
        <p class="muet" style="margin:0">Les missions commencent le 1er janvier 2027. Elles s'afficheront ici, dans l'ordre de la journée.</p>`}</div>
    ${duJour.map(carteMission).join("")}
    ${miennes.length || dispo.length ? `<div class="carte-missions" id="carte-missions" role="img" aria-label="Carte des missions"></div>
      <p class="petit legende-carte"><span><i style="--c:#1F8A80"></i>Mes missions</span><span><i style="--c:#FA8C66"></i>Missions disponibles (zone approximative)</span></p>` : ""}
    <h2 class="titre-section">${icone("calendrier", { tuile: true })}Mes prochaines missions</h2>
    ${plusTard.length ? plusTard.map(carteMission).join("") : vide("Aucune mission pour l'instant.", "Prenez une mission ci-dessous : elle est à vous dès que vous la prenez.")}
    <h2 class="titre-section">${icone("position", { tuile: true })}Missions disponibles</h2>
    <p class="petit" style="margin-top:0">Missions en ligne pour les prestations que vous proposez. Le premier Cleaneur qui la prend l'obtient.</p>
    ${dispo.length ? dispo.map(carteDisponible).join("") : vide("Aucune mission disponible pour l'instant.", p.dossier === "VALIDE" || p.role === "admin" ? "" : "Votre dossier doit être validé pour voir et prendre des missions.")}
    ${p.role === "admin" ? `<div id="selfies-admin" class="selfies-admin"></div><div id="avertissements-admin"></div>` : ""}`;
  traduire(boite);
  if (p.role === "admin") { blocSelfiesAdmin(boite.querySelector("#selfies-admin")); blocAvertissementsAdmin(boite.querySelector("#avertissements-admin")); }
  majTemps(boite);
  clearInterval(minuterieFrise);
  minuterieFrise = setInterval(() => { if (!boite.isConnected) return clearInterval(minuterieFrise); majTemps(boite); }, 60000);
  // Selfie du jour pris depuis le bloc du haut.
  boite.querySelector("#selfie-jour [data-selfie]")?.addEventListener("change", async e => {
    if (await envoyerSelfie(e.target, boite.querySelector("[data-erreur-selfie]"))) recharger();
  });
  // Photo de la boîte à clés : lien temporaire, seulement pour le Cleaneur de la mission.
  boite.querySelectorAll("[data-photo-boite]").forEach(async img => {
    try { img.src = await lienPhotoDemande(img.dataset.photoBoite); } catch { img.remove(); }
  });
  carteDesMissions(boite.querySelector("#carte-missions"), miennes, dispo);
  const recharger = () => brancherMissions(vue, p);
  boite.querySelector("#autoriser-geoloc")?.addEventListener("click", async () => { await demanderGeoloc(); recharger(); });
  // Trajet en cours (page rouverte) : la position repart toute seule.
  const enRoute = miennes.find(m => m.statut === "EN_ROUTE");
  if (enRoute && geo === "granted") partagerPosition(enRoute.reference); else if (!enRoute) arreterPartage();
  boite.querySelectorAll("[data-prendre]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await prendreMission(b.dataset.prendre).catch(() => "erreur");
    if (r === "ok") return recharger();
    b.disabled = false;
    b.closest(".carte").querySelector("[data-erreur-prendre]").textContent = tr({
      deja_prise: "Un autre Cleaneur a pris cette mission juste avant vous.", ouverture: "Les missions commencent le 1er janvier 2027.",
      dossier: "Votre dossier doit être validé pour prendre des missions.", formule: "Cette mission est réservée aux Cleaneurs Pro pendant ses 30 premières minutes." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  // Contrôle pièce par pièce : « J'ai terminé » reste grisé tant qu'une pièce n'est pas complète.
  boite.querySelectorAll("[data-controle]").forEach(c => {
    const m = miennes.find(x => x.reference === c.dataset.controle);
    const fin = c.closest(".carte").querySelector(`[data-etape="${CSS.escape(m.reference)}"]`);
    brancherControle(c, m, complet => { if (fin && m.statut === "EN_COURS") { fin.disabled = !complet; fin.title = complet ? "" : tr("Terminez le contrôle de chaque pièce."); } });
  });
  boite.querySelectorAll("[data-etape]").forEach(b => b.onclick = async () => {
    const ref = b.dataset.etape, m = miennes.find(x => x.reference === ref), suivant = ETAPE[m.statut][1];
    const err = b.closest(".carte").querySelector("[data-erreur-mission]");
    if (suivant === "DEPART") {
      b.disabled = true;
      const r = await quitterLogement(ref).catch(() => "erreur");
      if (r !== "ok") { b.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
      return recharger();
    }
    if (suivant === "EN_ROUTE" && !["A_VERIFIER", "VALIDE"].includes(await selfieDuJour().catch(() => "aucun"))) {
      err.textContent = tr("Prenez d'abord votre selfie du jour (en haut de la page) : il confirme votre identité au client.");
      boite.querySelector("#selfie-jour")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (suivant === "EN_ROUTE" && !(await demanderGeoloc())) { err.textContent = tr("Autorisez la géolocalisation pour partir : le client suit votre trajet."); return; }
    b.disabled = true;
    const r = await avancerMission(ref, suivant).catch(() => "erreur");
    if (r !== "ok") { b.disabled = false; err.textContent = tr(r === "controle" ? "Cochez toutes les tâches de chaque pièce avant de terminer : photos avant et après, tâches, avis de l'IA ou justification."
      : r === "selfie" ? "Prenez d'abord votre selfie du jour (en haut de la page) : il confirme votre identité au client."
      : "Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    if (suivant === "EN_ROUTE") partagerPosition(ref);
    if (suivant === "SUR_PLACE") {
      // Dernière position envoyée à l'arrivée, puis plus rien.
      navigator.geolocation.getCurrentPosition(pos => envoyerPosition(ref, pos.coords.latitude, pos.coords.longitude).catch(() => null), () => {}, { enableHighAccuracy: true, timeout: 10000 });
      arreterPartage();
    }
    recharger();
  });
}
