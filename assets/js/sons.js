// Sons et alertes : « nouvelle mission » (Cleaneur) et « prise en charge » (client).
// Sons fabriqués par Cleanova/design/sons/fabriquer_sons.py (assets/sons/*.mp3).
// Les navigateurs n'acceptent un son qu'après un premier geste sur la page (clic, touche) : on « débloque » l'audio à ce moment-là.
import { rubrique } from "./catalogue.js";
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

/**
 * Alerte de mission en demi-écran (12 novembre 2026, reprise de l'appli de Vincent) : son, et une fenêtre qui ne se ferme
 * qu'en répondant (« Voir la mission » ou « Cette mission ne m'intéresse pas »).
 */
export function alerteMission(m, nombre = 1) {
  if (document.querySelector(".alerte-mission")) return;
  const r = rubrique(m.rubrique_id);
  const d = document.createElement("dialog");
  d.className = "alerte-mission";
  const quand = m.creneau ? new Date(m.creneau).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : tr("Date flexible");
  d.innerHTML = `<div class="haut-alerte">🔔 ${tr("Nouvelle mission près de chez vous")}</div>
    <h2>${r?.nom || ""}</h2><p>${quand}</p><p><b>${(m.code_postal || "")} ${m.ville || ""}</b> · ${m.sur_devis ? tr("Sur devis") : (m.estimation_c / 100).toFixed(2).replace(".", ",") + " €"}</p>
    ${nombre > 1 ? `<p class="petit">+${nombre - 1} ${tr("autre(s) mission(s)")}</p>` : ""}
    <div class="boutons"><a class="bouton" href="#/compte/cleaneur" data-voir>${tr("Voir la mission")}</a>
      <button type="button" class="bouton secondaire" data-non>${tr("Cette mission ne m'intéresse pas")}</button></div>`;
  d.addEventListener("cancel", e => e.preventDefault());   // pas de fermeture sans réponse
  d.querySelector("[data-non]").onclick = () => { d.close(); d.remove(); };
  d.querySelector("[data-voir]").onclick = () => { d.close(); d.remove(); setTimeout(() => document.getElementById("missions-disponibles")?.scrollIntoView({ behavior: "smooth" }), 800); };
  if (!document.getElementById("styles-alerte-mission")) { const s = document.createElement("style"); s.id = "styles-alerte-mission";
    s.textContent = `.alerte-mission{position:fixed;inset:auto 0 0 0;margin:0 auto;width:min(560px,100%);max-height:55vh;border:none;border-radius:22px 22px 0 0;padding:22px 20px 26px;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
      .alerte-mission::backdrop{background:rgba(16,40,44,.45)}.alerte-mission h2{margin:6px 0 4px}.haut-alerte{font-weight:800;color:var(--corail-texte,#C2552F)}`; document.head.appendChild(s); }
  document.body.append(d);
  d.showModal();
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
      alerteMission(nouvelles[0], nouvelles.length);
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
  // Statuts cumulables : un Cleaneur qui est aussi Particulier ou Pro entend les deux alertes.
  const st = profil.statuts || [profil.role === "cleaneur" ? "cleaneur" : "particulier"];
  const admin = profil.role === "admin";
  const taches = [];
  if (admin || st.includes("cleaneur")) taches.push(surveillerMissions(surChangement));
  if (admin || st.some(x => x !== "cleaneur")) taches.push(surveillerDemandes(surChangement));
  const tache = () => taches.forEach(t => t());
  tache();
  minuterie = setInterval(tache, REGLES.SURVEILLANCE_S * 1000);
}
export function arreterSurveillance() { if (minuterie) clearInterval(minuterie); minuterie = null; }
