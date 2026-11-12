// Créneaux disponibles du Cleaneur et score de recommandation des missions (12 novembre 2026, repris de l'appli iPhone de Vincent).
// Grille jour × heure (« X h ouvertes par semaine ») ; chaque mission disponible reçoit une compatibilité sur 100 :
// distance, enchaînement avec une autre mission, créneau ouvert, délai, gain horaire (scoreMission dans regles.js).
// Même écran dans l'appli (Creneaux.kt). Base : profils.disponibilites (base-disponibilites.sql).
import { majProfil } from "./donnees.js";
import { REGLES, scoreMission } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { coordonnees } from "./cartes.js";
import { distanceKm } from "./suivi-live.js";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HEURES = Array.from({ length: REGLES.CRENEAUX_FIN_H - REGLES.CRENEAUX_DEBUT_H }, (_, i) => REGLES.CRENEAUX_DEBUT_H + i);
export const heuresOuvertes = d => Object.values(d || {}).reduce((s, l) => s + (l?.length || 0), 0);

/** Grille « Mes créneaux disponibles » (tableau de bord du Cleaneur). */
export function blocCreneaux(boite, profil) {
  if (!boite) return;
  const dispo = JSON.parse(JSON.stringify(profil?.disponibilites || {}));
  const dessiner = () => {
    boite.innerHTML = `<details class="carte"><summary><b>🗓️ ${tr("Mes créneaux disponibles")}</b> · <span class="petit">${heuresOuvertes(dispo)} ${tr("h ouvertes par semaine")}</span></summary>
      <p class="petit">${tr("Touchez les heures où vous êtes disponible : les missions qui y tombent passent en tête de vos recommandations.")}</p>
      <div class="grille-creneaux"><span></span>${HEURES.map(h => `<span class="h">${h}</span>`).join("")}
        ${JOURS.map((j, i) => `<span class="j">${tr(j)}</span>${HEURES.map(h => `<button type="button" class="${(dispo[i + 1] || []).includes(h) ? "ouvert" : ""}" data-jour="${i + 1}" data-heure="${h}" aria-label="${tr(j)} ${h} h"></button>`).join("")}`).join("")}</div>
      <div class="boutons"><button type="button" class="bouton secondaire" data-semaine-type>${tr("Lundi au vendredi, 8 h - 18 h")}</button>
        <button type="button" class="bouton" data-enregistrer-creneaux>${tr("Enregistrer")}</button></div><p class="petit" data-resultat-creneaux></p></details>`;
    traduire(boite);
    boite.querySelector("details").open = true;
    boite.querySelectorAll("[data-jour]").forEach(b => b.onclick = () => {
      const j = b.dataset.jour, h = Number(b.dataset.heure), l = new Set(dispo[j] || []);
      l.has(h) ? l.delete(h) : l.add(h); dispo[j] = [...l].sort((a, c) => a - c); dessiner();
    });
    boite.querySelector("[data-semaine-type]").onclick = () => { for (let j = 1; j <= 7; j++) dispo[j] = j <= 5 ? HEURES.filter(h => h >= 8 && h < 18) : []; dessiner(); };
    boite.querySelector("[data-enregistrer-creneaux]").onclick = async () => {
      const r = boite.querySelector("[data-resultat-creneaux]");
      try { await majProfil({ disponibilites: dispo }); r.textContent = tr("Créneaux enregistrés."); }
      catch { r.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
    };
  };
  dessiner();
  boite.querySelector("details").open = false;
  if (!document.getElementById("styles-creneaux")) { const s = document.createElement("style"); s.id = "styles-creneaux";
    s.textContent = `.grille-creneaux{display:grid;grid-template-columns:36px repeat(${HEURES.length},1fr);gap:2px;margin:10px 0;overflow-x:auto}
      .grille-creneaux span{font-size:.68rem;text-align:center;color:var(--texte2,#425E62)}.grille-creneaux .j{text-align:left;font-weight:700}
      .grille-creneaux button{min-height:22px;border:1px solid var(--separateur,#ccd);background:var(--surface,#fff);border-radius:4px;cursor:pointer;padding:0}
      .grille-creneaux button.ouvert{background:var(--primaire,#1F8A80);border-color:var(--primaire,#1F8A80)}`; document.head.appendChild(s); }
}

/** Score de chaque mission disponible (Map référence → score) : distance depuis le centre de la zone, enchaînement, créneaux… */
export async function scoresMissions(dispo, miennes, profil, formule) {
  const centre = profil?.zone_lat ? { lat: profil.zone_lat, lon: profil.zone_lon } : null;
  const taux = (formule === "pro" ? REGLES.COMMISSION_PRO_PB : REGLES.COMMISSION_GRATUIT_PB) / 10000;
  const scores = new Map();
  await Promise.all(dispo.map(async m => {
    const pos = centre ? await coordonnees("", m.code_postal, m.ville).catch(() => null) : null;
    const km = pos ? distanceKm(centre, pos) : 15;
    const debut = m.creneau ? new Date(m.creneau) : null;
    let enchainementMin = null;
    if (debut) for (const x of miennes) {
      if (!x.creneau) continue;
      const fin = new Date(new Date(x.creneau).getTime() + (x.duree_min || 0) * 60000);
      const ecart = (debut - fin) / 60000;
      if (fin.toDateString() === debut.toDateString() && ecart >= 0 && (enchainementMin == null || ecart < enchainementMin)) enchainementMin = ecart;
    }
    const iso = debut ? ((debut.getDay() + 6) % 7) + 1 : null;
    const dansCreneaux = debut ? (profil?.disponibilites?.[iso] || []).includes(debut.getHours()) : false;
    const jours = debut ? Math.max(0, (debut - Date.now()) / 86400000) : 7;
    const netParHeureC = m.duree_min ? Math.round(m.estimation_c * (1 - taux) / (m.duree_min / 60)) : 0;
    scores.set(m.reference, scoreMission({ km, enchainementMin, dansCreneaux, jours, netParHeureC, urgence: m.urgence }));
  }));
  return scores;
}
