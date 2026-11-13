// Agenda de l'espace Pro : calcul pur (sans affichage), copie exacte de Agenda.kt dans l'application.
// Séjours = ceux lus dans les calendriers iCal (Airbnb, Booking…) + ceux saisis à la main (sans calendrier iCal).
// Dates au format AAAA-MM-JJ ; « fin » = jour du départ (le logement est libre ce jour-là).
import { REGLES } from "./regles.js";

/** Couleur d'un bien dans l'agenda : toujours la même pour un bien donné (rang dans la liste triée). */
export const COULEURS_BIENS = ["#33948F", "#FA8C66", "#5B6CD9", "#D9A12B", "#B4549B", "#2F8FD0", "#6E9E3A", "#D9474D"];
export const couleurBien = rang => COULEURS_BIENS[((rang % COULEURS_BIENS.length) + COULEURS_BIENS.length) % COULEURS_BIENS.length];

const jour = s => { const [a, m, j] = s.split("-").map(Number); return Date.UTC(a, m - 1, j) / 86400000; };
/** Nombre de nuits d'un séjour. */
export const nuits = s => jour(s.fin) - jour(s.debut);
const ajouter = (s, n) => new Date((jour(s) + n) * 86400000).toISOString().slice(0, 10);

/**
 * Range les séjours en lignes (« voies ») pour les dessiner en barres continues : un séjour garde la même voie
 * tout du long ; un départ et une arrivée le même jour peuvent partager la voie (rotation).
 * Renvoie la liste des séjours avec leur voie, triée par arrivée.
 */
export function voies(sejours) {
  const fins = [];   // dernier départ de chaque voie
  return sejours.slice().sort((a, b) => a.debut.localeCompare(b.debut) || b.fin.localeCompare(a.fin)).map(s => {
    let v = fins.findIndex(f => f <= s.debut);
    if (v < 0) { v = fins.length; fins.push(s.fin); } else fins[v] = s.fin;
    return { ...s, voie: v };
  });
}

/** Morceau de barre d'un séjour dans la case d'un jour : "debut" (arrivée), "fin" (départ), "milieu", ou null. */
export function morceau(s, j) {
  if (j === s.debut) return "debut";
  if (j === s.fin) return "fin";
  return s.debut < j && j < s.fin ? "milieu" : null;
}

/**
 * Contrôle d'un séjour saisi à la main. Renvoie null s'il est valable, sinon le message d'erreur (en français).
 * [autres] = séjours du même bien (iCal et saisis), sans celui qu'on modifie.
 */
export function erreurSejour(s, autres) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.debut || "") || !/^\d{4}-\d{2}-\d{2}$/.test(s.fin || "")) return "Indiquez les dates d'arrivée et de départ.";
  if (s.fin <= s.debut) return "Le départ doit être après l'arrivée.";
  if (nuits(s) > REGLES.SEJOUR_DUREE_MAX_JOURS) return `Un séjour dure au plus ${REGLES.SEJOUR_DUREE_MAX_JOURS} nuits.`;
  if (autres.some(x => x.debut < s.fin && s.debut < x.fin)) return "Ce bien est déjà occupé à ces dates.";
  return null;
}

/** Séjours saisis gardés à l'enregistrement : on oublie ceux finis depuis plus de SEJOURS_GARDES_JOURS, au plus SEJOURS_MAX_PAR_BIEN. */
export function sejoursGardes(liste, aujourdhui) {
  const limite = ajouter(aujourdhui, -REGLES.SEJOURS_GARDES_JOURS);
  return liste.filter(s => s.fin >= limite).sort((a, b) => a.debut.localeCompare(b.debut)).slice(-REGLES.SEJOURS_MAX_PAR_BIEN);
}

/* ------------------------------------------------------------------ Export iCal (.ics) : Google Agenda, Apple Calendrier, Outlook, Airbnb, Booking… */

const echapper = t => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = s => s.replace(/-/g, "");
/** Coupe les lignes à 75 caractères (norme iCal). */
const plier = l => { const r = []; while (l.length > 75) { r.push(l.slice(0, 75)); l = " " + l.slice(75); } r.push(l); return r.join("\r\n"); };

/**
 * Fichier .ics : un événement « journée entière » par séjour et par ménage prévu.
 * evenements = [{ uid, debut, fin, titre, lieu, note }] ; fin = jour de départ (exclu, comme la norme iCal).
 */
export function versIcs(evenements, horodatage) {
  const stamp = horodatage.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cleaneroo//Agenda Pro//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Cleaneroo"];
  evenements.forEach(e => {
    lignes.push("BEGIN:VEVENT", `UID:${e.uid}@cleaneroo.fr`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.debut)}`, `DTEND;VALUE=DATE:${compact(e.fin)}`, `SUMMARY:${echapper(e.titre)}`);
    if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
    if (e.note) lignes.push(`DESCRIPTION:${echapper(e.note)}`);
    lignes.push("END:VEVENT");
  });
  lignes.push("END:VCALENDAR");
  return lignes.map(plier).join("\r\n") + "\r\n";
}

/** Plateforme d'un lien de calendrier, reconnue d'après le lien lui-même (un lien Booking collé dans le champ Airbnb reste un lien Booking).
 *  Même règle dans l'appli (Agenda.sourceDe). */
export const sourceCalendrier = (url, choisi = "autre") => /(^|\.)booking\.com/i.test(hote(url)) ? "booking"
  : /(^|\.)airbnb\./i.test(hote(url)) ? "airbnb" : choisi === "airbnb" || choisi === "booking" ? "autre" : choisi;
const hote = url => { try { return new URL(url).hostname; } catch { return ""; } };
