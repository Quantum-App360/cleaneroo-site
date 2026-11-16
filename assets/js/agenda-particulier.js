// Agenda du Particulier (16 novembre 2026) : ses prestations demandées, mois par mois, comme l'agenda des conciergeries
// mais sans séjours ni calendriers à relier. Une pastille par prestation (icône de la prestation, couleur du logement, état animé),
// détail du jour touché, vue « Liste », demandes sans date à part et ajout à son agenda (.ics). Même écran dans l'appli (AgendaParticulier.kt).
import { rubrique, TYPES_LOGEMENT } from "./catalogue.js";
import { REGLES, dateLongue } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { couleurBien, versIcs } from "./agenda.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourDe = s => { const [a, m, j] = s.split("-").map(Number); return new Date(a, m - 1, j); };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const memeAdresse = (d, l) => (d.rue || "").trim().toLowerCase() === (l.rue || "").trim().toLowerCase() && (d.code_postal || d.codePostal) === l.codePostal;
const nomBien = l => l.nom || `${(TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom || tr("Adresse")} · ${l.ville}`;

/** États affichés, du plus récent au plus avancé. */
export const ETATS_PRESTATION = { VERIFICATION: "En vérification", PUBLIEE: "Recherche d'un Cleaneur", CONFIRMEE: "Cleaneur confirmé", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "Ménage en cours", A_VALIDER: "À valider", TERMINEE: "Terminé" };

/** Prestations datées par jour (AAAA-MM-JJ), annulées exclues ; et celles encore sans date. Calcul pur, testé. */
export function prestationsParJour(demandes) {
  const parJour = {}, sansDate = [];
  demandes.filter(d => d.statut !== "ANNULEE").forEach(d => {
    if (!d.creneau) { if (d.statut !== "TERMINEE") sansDate.push(d); return; }
    const j = iso(new Date(d.creneau));
    (parJour[j] = parJour[j] || []).push(d);
  });
  Object.values(parJour).forEach(l => l.sort((a, b) => new Date(a.creneau) - new Date(b.creneau)));
  return { parJour, sansDate };
}

let moisAffiche = null, vue = "mois", jourChoisi = null;

