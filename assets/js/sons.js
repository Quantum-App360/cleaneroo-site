// Sons et alertes : « nouvelle mission » (Cleaneur) et « prise en charge » (client).
// Sons fabriqués par Cleanova/design/sons/fabriquer_sons.py (assets/sons/*.mp3).
// Les navigateurs n'acceptent un son qu'après un premier geste sur la page (clic, touche) : on « débloque » l'audio à ce moment-là.
import { tr } from "./langue.js";
import { REGLES } from "./regles.js";
import { missionsDisponibles, demandesDuCompte } from "./donnees.js";

const SONS = { "nouvelle-mission": "/assets/sons/nouvelle_mission.mp3", "prise-en-charge": "/assets/sons/prise_en_charge.mp3" };
const lecteurs = {};
let debloque = false;

function lecteur(nom) {
  if (!lecteurs[nom]) { lecteurs[nom] = new Audio(SONS[nom]); lecteurs[nom].preload = "auto"; }
  return lecteurs[nom];
}
/** Premier geste sur la page : prépare les sons en silence pour pouvoir les jouer ensuite. */
function debloquer() {
  if (debloque) return;
  debloque = true;
  Object.keys(SONS).forEach(n => { const a = lecteur(n); a.muted = true; a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); });
}
["pointerdown", "keydown", "touchstart"].forEach(e => addEventListener(e, debloquer, { once: true, passive: true }));

/** Joue un son (sans erreur si le navigateur le refuse). */
export function jouerSon(nom) {
  try { const a = lecteur(nom); a.currentTime = 0; a.play().catch(() => {}); } catch { /* rien */ }
}

/** Son + notification du système (si autorisée et page en arrière-plan) + petit bandeau sur la page. */
export function alerter(nom, titre, texte, lien) {
  jouerSon(nom);
  if (document.hidden && "Notification" in window && Notification.permission === "granted")
    try { const n = new Notification(titre, { body: texte, icon: "/favicon.png", tag: `cleaneroo-${nom}` }); n.onclick = () => { focus(); if (lien) location.hash = lien; }; } catch { /* rien */ }
  const b = document.createElement("a");
  b.className = `alerte-son alerte-${nom}`;
  b.href = lien || "#/";
  b.setAttribute("role", "status");
  b.innerHTML = `<b></b><span></span>`;
  b.querySelector("b").textContent = titre;
  b.querySelector("span").textContent = texte;
  document.body.append(b);
  setTimeout(() => b.classList.add("partie"), 7000);
  setTimeout(() => b.remove(), 7600);
}

/* ------------------------------------------------------------------ Surveillance (toutes les SURVEILLANCE_S secondes, page ouverte) */
let minuterie = null;
const STATUTS_PRIS = ["CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS", "A_VALIDER", "TERMINEE", "VALIDEE"];
const CLE_DEMANDES = "cleaneroo-demandes-vues";

/** Cleaneur : son « nouvelle mission » dès qu'une mission apparaît dans « Missions disponibles ». */
function surveillerMissions(surNouvelle) {
  let connues = null;
  return async () => {
    const dispo = await missionsDisponibles().catch(() => null);
    if (!dispo) return;
    const refs = new Set(dispo.map(m => m.reference));
    const nouvelles = connues ? dispo.filter(m => !connues.has(m.reference)) : [];
    connues = refs;
    if (nouvelles.length) {
      alerter("nouvelle-mission", tr("Nouvelle mission disponible"),
        nouvelles.length > 1 ? `${nouvelles.length} ${tr("nouvelles missions près de chez vous")}` : tr("Une prestation vient d'être publiée près de chez vous."), "#/compte/cleaneur");
      surNouvelle?.();
    }
  };
}

/** Client : son « prise en charge » quand un Cleaneur prend une de ses prestations (comparé au dernier passage, même page rouverte). */
function surveillerDemandes(surChangement) {
  return async () => {
    const liste = await demandesDuCompte().catch(() => null);
    if (!liste) return;
    let vues = {};
    try { vues = JSON.parse(localStorage.getItem(CLE_DEMANDES) || "{}"); } catch { /* rien */ }
    const premiere = !Object.keys(vues).length;
    const prises = liste.filter(d => STATUTS_PRIS.includes(d.statut) && vues[d.reference] !== undefined && !STATUTS_PRIS.includes(vues[d.reference]));
    const etat = Object.fromEntries(liste.map(d => [d.reference, d.statut]));
    try { localStorage.setItem(CLE_DEMANDES, JSON.stringify(etat)); } catch { /* rien */ }
    if (!premiere && prises.length) {
      alerter("prise-en-charge", tr("Votre prestation est prise en charge"), tr("Un Cleaneur vérifié a pris votre prestation."), "#/mes-prestations");
      surChangement?.();
    }
  };
}

/**
 * Lance la surveillance selon le compte : Cleaneur (ou admin) → nouvelles missions ; client → prises en charge.
 * Remplace toute surveillance précédente. surChangement : rafraîchir l'écran ouvert.
 */
export function surveiller(profil, surChangement) {
  arreterSurveillance();
  if (!profil) return;
  const cleaneur = profil.role === "cleaneur" || profil.role === "admin";
  const tache = cleaneur ? surveillerMissions(surChangement) : surveillerDemandes(surChangement);
  tache();
  minuterie = setInterval(tache, REGLES.SURVEILLANCE_S * 1000);
}
export function arreterSurveillance() { if (minuterie) clearInterval(minuterie); minuterie = null; }
