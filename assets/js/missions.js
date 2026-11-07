// Missions du Cleaneur (onglet Cleaneur de « Mon compte ») : missions disponibles, « Prendre la mission » (rattachement
// automatique), étapes Je pars › Je suis arrivé › Je commence › J'ai terminé, et partage de la position pendant le trajet.
// Mêmes écrans que l'application (EspacesCompte.kt / ServiceTrajet.kt).
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure, duree } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr } from "./langue.js";
import { missionsDisponibles, mesMissions, prendreMission, avancerMission, envoyerPosition, lienPhotoDemande } from "./donnees.js";
import { afficherCarte, coordonnees } from "./cartes.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ETAPE = {
  CONFIRMEE: ["🚗 Je pars", "EN_ROUTE", "Confirmée"],
  EN_ROUTE: ["📍 Je suis arrivé", "SUR_PLACE", "En route"],
  SUR_PLACE: ["🧽 Je commence", "EN_COURS", "Sur place"],
  EN_COURS: ["✅ J'ai terminé", "A_VALIDER", "En cours"],
  A_VALIDER: [null, null, "À valider par le client"],
};

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
    ${blocAcces(m)}
    ${m.statut === "EN_ROUTE" ? `<p class="petit partage-actif" style="margin:8px 0 0">📍 Position partagée avec le client pendant le trajet</p>` : ""}
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
  const [miennes, dispo, geo] = await Promise.all([mesMissions().catch(() => []), missionsDisponibles().catch(() => []), etatGeoloc()]);
  if (!document.body.contains(boite)) return;
  const auj = new Date().toDateString();
  const duJour = miennes.filter(m => m.statut !== "CONFIRMEE" || (m.creneau && new Date(m.creneau).toDateString() === auj));
  const plusTard = miennes.filter(m => !duJour.includes(m));
  boite.innerHTML = `
    ${geo !== "granted" ? `<div class="carte teintee geoloc"><b>📍 Géolocalisation</b>
      <p class="petit" style="margin:4px 0 10px">${geo === "denied" ? "La géolocalisation est bloquée dans votre navigateur : autorisez-la dans les réglages du site (cadenas à gauche de l'adresse)."
        : "Elle sert à prévenir le client pendant votre trajet et à confirmer votre arrivée. Votre position n'est partagée que pendant le trajet."}</p>
      ${geo === "prompt" ? `<button type="button" class="bouton" id="autoriser-geoloc">Autoriser la géolocalisation</button>` : ""}</div>` : ""}
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
    ${dispo.length ? dispo.map(carteDisponible).join("") : vide("Aucune mission disponible pour l'instant.", p.dossier === "VALIDE" || p.role === "admin" ? "" : "Votre dossier doit être validé pour voir et prendre des missions.")}`;
  traduire(boite);
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
      dossier: "Votre dossier doit être validé pour prendre des missions." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  boite.querySelectorAll("[data-etape]").forEach(b => b.onclick = async () => {
    const ref = b.dataset.etape, m = miennes.find(x => x.reference === ref), suivant = ETAPE[m.statut][1];
    const err = b.closest(".carte").querySelector("[data-erreur-mission]");
    if (suivant === "EN_ROUTE" && !(await demanderGeoloc())) { err.textContent = tr("Autorisez la géolocalisation pour partir : le client suit votre trajet."); return; }
    b.disabled = true;
    const r = await avancerMission(ref, suivant).catch(() => "erreur");
    if (r !== "ok") { b.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    if (suivant === "EN_ROUTE") partagerPosition(ref);
    if (suivant === "SUR_PLACE") {
      // Dernière position envoyée à l'arrivée, puis plus rien.
      navigator.geolocation.getCurrentPosition(pos => envoyerPosition(ref, pos.coords.latitude, pos.coords.longitude).catch(() => null), () => {}, { enableHighAccuracy: true, timeout: 10000 });
      arreterPartage();
    }
    recharger();
  });
}