/** Dessine l'agenda dans [boite]. */
export function agendaParticulier(boite, { demandes, biens }) {
  if (!boite) return;
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const { parJour, sansDate } = prestationsParJour(demandes);
  const ordre = biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true }));
  const bienDe = d => ordre.find(l => memeAdresse(d, l));
  const couleur = d => { const l = bienDe(d); return l ? couleurBien(ordre.indexOf(l)) : "var(--primaire)"; };
  const heureDe = d => new Date(d.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  const lien = d => d.reference && d.jeton ? `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton)}` : "#/mes-demandes";
  const pastille = d => `<i class="b-menage b-presta etat-${esc(d.statut)}" style="--c:${couleur(d)}" title="${esc(`${rubrique(d.rubrique_id)?.nom || ""} · ${tr(ETATS_PRESTATION[d.statut] || "")}`)}">${icone(rubrique(d.rubrique_id)?.icone || "termine")}</i>`;
  const ligne = d => {
    const l = bienDe(d), r = rubrique(d.rubrique_id);
    return `<a class="evt evt-menage evt-particulier" style="--c:${couleur(d)}" href="${lien(d)}">${pastille(d)}
      <div class="evt-corps"><div class="evt-haut"><b>${esc(r?.nom || tr("Prestation"))}</b><span class="evt-bien">${l ? esc(nomBien(l)) : esc(d.ville || "")}</span></div>
        <div class="petit muet">${d.creneau ? `<span>${heureDe(d)}</span> · ` : ""}<span class="etat-texte etat-${esc(d.statut)}">${tr(ETATS_PRESTATION[d.statut] || "")}</span></div></div>
      <span class="evt-fleche" aria-hidden="true">›</span></a>`;
  };
  const aVenir = Object.keys(parJour).filter(j => j >= iso(auj)).sort();
  moisAffiche = moisAffiche || (aVenir[0] ? new Date(jourDe(aVenir[0]).getFullYear(), jourDe(aVenir[0]).getMonth(), 1) : new Date(auj.getFullYear(), auj.getMonth(), 1));

  const dessiner = () => {
    const m = moisAffiche, premier = new Date(m.getFullYear(), m.getMonth(), 1);
    const decalage = (premier.getDay() + 6) % 7, debut = plusJours(premier, -decalage);
    const nbSemaines = Math.ceil((decalage + new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()) / 7);
    const nomsJours = [...Array(7)].map((_, i) => plusJours(new Date(2024, 0, 1), i).toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", ""));
    const titreMois = m.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
    const nbMois = Object.entries(parJour).filter(([j]) => jourDe(j).getMonth() === m.getMonth() && jourDe(j).getFullYear() === m.getFullYear()).reduce((n, [, l]) => n + l.length, 0);
    const cases = [...Array(nbSemaines * 7)].map((_, i) => {
      const d = plusJours(debut, i), j = iso(d), liste = parJour[j] || [];
      const classes = ["ap-jour", d.getMonth() !== m.getMonth() ? "hors" : "", j === iso(auj) ? "auj" : "", j < iso(auj) ? "passe" : "", liste.length ? "occupe" : "", j === jourChoisi ? "choisi" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${classes}" data-jour="${j}" aria-label="${esc(dateLongue(d))}${liste.length ? ` · ${liste.length} ${tr(liste.length > 1 ? "prestations" : "prestation")}` : ""}">
        <span class="num">${d.getDate()}</span>${liste.length ? `<span class="ap-pastilles">${liste.slice(0, 3).map(pastille).join("")}${liste.length > 3 ? `<em>+${liste.length - 3}</em>` : ""}</span>` : ""}</button>`;
    }).join("");
    const detail = jourChoisi ? `<div class="ap-detail"><h3>${esc(dateLongue(jourDe(jourChoisi)))}</h3>${(parJour[jourChoisi] || []).map(ligne).join("")
      || `<p class="muet" style="margin:0">${tr("Aucune prestation ce jour-là.")}</p>`}
      ${jourChoisi >= iso(auj) ? `<a class="bouton petit secondaire" href="#/reserver" data-choisir-prestation>＋ ${tr("Réserver une prestation")}</a>` : ""}</div>` : "";
    const liste = aVenir.length ? aVenir.map(j => `<div class="ap-liste-jour"><span class="surtitre">${esc(dateLongue(jourDe(j)))}</span>${parJour[j].map(ligne).join("")}</div>`).join("")
      : `<div class="vide-compte"><p class="muet">${tr("Aucune prestation à venir.")}</p></div>`;
    boite.innerHTML = `<div class="agenda-particulier">
      <div class="ap-barre">
        <div class="segments deux"><button type="button" data-vue="mois" class="${vue === "mois" ? "choisi" : ""}">${tr("Mois")}</button><button type="button" data-vue="liste" class="${vue === "liste" ? "choisi" : ""}">${tr("À venir")}</button></div>
        <button type="button" class="lien-bouton" data-exporter>${icone("calendrier")} ${tr("Ajouter à mon agenda")}</button>
      </div>
      ${vue === "mois" ? `<div class="ap-mois">
        <div class="ap-nav"><button type="button" data-mois="-1" aria-label="${esc(tr("Mois précédent"))}">‹</button>
          <div><b class="ap-titre">${esc(titreMois.charAt(0).toUpperCase() + titreMois.slice(1))}</b><span class="petit">${nbMois} ${tr(nbMois > 1 ? "prestations" : "prestation")}</span></div>
          <button type="button" data-mois="1" aria-label="${esc(tr("Mois suivant"))}">›</button></div>
        <div class="ap-grille entete">${nomsJours.map(n => `<span>${esc(n)}</span>`).join("")}</div>
        <div class="ap-grille">${cases}</div>
        ${ordre.length > 1 ? `<div class="ap-legende">${ordre.map((l, i) => `<span><i style="background:${couleurBien(i)}"></i>${esc(nomBien(l))}</span>`).join("")}</div>` : ""}
        ${detail}</div>` : `<div class="ap-liste">${liste}</div>`}
      ${sansDate.length ? `<div class="ap-sans-date"><span class="surtitre">${tr("Date à fixer")}</span>${sansDate.map(ligne).join("")}
        <p class="petit" style="margin:6px 0 0">${tr("Pré-réservations : la date sera fixée avec votre Cleaneur à l'ouverture, le 31 décembre 2026.")}</p></div>` : ""}
    </div>`;
    traduire(boite);
    boite.querySelectorAll("[data-vue]").forEach(b => b.onclick = () => { vue = b.dataset.vue; dessiner(); });
    boite.querySelectorAll("[data-mois]").forEach(b => b.onclick = () => { moisAffiche = new Date(m.getFullYear(), m.getMonth() + Number(b.dataset.mois), 1); jourChoisi = null; dessiner(); });
    boite.querySelectorAll("[data-jour]").forEach(b => b.onclick = () => { jourChoisi = jourChoisi === b.dataset.jour ? null : b.dataset.jour; dessiner(); });
    boite.querySelector("[data-exporter]").onclick = () => {
      const evts = Object.values(parJour).flat().map(d => {
        const j = iso(new Date(d.creneau)), l = bienDe(d);
        return { uid: d.reference || `${j}-${d.rubrique_id}`, debut: j, fin: iso(plusJours(jourDe(j), 1)),
          titre: `${rubrique(d.rubrique_id)?.nom || "Cleaneroo"} · ${heureDe(d)}`, lieu: [d.rue, d.code_postal, d.ville].filter(Boolean).join(" "),
          note: [l ? nomBien(l) : "", tr(ETATS_PRESTATION[d.statut] || ""), d.reference ? `https://cleaneroo.fr/${lien(d)}` : ""].filter(Boolean).join(" · ") };
      });
      const url = URL.createObjectURL(new Blob([versIcs(evts, new Date())], { type: "text/calendar" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "cleaneroo-mes-prestations.ics" });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  };
  dessiner();
}

/** Nombre de jours de l'horizon « à venir » (réutilise celui des conciergeries). */
export const HORIZON = REGLES.AGENDA_HORIZON_JOURS;
