// Missions du Cleaneur (onglet Cleaneur de « Mon compte ») : missions disponibles, « Prendre la mission » (rattachement
// automatique), étapes Je pars › Je suis arrivé › Je commence › J'ai terminé, et partage de la position pendant le trajet.
// Mêmes écrans que l'application (EspacesCompte.kt / ServiceTrajet.kt).
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure, duree, finOffreLancement, indemniteAccesC, dateVersement, conseilSecteur } from "./regles.js";
import { supabase, majProfil } from "./donnees.js";
import { positionAdresse, distanceKm } from "./suivi-live.js";
import { blocNoterClients, remplirNotesClients, blocAvisRecus } from "./avis-clients.js";
import { blocFormations } from "./formations.js";
import { blocPeriodes } from "./periodes.js";
import { blocNiveau } from "./niveaux.js";
import { blocRetardCleaneur, brancherRetards } from "./retards.js";
import { formulaireProposition, brancherPropositions } from "./propositions.js";
import { blocConsommablesCleaneur } from "./consommables.js";
import { zoneSignature, signaturesDe } from "./signature.js";
import { blocCeQuiMeManque } from "./dossier.js";
import { blocGuideMission, brancherGuidesMissions } from "./guides.js";
import { boutonBon, brancherBons } from "./demande-actions.js";
import { blocCreneaux, scoresMissions, distances } from "./creneaux.js";
import { preparationCleaneur } from "./espaces.js";
import { icone } from "./icones.js";
import { traduire, tr } from "./langue.js";
import { missionsDisponibles, mesMissions, prendreMission, avancerMission, envoyerPosition, lienPhotoDemande,
  selfieDuJour, deposerSelfie, quitterLogement, selfiesAVerifier, deciderSelfie, lienSelfie, lienDocument,
  mesAvertissements, avertissementsCleaneurs, avertirCleaneur, leverBannissement,
  confirmerMission, coutAnnulation, annulerMissionCleaneur, mesPenalites, mesDocuments, tableauCleaneur, dispoUrgence } from "./donnees.js";
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
  .tampon.urgence { background: color-mix(in srgb, var(--erreur) 16%, transparent); color: var(--erreur); }
  .confirmation-mission { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
  .avertissements.alerte { border-left: 4px solid var(--alerte); }
  .avertissements.banni { border-left: 4px solid var(--erreur); background: color-mix(in srgb, var(--erreur) 8%, var(--surface)); }
  .jauge-avert { display: inline-flex; gap: 5px; }
  .jauge-avert i { width: 14px; height: 14px; border-radius: 50%; background: var(--creux); border: 2px solid var(--separateur); }
  .jauge-avert i.pris { background: var(--alerte); border-color: var(--alerte); }
  .jauge-avert i.dernier { border-color: var(--erreur); }
  .tableau-cleaneur { display: grid; gap: 10px; margin-bottom: 14px; }
  .badge-niveau { justify-self: start; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; background: color-mix(in srgb, var(--or) 22%, transparent); color: var(--corail-texte); }
  .profil-a-completer summary { display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none; }
  .profil-a-completer summary::-webkit-details-marker { display: none; }
  .profil-a-completer .compte { color: var(--corail-texte); }
  .profil-a-completer .jauge { margin: 10px 0 0; }
  .offre-tdb { background: color-mix(in srgb, var(--succes) 10%, var(--surface)); font-size: 22px; }
  .dispo-urgence { cursor: pointer; align-items: center; }
  .point-dispo { width: 12px; height: 12px; border-radius: 50%; background: var(--texte3); flex: none; }
  .point-dispo.actif { background: var(--succes); box-shadow: 0 0 0 5px color-mix(in srgb, var(--succes) 25%, transparent); }
  .interrupteur { appearance: none; width: 50px; height: 30px; border-radius: 15px; background: var(--creux); position: relative; cursor: pointer; flex: none; transition: background .2s; }
  .interrupteur::after { content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); transition: left .2s; }
  .interrupteur:checked { background: var(--succes); } .interrupteur:checked::after { left: 23px; }
  .recherche-mission { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 20px; background: var(--degrade); color: #fff; text-decoration: none; font-size: 24px; box-shadow: var(--ombre); }
  .recherche-mission div { flex: 1; display: flex; flex-direction: column; } .recherche-mission b { font-size: 18px; } .recherche-mission div span { font-size: 13px; opacity: .88; }
  .tuiles-tdb { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tuile-tdb { display: flex; flex-direction: column; gap: 2px; padding: 14px; border-radius: 16px; background: var(--creux); text-decoration: none; color: var(--texte2); font-size: 13px; }
  .tuile-tdb b { font-size: 24px; color: var(--primaire); } .tuile-tdb.ok b { color: var(--succes); } .tuile-tdb.alerte b { color: var(--corail-texte); }
  .ma-journee { background: var(--surface); border-radius: var(--rayon); box-shadow: var(--ombre); padding: 14px; }
  .ma-journee .segments { margin: 8px 0; }
  .nav-journee { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .nav-journee .lien-bouton { font-size: 24px; min-width: 44px; min-height: 40px; }
  .ligne-journee { display: grid; grid-template-columns: 56px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--separateur); font-size: 14px; }
  .selfies-admin .paire { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .selfies-admin img { width: 120px; height: 120px; object-fit: cover; border-radius: 12px; background: var(--creux); }`;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------------ Tableau de bord du Cleaneur (comme l'appli iOS)
   Date, niveau et commission, « Complétez votre profil n/10 », offre Pro, « Disponible pour une urgence ? », « Rechercher une mission »,
   compteurs, « Ma journée » en Jour / Semaine / Mois. */
const niveauDe = n => REGLES.NIVEAUX_CLEANEUR.filter(([, min]) => n >= min).pop()[0];
let vueJournee = "jour", decalage = 0;   // « Ma journée » : période affichée et décalage (‹ ›)

function periode() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (vueJournee === "jour") { d.setDate(d.getDate() + decalage); const f = new Date(d); f.setDate(f.getDate() + 1); return [d, f]; }
  if (vueJournee === "semaine") { d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * decalage); const f = new Date(d); f.setDate(f.getDate() + 7); return [d, f]; }
  d.setDate(1); d.setMonth(d.getMonth() + decalage); const f = new Date(d); f.setMonth(f.getMonth() + 1); return [d, f];
}
function libellePeriode([d, f]) {
  if (vueJournee === "jour") return `${decalage === 0 ? tr("Aujourd'hui") + " · " : ""}${dateLongue(d)}`;
  if (vueJournee === "semaine") { const fin = new Date(f); fin.setDate(fin.getDate() - 1); return `${tr("Semaine du")} ${d.getDate()} ${tr("au")} ${dateLongue(fin)}`; }
  return d.toLocaleDateString(document.documentElement.lang || "fr", { month: "long", year: "numeric" });
}
function blocJournee(miennes) {
  const [d, f] = periode();
  const liste = miennes.filter(m => m.creneau && new Date(m.creneau) >= d && new Date(m.creneau) < f).sort((a, b) => new Date(a.creneau) - new Date(b.creneau));
  return `<div class="ma-journee" id="ma-journee"><div class="haut-journee"><span class="surtitre">Ma journée</span></div>
    <div class="segments trois">${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, nom]) => `<button type="button" data-vue-journee="${id}" class="${vueJournee === id ? "choisi" : ""}">${nom}</button>`).join("")}</div>
    <div class="nav-journee"><button type="button" class="lien-bouton" data-decaler="-1" aria-label="${esc(tr("Précédent"))}">‹</button><b>${esc(libellePeriode([d, f]))}</b><button type="button" class="lien-bouton" data-decaler="1" aria-label="${esc(tr("Suivant"))}">›</button></div>
    ${liste.length ? liste.map(m => `<div class="ligne-journee"><b>${heure(new Date(m.creneau).getHours(), new Date(m.creneau).getMinutes())}</b>
        <span>${rubrique(m.rubrique_id).nom} · ${esc(m.ville)}</span><span class="tampon${m.statut === "CONFIRMEE" ? "" : " vert"}">${tr((ETAPE[m.statut] || [])[2] || m.statut)}</span></div>`).join("")
      : `<p class="petit muet" style="margin:8px 0 0">${tr("Aucune mission sur cette période.")}</p>`}
    ${liste.length ? `<p class="petit" style="margin:8px 0 0">${tr("Total estimé :")} <b>${euros(liste.reduce((s, m) => s + (m.estimation_c || 0), 0))}</b> · ${duree(liste.reduce((s, m) => s + (m.duree_min || 0), 0))}</p>` : ""}</div>`;
}
/** Refonte du 22/11/2026 : chaque partie dans son onglet — vue « aujourdhui » (urgence, recherche, tuiles), « gains » (versement, niveau,
 *  avis, offre) ou « profil » (profil à compléter). Même découpage dans l'appli (TableauDeBordCleaneur). */
export function tableauDeBord(p, docs, miennes, dispo, t, vue = "aujourdhui", recherche = true) {
  const etapes = preparationCleaneur(p, docs), faites = etapes.filter(e => e[1]).length, prochaine = etapes.find(e => !e[1]);
  const commission = (t?.formule === "pro" ? REGLES.COMMISSION_PRO_PB : REGLES.COMMISSION_GRATUIT_PB) / 100;
  const offre = new Date() <= finOffreLancement() || (t?.pro_offert_jusqu && new Date(t.pro_offert_jusqu) > new Date());
  const dispoJusqu = t?.dispo_urgence_jusqu ? new Date(t.dispo_urgence_jusqu) : null;
  const conforme = p.dossier === "VALIDE";
  const auj = vue === "aujourdhui", gains = vue === "gains";
  return `<div class="tableau-cleaneur">
    ${auj ? `<p class="petit muet" style="margin:0 0 8px">${esc(dateLongue(new Date()))}</p>` : ""}
    ${gains ? `<p class="petit" style="margin:0 0 8px">💶 ${tr("Prochain versement :")} <b>${esc(dateLongue(dateVersement()))}</b> · ${tr("chaque vendredi, pour les missions validées jusqu'au mercredi minuit.")}</p>
    <span class="badge-niveau">★ ${tr("Niveau")} ${tr(niveauDe(t?.missions_terminees || 0))} · ${tr("commission")} ${commission} %</span>
    ${t?.nb_avis ? `<p class="petit" style="margin:0">⭐ ${String(t.note_moyenne).replace(".", ",")} / 5 · ${t.nb_avis} ${tr(t.nb_avis > 1 ? "avis" : "avis")}${t.pourboires_c ? ` · ${tr("pourboires :")} ${euros(t.pourboires_c)}` : ""}</p>` : ""}
    ` : ""}
    ${p.role === "admin" || vue !== "profil" ? "" : `<details class="carte profil-a-completer"${faites < etapes.length ? "" : ""}><summary><span>👤 <b>${faites === etapes.length ? tr("Profil complet") : tr("Complétez votre profil")}</b></span><b class="compte">${faites}/${etapes.length}</b></summary>
      <div class="jauge"><span style="width:${Math.round(faites / etapes.length * 100)}%"></span></div>
      ${prochaine ? `<p class="petit" style="margin:4px 0 0">${tr("Prochaine étape :")} ${tr(prochaine[0])}</p>` : ""}
      <ul class="liste-preparation" style="margin-top:10px">${etapes.map(([e, ok]) => `<li class="${ok ? "fait" : ""}"><span class="coche" aria-hidden="true">${ok ? "✓" : ""}</span><span>${e}</span></li>`).join("")}</ul></details>`}
    ${offre && gains ? `<a class="carte ligne-compte offre-tdb" href="#formules-cleaneur" data-aller="formules-cleaneur">🎁
      <div class="corps"><b>${REGLES.OFFRE_LANCEMENT_MOIS} ${tr("mois Cleaneur Pro offerts")}</b><p class="petit" style="margin:2px 0 0">${tr("Pour tous les Cleaneurs inscrits jusqu'au")} ${esc(dateLongue(finOffreLancement()))} · ${tr("commission de")} ${REGLES.COMMISSION_PRO_PB / 100} % ${tr("au lieu de")} ${REGLES.COMMISSION_GRATUIT_PB / 100} %</p></div><span class="aller" aria-hidden="true">›</span></a>` : ""}
    ${auj ? `<label class="carte ligne-compte dispo-urgence"><span class="point-dispo${dispoJusqu ? " actif" : ""}"></span>
      <div class="corps"><b>Disponible pour une urgence ?</b><p class="petit" style="margin:2px 0 0">${dispoJusqu
        ? `${tr("Vous recevez en priorité les missions urgentes jusqu'à")} ${heure(dispoJusqu.getHours(), dispoJusqu.getMinutes())}`
        : `${tr("Recevez en priorité les missions du jour pendant")} ${REGLES.URGENCE_DISPO_H} h`}</p></div>
      <input type="checkbox" class="interrupteur" data-dispo-urgence ${dispoJusqu ? "checked" : ""}></label>
    ${recherche ? `<a class="recherche-mission" href="#missions-disponibles" data-aller="missions-disponibles">🔎
      <div><b>Rechercher une mission</b><span>${tr("Les plus proches, celles qui comblent vos trous de planning")}</span></div><span aria-hidden="true">›</span></a>` : ""}
    <div class="tuiles-tdb">
      <a class="tuile-tdb" href="#missions-disponibles" data-aller="missions-disponibles"><b>${dispo.length}</b><span>${tr(dispo.length > 1 ? "missions disponibles" : "mission disponible")}</span></a>
      <a class="tuile-tdb${conforme ? " ok" : " alerte"}" href="#dossier" data-aller="dossier"><b>${conforme ? "✓" : "!"}</b><span>${tr(conforme ? "Dossier conforme" : "Dossier à compléter")}</span></a>
    </div>` : ""}</div>`;
}
function brancherTableau(boite, miennes, recharger) {
  boite.querySelectorAll("[data-aller]").forEach(a => a.onclick = e => {
    const cible = document.getElementById(a.dataset.aller);
    if (!cible) return;
    e.preventDefault();
    if (cible.closest("details")) cible.closest("details").open = true;
    const seg = cible.closest("[data-segment]")?.dataset.segment;
    if (seg) choisirSegment(boite, seg);
    cible.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  boite.querySelector("[data-dispo-urgence]")?.addEventListener("change", async e => { await dispoUrgence(e.target.checked).catch(() => null); recharger(); });
  const majJournee = () => {
    const j = boite.querySelector("#ma-journee");
    j.outerHTML = blocJournee(miennes);
    traduire(boite.querySelector("#ma-journee"));
    brancherJournee();
  };
  const brancherJournee = () => {
    boite.querySelectorAll("[data-vue-journee]").forEach(b => b.onclick = () => { vueJournee = b.dataset.vueJournee; decalage = 0; majJournee(); });
    boite.querySelectorAll("[data-decaler]").forEach(b => b.onclick = () => { decalage += Number(b.dataset.decaler); majJournee(); });
  };
  brancherJournee();
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

/** Pénalités (annulation tardive, absence) : retenues sur la réserve de garantie puis sur les prochains versements. */
export function blocPenalites(p) {
  if (!p || !(p.liste || []).length) return "";
  const reste = p.liste.reduce((s, x) => s + (x.reste_c || 0), 0);
  return `<div class="carte avertissements alerte"><b>💶 Pénalités</b>
    ${p.liste.map(x => `<p class="petit" style="margin:4px 0 0">• ${esc(dateLongue(new Date(x.le)))} : ${tr(x.raison === "absence" ? "Absence sans prévenir" : x.raison === "litige" ? "Remboursement client après litige" : "Annulation à moins de 24 h")} · ${euros(x.montant_c)}</p>`).join("")}
    ${reste ? `<p class="petit" style="margin:6px 0 0">${tr("Reste à retenir sur vos prochains versements :")} <b>${euros(reste)}</b></p>` : ""}
    <p class="petit" style="margin:4px 0 0">${tr("Réserve de garantie :")} ${euros(p.garantie_c || 0)}</p></div>`;
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
    ${m.urgence && m.prime_urgence_c ? `<p class="petit" style="margin:6px 0 0;color:var(--succes);font-weight:700">🚨 Mission d'urgence : prime de ${euros(m.prime_urgence_c)} comprise</p>` : ""}
    ${m.statut === "CONFIRMEE" ? `<div class="confirmation-mission">${(m.etapes || {}).confirme ? `<span class="tampon vert">✓ Mission confirmée</span>`
      : `<button type="button" class="bouton secondaire" data-confirmer="${esc(m.reference)}">✅ Je confirme ma venue</button>`}
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-annuler-mission="${esc(m.reference)}">Annuler la mission</button></div>` : ""}
    ${m.statut !== "CONFIRMEE" ? friseMission(m) : ""}
    ${blocAcces(m)}
    ${blocGuideMission(m)}
    ${m.statut === "EN_ROUTE" ? `<p class="petit partage-actif" style="margin:8px 0 0">📍 Position partagée avec le client pendant le trajet</p>` : ""}
    ${["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<div class="controle-mission" data-controle="${esc(m.reference)}"></div>` : ""}
    ${m.statut === "SUR_PLACE" ? blocAccesImpossible(m) : ""}
    ${m.rubrique_id === "rental" && ["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<div data-consommables="${esc(m.reference)}"></div>` : ""}
    ${m.statut === "EN_COURS" ? `<div data-signature-cleaneur="${esc(m.reference)}"></div>` : ""}
    ${blocRetardCleaneur(m)}
    <div class="boutons" style="margin-top:10px">
      ${boutonBon(m.reference)}
      ${bouton ? `<button type="button" class="bouton" data-etape="${esc(m.reference)}">${bouton}</button>` : ""}
      <a class="bouton secondaire" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${m.rue} ${m.code_postal} ${m.ville}`)}">Itinéraire</a>
    </div><p class="erreur" data-erreur-mission style="margin:6px 0 0"></p></div>`;
}

/* Accès impossible / client absent (11 novembre 2026, repris de l'appli iPhone) : après 15 min sur place et un essai pour joindre
   le client, la mission est annulée et le client doit une indemnité (30 % du prix, entre 20 et 60 €), contestable 48 h. */
export const MOTIFS_ACCES = [["ABSENT", "Client absent"], ["CLE_INTROUVABLE", "Clé ou code introuvable"], ["ACCES_REFUSE", "Accès refusé"], ["DANGEREUX", "Logement inaccessible ou dangereux"]];
function blocAccesImpossible(m) {
  return `<details class="acces-impossible" style="margin-top:10px"><summary class="petit">Impossible d'entrer ?</summary>
    <p class="petit" style="margin:6px 0">Appelez d'abord le client. Après ${REGLES.ATTENTE_ACCES_IMPOSSIBLE_MIN} min d'attente sur place, déclarez l'accès impossible : la mission est annulée et vous recevez une indemnité de ${euros(indemniteAccesC(m.estimation_c))}. En cas de danger, partez tout de suite.</p>
    <label class="champ">Motif<select data-motif-acces>${MOTIFS_ACCES.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></label>
    <label class="champ">Précisions (facultatif)<input data-note-acces maxlength="500"></label>
    <button type="button" class="bouton danger" data-acces-impossible="${esc(m.reference)}">Déclarer l'accès impossible</button></details>`;
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
    <div class="corps"><div class="haut"><h3>${m.urgence ? `<span class="tampon urgence">🚨 Urgence</span> ` : ""}${r.nom}</h3><b>${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}</b></div>
      ${m.urgence && m.prime_urgence_c ? `<p class="petit" style="margin:2px 0 0;color:var(--succes);font-weight:700">+ ${euros(m.prime_urgence_c)} de prime d'urgence</p>` : ""}
      <p class="muet" style="margin:2px 0 0">${quand(m)} · ${duree(m.duree_min)}${m.nombre_cleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
      <p class="petit" style="margin:2px 0 0">${esc(m.code_postal)} ${esc(m.ville)}${scores.has(m.reference) ? ` · <b style="color:var(--primaire)">${tr("Compatibilité")} ${Math.min(100, scores.get(m.reference))}/100</b>` : ""}</p><p class="petit" data-note-client="${esc(m.reference)}" style="margin:2px 0 0"></p><p class="erreur" data-erreur-prendre style="margin:4px 0 0"></p></div>
    ${m.choix_cleaneur === "directe" ? `<button type="button" class="bouton" data-prendre="${esc(m.reference)}">Prendre la mission</button>`
      : formulaireProposition(m, mesPropositions.find(x => x.reference === m.reference), distances.get(m.reference) ?? null)}</div>`;
}
let mesPropositions = [];
let scores = new Map();

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

/* Secteur (16 novembre 2026) : peu de missions dans le périmètre → conseil d'agrandir, avec les missions qu'il ferait gagner.
   Une notification est aussi envoyée, au plus une fois par semaine (alerte_secteur dans la base). Même encart dans l'appli. */
let alerteEnvoyee = false;
function blocSecteur(p, dispo) {
  if (p.role === "admin" || !p.zone_lat) return "";
  const zone = p.zone_km || REGLES.ZONE_KM_DEFAUT;
  const c = conseilSecteur(dispo.map(m => distances.get(m.reference)).filter(km => km != null), zone);
  if (!c) return "";
  if (!alerteEnvoyee) { alerteEnvoyee = true; supabase.rpc("alerte_secteur", { p_dans_zone: c.dansZone, p_zone_km: c.zoneKm, p_conseil_km: c.conseilKm, p_en_plus: c.enPlus }).then(() => null, () => null); }
  return `<div class="carte alerte-secteur"><div class="corps">${icone("position", { tuile: true })}<div>
      <b>${tr("Peu de missions dans votre secteur")}</b>
      <p class="petit" style="margin:4px 0 0">${c.dansZone} ${tr(c.dansZone > 1 ? "missions disponibles" : "mission disponible")} ${tr("à moins de")} ${c.zoneKm} km.
        ${c.enPlus > 0 ? `${tr("En passant à")} ${c.conseilKm} km : +${c.enPlus} ${tr(c.enPlus > 1 ? "missions" : "mission")}.` : tr("Un périmètre plus large vous montrera plus de demandes.")}</p></div></div>
    <button type="button" class="bouton petit" data-agrandir-secteur="${c.conseilKm}">${tr("Passer à")} ${c.conseilKm} km</button></div>`;
}

/** Remplit l'onglet Cleaneur : géolocalisation, aujourd'hui, prochaines missions, missions disponibles. */
/* ------------------------------------------------------------------ Onglet Missions : Disponibles · À venir · Terminées (22/11/2026) */
const CLE_SEGMENT = "cleaneroo-segment-missions";
export function choisirSegment(boite, id) {
  const boutons = [...boite.querySelectorAll("[data-segment-missions]")];
  if (!boutons.some(b => b.dataset.segmentMissions === id)) id = boutons[0]?.dataset.segmentMissions;
  boutons.forEach(b => { const oui = b.dataset.segmentMissions === id; b.classList.toggle("choisi", oui); b.setAttribute("aria-pressed", String(oui)); });
  boite.querySelectorAll("[data-segment]").forEach(z => { z.hidden = z.dataset.segment !== id; });
  try { localStorage.setItem(CLE_SEGMENT, id); } catch { /* rien */ }
}
function brancherSegments(boite, p, nbAVenir) {
  let id = null; try { id = localStorage.getItem(CLE_SEGMENT); } catch { /* rien */ }
  choisirSegment(boite, id || (nbAVenir || p.employeur_id ? "a_venir" : "disponibles"));
  boite.querySelectorAll("[data-segment-missions]").forEach(b => b.onclick = () => choisirSegment(boite, b.dataset.segmentMissions));
  boite.querySelectorAll("[data-segment-aller]").forEach(a => a.onclick = e => { e.preventDefault(); choisirSegment(boite, a.dataset.segmentAller);
    document.querySelector('.sous-onglets [data-sous-onglet="missions"]')?.click(); });
}

/* ------------------------------------------------------------------ Comptes rendus des missions terminées (22/11/2026, comme ComptesRendus.kt) */
const VERSEMENTS = { VERSE: "Versé · virement le vendredi", COMPTE_A_ACTIVER: "Activez vos versements (Gains)", ECHEC: "Versement à réessayer", RIEN: "Rien à verser" };
const ETAPES_CR = [["en_route", "En route"], ["sur_place", "Arrivé sur place"], ["debut", "Début du ménage"], ["fin", "Fin du ménage"], ["depart", "Départ du logement"]];
async function blocComptesRendus(z, salarie) {
  if (!z) return;
  z.innerHTML = `<h2 class="titre-section">🧾 ${tr("Mes comptes rendus")}</h2><p class="petit muet">${tr("Chargement…")}</p>`;
  const { data, error } = await supabase.rpc("mes_comptes_rendus");
  const l = error ? [] : (data || []);
  const hm = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? heure(d.getHours(), d.getMinutes()) : ""; };
  z.innerHTML = `<h2 class="titre-section">🧾 ${tr("Mes comptes rendus")}</h2>` + (l.length ? l.map(c => {
    const e = c.etapes || {}, debut = e.debut ? new Date(e.debut) : null, fin = e.fin ? new Date(e.fin) : null;
    const reelle = debut && fin && fin > debut ? Math.round((fin - debut) / 60000) : null;
    const [etat, cl] = c.litige === "OUVERT" ? ["Réclamation en cours", " rouge"] : c.statut === "A_VALIDER" ? ["À valider par le client", ""] : ["Validée", " vert"];
    return `<details class="carte compte-rendu" data-cr="${esc(c.reference)}"><summary>
      <div class="haut-cr"><b>${esc(rubrique(c.rubrique_id)?.nom || c.rubrique_id)}</b><span class="tampon${cl}">${tr(etat)}</span></div>
      <p class="petit" style="margin:2px 0">${c.creneau ? esc(dateLongue(new Date(c.creneau))) : ""} · ${esc(c.ville || "")} · ${tr("Client")} : ${esc(c.prenom || "")}</p>
      <p class="petit chiffres-cr">⏱ ${duree(reelle || c.duree_min || 0)}${c.pieces ? ` · 🏠 ${c.pieces} ${tr(c.pieces > 1 ? "pièces" : "pièce")}` : ""}${c.photos ? ` · 📷 ${c.photos}` : ""}${c.signe ? ` · ✍️ ${tr("Signé")}` : ""}</p>
      ${c.note ? `<p class="petit note-cr">${"★".repeat(c.note)}${"☆".repeat(5 - c.note)}${c.commentaire ? ` « ${esc(c.commentaire)} »` : ""}</p>` : ""}
      ${salarie ? "" : `<p class="petit montant-cr"><b>${euros(c.versement_c || c.montant_c || 0)}</b>${c.pourboire_c ? ` + ${euros(c.pourboire_c)} ${tr("de pourboire")}` : ""}
        <span class="muet"> · ${tr(VERSEMENTS[c.versement_statut] || (c.statut === "TERMINEE" ? "Versé 48 h après la fin" : "Après la validation"))}</span></p>`}
      <span class="lien-cr">${tr("Voir le compte rendu")}</span></summary>
      <div class="detail-cr"><ul class="petit etapes-cr">${ETAPES_CR.filter(([k]) => e[k]).map(([k, n]) => `<li>${tr(n)} : ${hm(e[k])}</li>`).join("")}</ul>
        <div data-pieces-cr><p class="petit muet">${tr("Chargement…")}</p></div>${boutonBon(c.reference)}</div></details>`;
  }).join("") : vide("Aucune mission terminée pour l'instant.", "Le compte rendu de chaque mission (photos, tâches, validation, avis) s'affichera ici."));
  traduire(z);
  brancherBons(z);
  z.querySelectorAll("[data-cr]").forEach(d => d.addEventListener("toggle", async () => {
    const zone = d.querySelector("[data-pieces-cr]");
    if (!d.open || zone.dataset.charge) return;
    zone.dataset.charge = "1";
    const { data: pieces } = await supabase.from("controles_pieces").select("*").eq("reference", d.dataset.cr).order("ordre");
    const lien = async chemin => chemin ? (await supabase.storage.from("photos-controles").createSignedUrl(chemin, 3600).catch(() => ({})))?.data?.signedUrl || "" : "";
    const lignes = await Promise.all((pieces || []).map(async x => {
      const t = x.taches || [], [av, ap] = await Promise.all([lien(x.photo_avant), lien(x.photo_apres)]);
      return `<div class="piece-cr"><b>${esc(tr(x.nom))}</b> <span class="muet">· ${t.filter(y => y.fait).length}/${t.length} ${tr("tâches")}</span>
        <div class="photos-cr">${[[av, "Avant"], [ap, "Après"]].filter(([u]) => u).map(([u, n]) => `<figure><img src="${esc(u)}" alt="${esc(tr(n))}" loading="lazy"><figcaption>${tr(n)}</figcaption></figure>`).join("")}</div>
        ${x.justification ? `<p class="petit muet">« ${esc(x.justification)} »</p>` : ""}</div>`;
    }));
    zone.innerHTML = lignes.join("") || `<p class="petit muet">${tr("Aucune pièce enregistrée pour cette mission.")}</p>`;
  }));
}

export async function brancherMissions(vue, p) {
  const boite = vue.querySelector("#missions-cleaneur");
  if (!boite) return;
  styles();
  const [miennes, dispo, geo, selfie, avert] = await Promise.all([mesMissions().catch(() => []), missionsDisponibles().catch(() => []), etatGeoloc(),
    selfieDuJour().catch(() => "aucun"), p.role === "admin" ? null : mesAvertissements().catch(() => null)]);
  mesPropositions = await supabase.rpc("mes_propositions").then(r => r.data || []).catch(() => []);
  const [penalites, docs, tableau] = await Promise.all([p.role === "admin" ? null : mesPenalites().catch(() => null),
    mesDocuments().catch(() => []), tableauCleaneur().catch(() => null)]);
  if (!document.body.contains(boite)) return;
  // Recommandation : les mieux placées d'abord (distance, enchaînement, créneaux, délai, gain horaire).
  scores = await scoresMissions(dispo, miennes, p, tableau?.formule).catch(() => new Map());
  dispo.sort((a, b) => (scores.get(b.reference) || 0) - (scores.get(a.reference) || 0));
  const auj = new Date().toDateString();
  const duJour = miennes.filter(m => m.statut !== "CONFIRMEE" || (m.creneau && new Date(m.creneau).toDateString() === auj));
  const plusTard = miennes.filter(m => !duJour.includes(m));
  // Refonte du 22/11/2026 : quatre parties rangées dans les onglets Aujourd'hui · Missions (Disponibles, À venir, Terminées) · Gains · Profil.
  boite.innerHTML = `
  <div id="cleaneur-aujourdhui" class="cleaneur-partie">
    ${geo !== "granted" ? `<div class="carte teintee geoloc"><b>📍 Géolocalisation</b>
      <p class="petit" style="margin:4px 0 10px">${geo === "denied" ? "La géolocalisation est bloquée dans votre navigateur : autorisez-la dans les réglages du site (cadenas à gauche de l'adresse)."
        : "Elle sert à prévenir le client pendant votre trajet et à confirmer votre arrivée. Votre position n'est partagée que pendant le trajet."}</p>
      ${geo === "prompt" ? `<button type="button" class="bouton" id="autoriser-geoloc">Autoriser la géolocalisation</button>` : ""}</div>` : ""}
    ${blocAvertissements(avert)}
    ${avert?.banni || !miennes.length ? "" : blocSelfie(selfie)}
    ${p.employeur_id ? "" : tableauDeBord(p, docs, miennes, dispo, tableau, "aujourdhui", !duJour.length)}
    ${duJour.map((m, i) => (i === 0 ? `<h2 class="titre-section">▶ ${tr("Prochaine action")}</h2>` : i === 1 ? `<h2 class="titre-section">🕒 ${tr("Plus tard aujourd'hui")}</h2>` : "") + carteMission(m)).join("")}
    ${!duJour.length && plusTard.length ? `<a class="carte ligne-compte prochaine-mission" href="#mes-missions-a-venir" data-segment-aller="a_venir">📅
      <div class="corps"><b>${tr("Prochaine mission")}</b><p class="petit" style="margin:2px 0 0">${esc(rubrique(plusTard[0].rubrique_id)?.nom || "")} · ${plusTard[0].creneau ? esc(dateLongue(new Date(plusTard[0].creneau))) : ""} · ${esc(plusTard[0].ville)}</p></div><span aria-hidden="true">›</span></a>` : ""}
    ${!duJour.length && !plusTard.length ? `<div class="carte vide-jour"><b>${tr("Aucune mission aujourd'hui")}</b><p class="petit" style="margin:4px 0 0">${tr("Les missions commencent le 1er janvier 2027. Elles s'afficheront ici, dans l'ordre de la journée.")}</p></div>` : ""}
  </div>
  <div id="cleaneur-missions" class="cleaneur-partie">
    <div class="segments segments-missions">${[...(p.employeur_id ? [] : [["disponibles", `${tr("Disponibles")} (${dispo.length})`]]), ["a_venir", `${tr("À venir")} (${plusTard.length})`], ["terminees", tr("Terminées")]]
      .map(([id, nom]) => `<button type="button" data-segment-missions="${id}">${nom}</button>`).join("")}</div>
    <div data-segment="disponibles">
    ${blocSecteur(p, dispo)}
    ${miennes.length || dispo.length ? `<div class="carte-missions" id="carte-missions" role="img" aria-label="Carte des missions"></div>
      <p class="petit legende-carte"><span><i style="--c:#1F8A80"></i>Mes missions</span><span><i style="--c:#FA8C66"></i>Missions disponibles (zone approximative)</span></p>` : ""}
${p.employeur_id ? "" : `    <h2 class="titre-section" id="missions-disponibles">${icone("position", { tuile: true })}Missions disponibles</h2>
    <p class="petit" style="margin-top:0">Missions en ligne pour les prestations que vous proposez et pour lesquelles vous êtes formé. Le premier Cleaneur qui la prend l'obtient.</p>
    <p class="petit" style="margin-top:0">${tr("Les plus proches et celles qui comblent vos trous de planning d'abord.")}</p>
    ${dispo.length ? dispo.map(carteDisponible).join("") : vide("Aucune mission disponible pour l'instant.", p.dossier === "VALIDE" || p.role === "admin" ? "" : "Votre dossier doit être validé pour voir et prendre des missions.")}
`}    <div id="missions-incompatibles"></div>
    </div>
    <div data-segment="a_venir">
    ${blocJournee(miennes)}
    <h2 class="titre-section" id="mes-missions-a-venir">${icone("calendrier", { tuile: true })}${tr("Mes missions à venir")}</h2>
    ${duJour.length ? `<p class="petit">${tr("Les missions du jour sont dans « Aujourd'hui ».")}</p>` : ""}
    ${plusTard.length ? plusTard.map(carteMission).join("") : vide("Aucune mission pour l'instant.", p.employeur_id ? "" : "Prenez une mission dans « Disponibles » : elle est à vous dès que vous la prenez.")}
    </div>
    <div data-segment="terminees">
    <div id="noter-clients"></div>
    <div id="comptes-rendus"></div>
    </div>
  </div>
  <div id="cleaneur-gains" class="cleaneur-partie">
    ${p.employeur_id ? `<p class="petit">${tr("Votre rémunération est versée par votre employeur.")}</p>` : tableauDeBord(p, docs, miennes, dispo, tableau, "gains")}
    ${blocPenalites(penalites)}
    <div id="avis-recus"></div>
    <div id="niveau-cleaneur"></div>
  </div>
  <div id="cleaneur-profil" class="cleaneur-partie">
    ${p.employeur_id ? "" : tableauDeBord(p, docs, miennes, dispo, tableau, "profil")}
    <div id="ce-qui-manque"></div>
    <div id="formations-cleaneur"></div>
    <details class="carte" id="mes-disponibilites"><summary><b>🗓️ ${tr("Mes disponibilités")}</b></summary>
      <div id="periodes-fermees"></div>
      <div id="creneaux-cleaneur"></div></details>
  </div>
`;
  traduire(boite);
  brancherSegments(boite, p, plusTard.length);
  blocComptesRendus(boite.querySelector("#comptes-rendus"), !!p.employeur_id);
  brancherTableau(boite, miennes, () => brancherMissions(vue, p));
  blocNoterClients(boite.querySelector("#noter-clients")).then(() => blocAvisRecus(boite.querySelector("#avis-recus")));
  if (p.role !== "admin") blocCeQuiMeManque(boite.querySelector("#ce-qui-manque"));
  if (p.role !== "admin") { blocFormations(boite.querySelector("#formations-cleaneur")); blocPeriodes(boite.querySelector("#periodes-fermees")); blocNiveau(boite.querySelector("#niveau-cleaneur")); blocCreneaux(boite.querySelector("#creneaux-cleaneur"), p); }
  remplirNotesClients(boite);
  brancherRetards(boite);
  brancherGuidesMissions(boite);
  brancherBons(boite);
  // Missions incompatibles, avec la raison (comme l'appli de Vincent).
  supabase.rpc("missions_incompatibles").then(({ data }) => {
    const z = boite.querySelector("#missions-incompatibles");
    if (!z || !data?.length) return;
    const RAISONS = { qualification: "Formation exigée par la loi (Certibiocide) : voir comment l'obtenir dans « Formations »", fermee: "Pendant une de vos périodes fermées", assurance: "Activité non couverte par votre RC Pro" };
    z.innerHTML = `<details class="carte" style="margin-top:12px"><summary><b>${tr("Missions incompatibles")} (${data.length})</b></summary>
      <p class="petit">${tr("Ces missions ne vous sont pas notifiées : vous ne pourriez pas les assurer.")}</p>
      ${data.map(x => `<p class="petit" style="margin:6px 0">${esc(rubrique(x.rubrique_id)?.nom || "")} · ${esc(x.ville)}${x.creneau ? " · " + esc(dateLongue(new Date(x.creneau))) : ""}<br><b>${tr(RAISONS[x.raison] || x.raison)}</b></p>`).join("")}</details>`;
    traduire(z);
  });
  boite.querySelectorAll("[data-consommables]").forEach(c => blocConsommablesCleaneur(c, c.dataset.consommables));
  // Signature du compte rendu, obligatoire avant « J'ai terminé ».
  boite.querySelectorAll("[data-signature-cleaneur]").forEach(async z => {
    const deja = (await signaturesDe(z.dataset.signatureCleaneur)).some(s => s.role === "cleaneur");
    if (deja) { z.innerHTML = `<p class="petit" style="color:var(--succes);margin-top:8px">✅ ${tr("Compte rendu signé.")}</p>`; return; }
    zoneSignature(z, z.dataset.signatureCleaneur, { apres: () => { z.innerHTML = `<p class="petit" style="color:var(--succes);margin-top:8px">✅ ${tr("Compte rendu signé.")}</p>`; } });
  });
  brancherPropositions(boite, () => brancherMissions(vue, p));
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
  // « Passer à N km » : le périmètre du profil est agrandi, la liste se recharge.
  boite.querySelector("[data-agrandir-secteur]")?.addEventListener("click", async e => {
    const km = Number(e.currentTarget.dataset.agrandirSecteur);
    e.currentTarget.disabled = true;
    try { await majProfil({ zone_km: km }); p = { ...p, zone_km: km }; recharger(); } catch { e.currentTarget.disabled = false; }
  });
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
      dossier: "Votre dossier doit être validé pour prendre des missions.", formule: "Cette mission est réservée aux Cleaneurs Pro pendant ses 30 premières minutes.",
      qualification: "Cette prestation exige une formation imposée par la loi (Certibiocide). Voir « Formations » pour savoir comment l'obtenir.",
      fermee: "Cette mission tombe pendant une de vos périodes fermées.",
      candidature: "Le client choisit parmi les propositions : proposez vos conditions.",
      assurance: "Votre RC Pro ne couvre pas cette activité : mettez-la à jour dans votre dossier." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  // Contrôle pièce par pièce : « J'ai terminé » reste grisé tant qu'une pièce n'est pas complète.
  boite.querySelectorAll("[data-controle]").forEach(c => {
    const m = miennes.find(x => x.reference === c.dataset.controle);
    const fin = c.closest(".carte").querySelector(`[data-etape="${CSS.escape(m.reference)}"]`);
    brancherControle(c, m, complet => { if (fin && m.statut === "EN_COURS") { fin.disabled = !complet; fin.title = complet ? "" : tr("Terminez le contrôle de chaque pièce."); } });
  });
  // Plan d'urgence : confirmer sa venue ; annuler (la pénalité et l'avertissement sont annoncés avant).
  boite.querySelectorAll("[data-confirmer]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await confirmerMission(b.dataset.confirmer).catch(() => null);
    recharger();
  });
  boite.querySelectorAll("[data-annuler-mission]").forEach(b => b.onclick = async () => {
    const ref = b.dataset.annulerMission, err = b.closest(".carte").querySelector("[data-erreur-mission]");
    const c = await coutAnnulation(ref).catch(() => null);
    const texte = !c || !c.penalite_c ? tr("Annuler cette mission ? Elle sera proposée à un autre Cleaneur.")
      : tr("Annuler à moins de 24 h entraîne une pénalité de {montant} et un avertissement. Annuler quand même ?").replace("{montant}", euros(c.penalite_c));
    if (!confirm(texte)) return;
    b.disabled = true;
    const r = await annulerMissionCleaneur(ref).catch(() => "erreur");
    if (r !== "ok") { b.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    arreterPartage();
    recharger();
  });
  boite.querySelectorAll("[data-acces-impossible]").forEach(b => b.onclick = async () => {
    const carte = b.closest(".carte"), err = carte.querySelector("[data-erreur-mission]");
    if (!confirm(tr("Déclarer l'accès impossible ? La mission sera annulée et le client prévenu."))) return;
    b.disabled = true;
    const { data: r } = await supabase.rpc("acces_impossible", { p_reference: b.dataset.accesImpossible,
      p_motif: carte.querySelector("[data-motif-acces]").value, p_note: carte.querySelector("[data-note-acces]").value.trim() });
    if (r === "ok") { arreterPartage(); recharger(); return; }
    b.disabled = false;
    err.textContent = String(r || "").startsWith("attente:") ? tr("Attendez encore {n} min sur place avant de déclarer l'accès impossible.").replace("{n}", r.split(":")[1])
      : tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.");
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
    if (suivant === "SUR_PLACE") {
      // Arrivée à 1 km au plus de l'adresse (comme l'appli de Vincent) ; sinon le client confirme la présence.
      b.disabled = true;
      const km = await distanceArrivee(m);
      b.disabled = false;
      if (km == null || km > REGLES.RAYON_ARRIVEE_KM) {
        err.innerHTML = `${esc(km == null ? tr("Votre position n'a pas pu être confirmée.") : tr("Vous êtes à {km} km de l'adresse : l'arrivée se confirme à 1 km au plus.").replace("{km}", String(Math.round(km * 10) / 10).replace(".", ",")))}
          <button type="button" class="lien-bouton" data-presence-client>${tr("Position incorrecte ? Faire confirmer ma présence par le client")}</button>`;
        err.querySelector("[data-presence-client]").onclick = async () => {
          const r = await supabase.rpc("demander_presence", { p_reference: ref }).then(x => x.data).catch(() => null);
          err.textContent = tr(r === "ok" ? "Demande envoyée : le client confirme votre présence depuis son suivi." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
        };
        return;
      }
    }
    b.disabled = true;
    const r = await avancerMission(ref, suivant).catch(() => "erreur");
    if (r !== "ok") { b.disabled = false; err.textContent = tr(r === "controle" ? "Cochez toutes les tâches de chaque pièce avant de terminer : photos avant et après, tâches, avis de l'IA ou justification."
      : r === "selfie" ? "Prenez d'abord votre selfie du jour (en haut de la page) : il confirme votre identité au client."
      : r === "consommables" ? "Notez chaque consommable avant de terminer."
      : r === "signature" ? "Signez le compte rendu avant de terminer."
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

/** Distance (km) entre la position du téléphone et l'adresse de la mission ; null si l'une des deux est introuvable. */
async function distanceArrivee(m) {
  const pos = await new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }));
  if (!pos) return null;
  const adresse = await positionAdresse(m.rue, m.code_postal, m.ville).catch(() => null);
  return adresse ? distanceKm(pos, adresse) : null;
}
