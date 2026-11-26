// Missions du Cleaneur (onglet Cleaneur de « Mon compte ») : missions disponibles, « Prendre la mission » (rattachement
// automatique), étapes Je pars › Je suis arrivé › Je commence › J'ai terminé, et partage de la position pendant le trajet.
// Mêmes écrans que l'application (EspacesCompte.kt / ServiceTrajet.kt).
import { blocBriefIA } from "./equipements.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, dateCourte, heure, duree, finOffreLancement, indemniteAccesC, dateVersement, conseilSecteur, lienWhatsAppSupport } from "./regles.js";
import { monParrainage, lienInviterClient } from "./parrainage.js";
import { supabase, reduirePhoto, majProfil, mesDemandesPersonnelles, libererFavori, proposerProchainPassage, mesPropositionsPassage, inviterFavori, mesInvitationsFavori, alerteSecurite } from "./donnees.js";
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
import { remplirChezQui } from "./vitrine.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { missionsDisponibles, mesMissions, prendreMission, avancerMission, envoyerPosition, lienPhotoDemande,
  selfieDuJour, deposerSelfie, quitterLogement, selfiesAVerifier, deciderSelfie, lienSelfie, lienDocument,
  mesAvertissements, avertissementsCleaneurs, avertirCleaneur, leverBannissement,
  confirmerMission, coutAnnulation, annulerMissionCleaneur, mesPenalites, mesDocuments, tableauCleaneur, dispoUrgence } from "./donnees.js";
import { blocTournee, brancherTournee, blocListeCarte, brancherListeCarte } from "./tournee.js";
import { versIcs } from "./agenda.js";
import { boutonGuidage, brancherGuidage, choixGuidage, brancherChoixGuidage } from "./guidage.js";
import { brancherControle } from "./controle-ecran.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ETAPE = {
  CONFIRMEE: ["Je pars", "EN_ROUTE", "Confirmée"],
  EN_ROUTE: ["Je suis arrivé", "SUR_PLACE", "En route"],
  SUR_PLACE: ["Je commence", "EN_COURS", "Sur place"],
  EN_COURS: ["J'ai terminé", "A_VALIDER", "En cours"],
  A_VALIDER: ["Je quitte le logement", "DEPART", "À valider par le client"],
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
  .ligne-journee { display: grid; grid-template-columns: minmax(96px, auto) 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--separateur); font-size: 14px; }
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
/** Conflits du planning (lot 6) : mission qui commence avant la fin de la précédente, ou moins de 30 min pour se déplacer. */
export function conflitsPlanning(missions) {
  const l = missions.filter(m => m.creneau && !["ANNULEE", "TERMINEE"].includes(m.statut)).sort((a, b) => new Date(a.creneau) - new Date(b.creneau));
  const r = new Map();
  for (let i = 1; i < l.length; i++) {
    const finAvant = new Date(l[i - 1].creneau).getTime() + (l[i - 1].duree_min || 0) * 60000, debut = new Date(l[i].creneau).getTime();
    if (new Date(l[i - 1].creneau).toDateString() !== new Date(l[i].creneau).toDateString()) continue;
    if (debut < finAvant) r.set(l[i].reference, "conflit");
    else if (debut - finAvant < 30 * 60000 && (l[i].ville || "") !== (l[i - 1].ville || "") ) r.set(l[i].reference, "serre");
  }
  return r;
}
function blocJournee(miennes) {
  const [d, f] = periode();
  const conflits = conflitsPlanning(miennes);
  const liste = miennes.filter(m => m.creneau && new Date(m.creneau) >= d && new Date(m.creneau) < f).sort((a, b) => new Date(a.creneau) - new Date(b.creneau));
  return `<div class="ma-journee" id="ma-journee"><div class="haut-journee"><span class="surtitre">Ma journée</span></div>
    <div class="segments trois">${[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, nom]) => `<button type="button" data-vue-journee="${id}" class="${vueJournee === id ? "choisi" : ""}">${nom}</button>`).join("")}</div>
    <div class="nav-journee"><button type="button" class="lien-bouton" data-decaler="-1" aria-label="${esc(tr("Précédent"))}">‹</button><b>${esc(libellePeriode([d, f]))}</b><button type="button" class="lien-bouton" data-decaler="1" aria-label="${esc(tr("Suivant"))}">›</button></div>
    ${liste.length ? liste.map((m, i) => {
        const debut = new Date(m.creneau), fin = new Date(debut.getTime() + (m.duree_min || 0) * 60000);
        const conflit = conflits.get(m.reference);
        return `<div class="ligne-journee${conflit === "conflit" ? " en-conflit" : ""}"><b>${vueJournee === "jour" ? "" : `${esc(dateCourte(debut))} · `}${heure(debut.getHours(), debut.getMinutes())}–${heure(fin.getHours(), fin.getMinutes())}</b>
        <span>${rubrique(m.rubrique_id).nom} · ${esc(m.rue ? `${m.rue}, ` : "")}${esc(m.ville)} · ${duree(m.duree_min)}</span><span class="tampon${m.statut === "CONFIRMEE" ? "" : " vert"}">${tr((ETAPE[m.statut] || [])[2] || m.statut)}</span>
        ${conflit ? `<span class="alerte-planning ${conflit}">${icone("alerte")} ${tr(conflit === "conflit" ? "Conflit horaire avec la mission précédente" : "Moins de 30 min pour vous déplacer depuis la mission précédente")}</span>` : ""}</div>`; }).join("")
      : `<p class="petit muet" style="margin:8px 0 0">${tr("Aucune mission sur cette période.")}</p>`}
    <button type="button" class="lien-bouton exporter-missions" data-exporter-missions>${icone("calendrier")} ${tr("Ajouter mes missions à mon agenda")}</button>
    ${liste.length ? `<p class="petit" style="margin:8px 0 0">${tr("Total estimé :")} <b>${euros(liste.reduce((s, m) => s + (m.estimation_c || 0), 0))}</b> · ${duree(liste.reduce((s, m) => s + (m.duree_min || 0), 0))}</p>` : ""}</div>`;
}
/** Refonte du 22/11/2026 : chaque partie dans son onglet — vue « aujourdhui » (urgence, recherche, tuiles), « gains » (versement, niveau,
 *  avis, offre) ou « profil » (profil à compléter). Même découpage dans l'appli (TableauDeBordCleaneur). */
/** Chiffres du jour en tête de « Aujourd'hui » (26/11/2026) : uniquement des données réelles du compte. */
export function chiffresDuJour(p, duJour, dispo, t) {
  const prochaine = duJour.find(m => m.creneau);
  const d = prochaine ? new Date(prochaine.creneau) : null;
  const tuile = (ico, titre, valeur, detail, lien = "", attrs = "") => `<${lien ? `a href="${lien}" ${attrs}` : "div"} class="chiffre-jour">
    <span class="titre-chiffre">${icone(ico)}${tr(titre)}</span><b>${valeur}</b><small${ico === "horloge" ? " data-depart-kpi" : ""}>${detail}</small></${lien ? "a" : "div"}>`;
  return `<div class="chiffres-jour">
    ${tuile("calendrier", "Missions aujourd'hui", String(duJour.length), duJour.length ? `${tr("dont")} ${duJour.filter(m => ["EN_ROUTE", "SUR_PLACE", "EN_COURS"].includes(m.statut)).length} ${tr("en cours")}` : tr("Aucune mission prévue"))}
    ${tuile("horloge", "Prochaine mission", d ? heure(d.getHours(), d.getMinutes()) : "–", d ? esc(tr(rubrique(prochaine.rubrique_id)?.nom || "")) : tr("Rien de prévu aujourd'hui"))}
    ${p.employeur_id ? "" : tuile("position", "Missions disponibles", String(dispo.length), tr("autour de votre secteur"), "#missions-disponibles", 'data-aller="missions-disponibles"')}
    ${tuile("avis", "Ma note", t?.nb_avis ? String(t.note_moyenne).replace(".", ",") : "–", t?.nb_avis ? `${t.nb_avis} ${tr("avis")}` : tr("Pas encore d'avis"), "#avis-recus", 'data-sous-aller="gains"')}
  </div>`;
}

export function tableauDeBord(p, docs, miennes, dispo, t, vue = "aujourdhui", recherche = true) {
  const etapes = preparationCleaneur(p, docs), faites = etapes.filter(e => e[1]).length, prochaine = etapes.find(e => !e[1]);
  const commission = (t?.formule === "pro" ? REGLES.COMMISSION_PRO_PB : REGLES.COMMISSION_GRATUIT_PB) / 100;
  const offre = new Date() <= finOffreLancement() || (t?.pro_offert_jusqu && new Date(t.pro_offert_jusqu) > new Date());
  const dispoJusqu = t?.dispo_urgence_jusqu ? new Date(t.dispo_urgence_jusqu) : null;
  const conforme = p.dossier === "VALIDE";
  const auj = vue === "aujourdhui", gains = vue === "gains";
  return `<div class="tableau-cleaneur">
    ${gains ? `<p class="petit" style="margin:0 0 8px">${icone("paiement")} ${tr("Prochain virement de vos paiements clients :")} <b>${esc(dateLongue(dateVersement()))}</b> · ${tr("chaque vendredi, pour les missions validées jusqu'au mercredi minuit.")}</p>
    <span class="badge-niveau">★ ${tr("Niveau")} ${tr(niveauDe(t?.missions_terminees || 0))} · ${tr("commission")} ${commission} %</span>
    <p class="petit" style="margin:4px 0 8px">${icone("equipe")} ${tr("Client fidèle : dès le 3e ménage avec un même client, votre commission passe à")} <b>${t?.formule === "pro" ? 9 : 15} %</b>.</p>
    ${t?.nb_avis ? `<p class="petit" style="margin:0">${icone("avis")} ${String(t.note_moyenne).replace(".", ",")} / 5 · ${t.nb_avis} ${tr(t.nb_avis > 1 ? "avis" : "avis")}${t.pourboires_c ? ` · ${tr("pourboires :")} ${euros(t.pourboires_c)}` : ""}</p>` : ""}
    ` : ""}
    ${p.role === "admin" || vue !== "profil" ? "" : `<details class="carte profil-a-completer"${faites < etapes.length ? "" : ""}><summary><span>${icone("cleaneurs")} <b>${faites === etapes.length ? tr("Profil complet") : tr("Complétez votre profil")}</b></span><b class="compte">${faites}/${etapes.length}</b></summary>
      <div class="jauge"><span style="width:${Math.round(faites / etapes.length * 100)}%"></span></div>
      ${prochaine ? `<p class="petit" style="margin:4px 0 0">${tr("Prochaine étape :")} ${tr(prochaine[0])}</p>` : ""}
      <ul class="liste-preparation" style="margin-top:10px">${etapes.map(([e, ok]) => `<li class="${ok ? "fait" : ""}"><span class="coche" aria-hidden="true">${ok ? "✓" : ""}</span><span>${e}</span></li>`).join("")}</ul></details>`}
    ${offre && gains ? `<a class="carte ligne-compte offre-tdb" href="#formules-cleaneur" data-aller="formules-cleaneur">${icone("cadeau")}
      <div class="corps"><b>${REGLES.OFFRE_LANCEMENT_MOIS} ${tr("mois Cleaneur Pro offerts")}</b><p class="petit" style="margin:2px 0 0">${tr("Pour tous les Cleaneurs inscrits jusqu'au")} ${esc(dateLongue(finOffreLancement()))} · ${tr("commission de")} ${REGLES.COMMISSION_PRO_PB / 100} % ${tr("au lieu de")} ${REGLES.COMMISSION_GRATUIT_PB / 100} %</p></div><span class="aller" aria-hidden="true">›</span></a>` : ""}
    ${auj ? `<label class="carte ligne-compte dispo-urgence"><span class="point-dispo${dispoJusqu ? " actif" : ""}"></span>
      <div class="corps"><b>Disponible pour une urgence ?</b><p class="petit" style="margin:2px 0 0">${dispoJusqu
        ? `${tr("Vous recevez en priorité les missions urgentes jusqu'à")} ${heure(dispoJusqu.getHours(), dispoJusqu.getMinutes())}`
        : `${tr("Recevez en priorité les missions du jour pendant")} ${REGLES.URGENCE_DISPO_H} h`}</p></div>
      <input type="checkbox" class="interrupteur" data-dispo-urgence ${dispoJusqu ? "checked" : ""}></label>
    <div class="indispo-rapide" data-indispo-rapide></div>
    ${recherche ? `<a class="recherche-mission" href="#missions-disponibles" data-aller="missions-disponibles">${icone("position")}
      <div><b>Rechercher une mission</b><span>${tr("Les plus proches, celles qui comblent vos trous de planning")}</span></div><span aria-hidden="true">›</span></a>` : ""}
` : ""}</div>`;
}
function brancherTableau(boite, miennes, recharger) {
  // Performance → onglet « Gains » (sous-onglets de l'espace Cleaneur).
  boite.querySelectorAll("[data-sous-aller]").forEach(a => a.onclick = e => {
    e.preventDefault();
    document.querySelector(`.sous-onglets [data-sous-onglet="${a.dataset.sousAller}"]`)?.click();
    const cible = document.querySelector(a.getAttribute("href"));
    setTimeout(() => cible?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  });
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
  indispoRapide(boite.querySelector("[data-indispo-rapide]"), miennes, recharger);
  const majJournee = () => {
    const j = boite.querySelector("#ma-journee");
    j.outerHTML = blocJournee(miennes);
    traduire(boite.querySelector("#ma-journee"));
    brancherJournee();
  };
  // Agenda (validé le 25/11) : fichier .ics de toutes les missions à venir, à l'heure, avec l'adresse ; à refaire après de nouvelles missions.
  boite._missions = miennes;
  if (!boite.dataset.exportBranche) boite.dataset.exportBranche = "1", boite.addEventListener("click", e => {
    if (!e.target.closest("[data-exporter-missions]")) return;
    const miennes = boite._missions || [];
    const evts = miennes.filter(m => m.creneau && !["ANNULEE", "TERMINEE"].includes(m.statut) && new Date(m.creneau) > new Date(Date.now() - 864e5)).map(m => {
      const d = new Date(m.creneau);
      return { uid: m.reference, debut: d, fin: new Date(d.getTime() + (m.duree_min || 60) * 60000), titre: `${rubrique(m.rubrique_id)?.nom || "Cleaneroo"} · Cleaneroo`,
        lieu: [m.rue, m.code_postal, m.ville].filter(Boolean).join(" "), note: `${tr("Mission")} ${m.reference}` };
    });
    if (!evts.length) { alert(tr("Aucune mission à venir à ajouter.")); return; }
    const url = URL.createObjectURL(new Blob([versIcs(evts, new Date())], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "cleaneroo-mes-missions.ics" });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  const brancherJournee = () => {
    boite.querySelectorAll("[data-vue-journee]").forEach(b => b.onclick = () => { vueJournee = b.dataset.vueJournee; decalage = 0; majJournee(); });
    boite.querySelectorAll("[data-decaler]").forEach(b => b.onclick = () => { decalage += Number(b.dataset.decaler); majJournee(); });
  };
  brancherJournee();
}

/* Combler ma journée (prompt 4, lot 6, validé le 25/11) : missions disponibles le même jour qu'une de mes missions des 7 prochains
   jours, dans la même ville ou le même code postal, sans chevauchement (30 min de battement). Les meilleures d'abord (score). */
export function comblerJournee(miennes, dispo, maintenant = new Date()) {
  const fin = maintenant.getTime() + 7 * 864e5, r = [];
  const prevues = miennes.filter(m => m.creneau && !["ANNULEE", "TERMINEE"].includes(m.statut) && new Date(m.creneau) > maintenant && new Date(m.creneau).getTime() < fin);
  const plage = m => { const d = new Date(m.creneau).getTime(); return [d, d + (m.duree_min || 0) * 60000]; };
  for (const x of dispo) {
    if (!x.creneau) continue;
    const [xd, xf] = plage(x);
    const memeJour = prevues.filter(m => new Date(m.creneau).toDateString() === new Date(x.creneau).toDateString());
    if (!memeJour.length) continue;
    if (memeJour.some(m => { const [d, f] = plage(m); return xd < f + 30 * 60000 && xf + 30 * 60000 > d; })) continue;
    const proche = memeJour.find(m => (m.code_postal && m.code_postal === x.code_postal) || (m.ville && x.ville && m.ville.toLowerCase() === x.ville.toLowerCase()));
    if (!proche) continue;
    r.push({ mission: x, voisine: proche, avant: xf <= plage(proche)[0] });
  }
  return r.sort((a, b) => (scores.get(b.mission.reference) || 0) - (scores.get(a.mission.reference) || 0)).slice(0, 3);
}

/* Indisponible en un geste (prompt 4, lot 6, validé le 25/11) : aujourd'hui ou demain devient une période fermée
   (aucune mission proposée ni notifiée). Les missions déjà confirmées ce jour-là restent dues : on le dit clairement. */
async function indispoRapide(z, miennes, recharger) {
  if (!z) return;
  const { data } = await supabase.from("periodes_fermees").select("*").gt("fin", new Date().toISOString()).order("debut").then(r => r, () => ({ data: [] }));
  if (!z.isConnected) return;
  const periodes = data || [];
  const jours = [0, 1].map(i => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
  const ferme = d => periodes.find(p => new Date(p.debut) <= d && new Date(p.fin) > d);
  const confirmees = d => miennes.filter(m => m.creneau && new Date(m.creneau).toDateString() === d.toDateString() && !["ANNULEE", "TERMINEE"].includes(m.statut));
  z.innerHTML = `<div class="carte ligne-compte indispo"><div class="corps"><b>${tr("Pas disponible ?")}</b>
      <p class="petit" style="margin:2px 0 0">${tr("Plus aucune mission ne vous est proposée ni notifiée ce jour-là.")}</p></div>
    <div class="boutons-indispo">${jours.map((d, i) => { const f = ferme(d);
      return f ? `<button type="button" class="bouton secondaire petit-bouton actif" data-rouvrir-jour="${esc(f.id)}">${tr(i ? "Demain fermé" : "Aujourd'hui fermé")} · ${tr("Rouvrir")}</button>`
        : `<button type="button" class="bouton secondaire petit-bouton" data-fermer-jour="${i}">${tr(i ? "Indisponible demain" : "Indisponible aujourd'hui")}</button>`; }).join("")}</div>
    <p class="petit erreur" data-erreur-indispo style="flex-basis:100%;margin:0"></p></div>`;
  traduire(z);
  z.querySelectorAll("[data-rouvrir-jour]").forEach(b => b.onclick = async () => {
    b.disabled = true; await supabase.from("periodes_fermees").delete().eq("id", b.dataset.rouvrirJour).then(() => null, () => null); recharger();
  });
  z.querySelectorAll("[data-fermer-jour]").forEach(b => b.onclick = async () => {
    const d = jours[Number(b.dataset.fermerJour)], c = confirmees(d);
    if (c.length && !confirm(`${tr("Vous avez")} ${c.length} ${tr(c.length > 1 ? "missions confirmées ce jour-là : elles restent à assurer. Pour en annuler une, utilisez « Annuler la mission » (pénalité à moins de 24 h). Fermer quand même ce jour aux nouvelles missions ?" : "mission confirmée ce jour-là : elle reste à assurer. Pour l'annuler, utilisez « Annuler la mission » (pénalité à moins de 24 h). Fermer quand même ce jour aux nouvelles missions ?")}`)) return;
    b.disabled = true;
    const fin = new Date(d); fin.setDate(fin.getDate() + 1);
    const { error } = await supabase.from("periodes_fermees").insert({ debut: d.toISOString(), fin: fin.toISOString(), motif: "AUTRE" }).then(r => r, e => ({ error: e }));
    if (error) { b.disabled = false; z.querySelector("[data-erreur-indispo]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
}

/* ------------------------------------------------------------------ Avertissements (2 autorisés, banni au suivant) */
export function blocAvertissements(a) {
  if (!a) return "";
  const max = a.maximum ?? REGLES.AVERTISSEMENTS_MAX, n = a.nombre || 0;
  if (a.banni) return `<div class="carte avertissements banni"><b>${icone("alerte")} Compte suspendu</b>
    <p class="petit" style="margin:4px 0 0">Vous avez dépassé les ${max} avertissements autorisés : vous ne pouvez plus prendre de missions. Écrivez à contact@cleaneroo.fr pour en parler.</p></div>`;
  const pastilles = Array.from({ length: max + 1 }, (_, i) => `<i class="${i < n ? "pris" : ""}${i === max ? " dernier" : ""}"></i>`).join("");
  return `<div class="carte avertissements${n ? " alerte" : ""}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <b>${n ? icone("alerte") : icone("garantie")} Avertissements : ${n} / ${max}</b><span class="jauge-avert" aria-hidden="true">${pastilles}</span></div>
    <p class="petit" style="margin:4px 0 0">${n === 0 ? `Aucun avertissement. Vous avez droit à ${max} avertissements : au suivant, votre compte est banni.`
      : n < max ? `Encore ${max - n} avertissement possible : au-delà de ${max}, votre compte est banni.`
      : `Dernier avertissement : au prochain manquement, votre compte sera banni.`}</p>
    ${(a.liste || []).map(x => `<p class="petit" style="margin:4px 0 0">• ${esc(dateLongue(new Date(x.le)))} : ${esc(x.motif)}</p>`).join("")}</div>`;
}

/** Pénalités (annulation tardive, absence, litige) : retenues sur les versements suivants, au plus RETENUE_MAX_PCT de chacun (contrat 2026-12-c). */
export function blocPenalites(p) {
  if (!p || !(p.liste || []).length) return "";
  const reste = p.liste.reduce((s, x) => s + (x.reste_c || 0), 0);
  return `<div class="carte avertissements alerte"><b>${icone("paiement")} Pénalités</b>
    ${p.liste.map(x => `<p class="petit" style="margin:4px 0 0">• ${esc(dateLongue(new Date(x.le)))} : ${tr(x.raison === "absence" ? "Absence sans prévenir" : x.raison === "litige" ? "Remboursement client après litige" : "Annulation à moins de 24 h")} · ${euros(x.montant_c)}</p>`).join("")}
    ${reste ? `<p class="petit" style="margin:6px 0 0">${tr("Reste à retenir sur vos prochains versements :")} <b>${euros(reste)}</b> · ${tr("au plus")} ${REGLES.RETENUE_MAX_PCT} % ${tr("de chaque versement")}</p>` : ""}
    ${(p.retenues || []).map(x => `<p class="petit" style="margin:4px 0 0">${tr("Retenu sur le versement de")} ${esc(x.reference)} : ${euros(x.montant_c)}</p>`).join("")}</div>`;
}

/* ------------------------------------------------------------------ Photo de vérification du jour (identité avant la première mission) */
export function blocSelfie(statut) {
  if (statut === "VALIDE" || statut === "A_VERIFIER")
    return `<div class="carte selfie-jour" id="selfie-jour"><span style="font-size:28px">${icone("valide")}</span><div><b>Photo de vérification du jour envoyée</b>
      <p class="petit" style="margin:2px 0 0">${statut === "VALIDE" ? "Identité vérifiée par Cleaneroo." : "Votre identité est confirmée pour la journée."}</p></div></div>`;
  return `<div class="carte teintee selfie-jour" id="selfie-jour"><span style="font-size:28px">${icone("appareil-photo")}</span>
    <div style="flex:1 1 220px"><b>Photo de vérification du jour</b>
      <p class="petit" style="margin:2px 0 8px">${statut === "REFUSE" ? "Votre photo de vérification n'a pas été acceptée : reprenez-en une, visage bien visible." : "Avant votre première mission de la journée, prenez-vous en photo : le client sait que c'est bien vous qui venez."}</p>
      <label class="bouton">${icone("appareil-photo")} Prendre ma photo de vérification<input type="file" accept="image/*" capture="user" hidden data-selfie></label>
      <p class="erreur" data-erreur-selfie style="margin:6px 0 0"></p></div></div>`;
}
async function envoyerSelfie(input, err) {
  const f = input.files?.[0];
  if (!f) return false;
  err.textContent = tr("Envoi en cours…");
  try { await deposerSelfie(f); err.textContent = ""; return true; }
  catch { err.textContent = tr("La photo de vérification n'a pas pu être envoyée. Réessayez."); return false; }
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

/* Matériel à prévoir (prompt 4, lot 6, validé le 25/11) : liste indicative selon la prestation, à adapter à son organisation
   (le Cleaneur, indépendant, choisit et apporte son matériel). */
const MATERIEL_BASE = ["Aspirateur", "Seau et serpillière ou balai plat", "Microfibres (cuisine, salle de bain, vitres : couleurs séparées)", "Produits multi-surfaces, dégraissant, anticalcaire", "Gants et sacs-poubelle"];
const MATERIEL = {
  home: MATERIEL_BASE, rental: [...MATERIEL_BASE, "Kit d'accueil si prévu (consommables)", "Sac pour le linge sale"],
  windows: ["Raclette et mouilleur", "Seau et produit vitres", "Microfibres sèches", "Escabeau ou perche si besoin"],
  car: ["Aspirateur et embouts", "Microfibres", "Produits intérieur (plastiques, vitres, tissus)", "Seau, shampoing et gants de lavage si lavage extérieur"],
  textiles: ["Injecteur-extracteur", "Détachant adapté", "Brosse douce", "Aspirateur"],
  office: MATERIEL_BASE, commerce: MATERIEL_BASE, communal: [...MATERIEL_BASE, "Panneau « sol glissant »"],
  kitchen: ["Dégraissant alimentaire", "Désinfectant contact alimentaire", "Grattoir et éponges", "Gants et tablier"],
  construction: ["Aspirateur eau et poussière", "Grattoir à lame", "Décapant pour traces de plâtre et peinture", "Microfibres", "Gants et masque"],
};
function blocMateriel(m) {
  const l = MATERIEL[m.rubrique_id];
  if (!l) return "";
  return `<details class="materiel-mission"><summary class="petit"><b>${icone("valise")} ${tr("Matériel à prévoir")}</b></summary>
    <ul class="petit">${l.map(x => `<li>${tr(x)}</li>`).join("")}</ul>
    <p class="petit muet" style="margin:4px 0 0">${tr("Liste indicative selon la prestation : adaptez-la à votre organisation et aux demandes du client.")}</p></details>`;
}

/* Bouton de sécurité (lot 6, validé le 25/11) : d'abord les secours (17, 112) ; sinon prévenir le support Cleaneroo avec sa position
   (alerte_securite, base-cleaneur-idees.sql), et WhatsApp du support en secours. */
function blocSecurite(m) {
  return `<details class="securite-mission"><summary>${icone("garantie")} ${tr("Sécurité")}</summary>
    <p class="petit" style="margin:6px 0"><b>${tr("En danger immédiat ? Appelez les secours.")}</b></p>
    <div class="boutons-ligne"><a class="bouton urgence" href="tel:17">${tr("Police")} · 17</a><a class="bouton urgence" href="tel:112">${tr("Urgences")} · 112</a></div>
    <p class="petit" style="margin:10px 0 6px">${tr("Situation inquiétante (personne agressive, sentiment d'insécurité) ? Prévenez Cleaneroo avec votre position.")}</p>
    <label class="champ"><span>${tr("Ce qui se passe (facultatif)")}</span><textarea maxlength="300" rows="2" data-message-securite></textarea></label>
    <button type="button" class="bouton secondaire" data-alerte-securite="${esc(m.reference)}">${tr("Prévenir le support avec ma position")}</button>
    <p class="petit" data-retour-securite style="margin:6px 0 0"></p></details>`;
}
/* Après une mission (lot 6, validé le 25/11) :
   - prestations récurrentes (REGLES.RUBRIQUES_PASSAGE) : proposer au client une date et une heure, qu'il réserve en un geste
     (proposer_prochain_passage, base-cleaneur-idees.sql) ;
   - les autres (location saisonnière, hôtellerie, déménagement…) suivent leur propre calendrier : le Cleaneur invite plutôt le client
     à le mettre en favori, une seule fois par client (inviter_favori, base-favori-invitation.sql). */
const ETAT_PASSAGE = { PROPOSEE: "en attente de la réponse du client", ACCEPTEE: "accepté par le client", REFUSEE: "décliné par le client" };
function blocProchainsPassages(miennes, propositions, invitations = []) {
  const limite = Date.now() - 30 * 864e5;
  const recentes = miennes.filter(m => ["A_VALIDER", "TERMINEE"].includes(m.statut) && m.creneau && new Date(m.creneau).getTime() > limite).slice(0, 5);
  if (!recentes.length) return "";
  const demain = new Date(Date.now() + 864e5), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dans = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const recurrente = m => REGLES.RUBRIQUES_PASSAGE.includes(m.rubrique_id);
  const zonePassage = m => { const p = propositions.find(x => x.reference === m.reference); const h0 = m.creneau ? new Date(m.creneau).getHours() : 9;
    return p ? `<span class="petit">${tr("Proposé pour le")} ${esc(dateCourte(new Date(p.jour + "T12:00")))} ${tr("à")} ${p.heure} h · ${tr(ETAT_PASSAGE[p.statut] || "")}</span>`
      : `<details><summary class="lien-bouton">${tr("Proposer une date")}</summary>
        <div class="raccourcis-passage">${[[7, "Dans 1 semaine"], [14, "Dans 2 semaines"], [28, "Dans 4 semaines"]].map(([n, t]) => `<button type="button" class="puce" data-dans="${dans(n)}">${tr(t)}</button>`).join("")}</div>
        <div class="grille-2"><label class="champ"><span>${tr("Date")}</span><input type="date" min="${iso(demain)}" value="${dans(14)}" data-jour-passage></label>
          <label class="champ"><span>${tr("Heure d'arrivée")}</span><select data-heure-passage>${[7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18].map(h => `<option value="${h}"${h === (h0 >= 7 && h0 <= 18 ? h0 : 9) ? " selected" : ""}>${h} h</option>`).join("")}</select></label></div>
        <button type="button" class="bouton" data-proposer-passage>${tr("Proposer au client")}</button><p class="petit erreur" data-erreur-passage></p></details>`; };
  const zoneInvitation = m => { const i = invitations.find(x => x.client_reference === m.reference);
    return i ? `<span class="petit">${i.statut === "ACCEPTEE" ? `${icone("coeur")} ${tr("Vous êtes dans ses favoris")}` : tr("Invitation envoyée : le client choisit de vous ajouter ou non")}</span>`
      : `<button type="button" class="lien-bouton" data-inviter-favori="${esc(m.reference)}">${icone("coeur")} ${tr("Inviter le client à me mettre en favori")}</button><p class="petit erreur" data-erreur-invitation></p>`; };
  const titre = recentes.some(recurrente) ? (recentes.every(recurrente) ? "Proposer un prochain passage" : "Proposer un prochain passage ou rester son Cleaneur") : "Rester le Cleaneur de vos clients";
  return `<div class="carte prochains-passages"><b>${icone("repeter")} ${tr(titre)}</b>
    <p class="petit muet" style="margin:2px 0 8px">${tr(recentes.some(recurrente) ? "Le client reçoit votre proposition et réserve en un geste ; la demande vous est proposée en premier." : "En favori, vous voyez les prochaines demandes de ce client en premier. Une seule invitation par client.")}</p>
    ${recentes.map(m => `<div class="ligne-passage" data-passage="${esc(m.reference)}"><div><b>${esc(rubrique(m.rubrique_id)?.nom || "")}</b>
        <span class="petit">${esc(dateCourte(new Date(m.creneau)))} · ${esc(m.ville || "")}${m.prenom ? ` · ${esc(m.prenom)}` : ""}</span></div>
        ${recurrente(m) ? zonePassage(m) : zoneInvitation(m)}</div>`).join("")}</div>`;
}

function carteMission(m) {
  const r = rubrique(m.rubrique_id), [bouton, , etat] = ETAPE[m.statut] || [];
  return `<div class="carte mission" data-mission="${esc(m.reference)}">
    <div class="ligne-compte" style="padding:0;box-shadow:none;border:0;background:none">${icone(r.icone, { tuile: true })}
      <div class="corps"><div class="haut"><h3>${r.nom}</h3><span class="tampon${m.statut === "A_VALIDER" ? " gris" : ""}">${etat}</span></div>
      <p class="muet" style="margin:2px 0 0">${quand(m)} · ${duree(m.duree_min)}</p></div></div>
    <p style="margin:10px 0 0"><b>${esc(m.rue)}, ${esc(m.code_postal)} ${esc(m.ville)}</b></p>
    <p class="petit" style="margin:2px 0 0">${tr("Client :")} ${esc(m.prenom)} · ${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}</p>
    <div data-chez-qui="${esc(m.reference)}"></div>
    ${["EN_ROUTE", "SUR_PLACE", "EN_COURS"].includes(m.statut) || (m.statut === "CONFIRMEE" && m.creneau && new Date(m.creneau).toDateString() === new Date().toDateString()) ? `<div class="boutons boutons-acces" style="margin-top:8px">
      <button type="button" class="bouton secondaire petit-bouton" data-signaler="devant" data-ref="${esc(m.reference)}">${icone("position")} ${tr(m.rubrique_id === "car" ? "Je suis devant le véhicule" : "Je suis devant le logement")}</button>
      <button type="button" class="bouton secondaire petit-bouton" data-signaler="acces" data-ref="${esc(m.reference)}">${icone("cle")} ${tr(m.rubrique_id === "car" ? "Je ne trouve pas le véhicule" : "Je ne trouve pas l'accès")}</button></div>
      <p class="petit muet" style="margin:4px 0 0">${icone("message")} ${tr("Le client est prévenu tout de suite ; échangez avec lui dans la messagerie de la prestation.")}</p>` : ""}
    ${m.remarque ? `<p class="petit" style="margin:4px 0 0">« ${esc(m.remarque)} »</p>` : ""}
    ${blocBriefIA(m)}
    ${m.urgence ? `<p class="petit" style="margin:6px 0 0;color:var(--succes);font-weight:700">${icone("alerte")} ${tr("Mission de renfort : 0 % de commission, vous touchez 100 % du prix")}</p>` : ""}
    ${m.statut === "CONFIRMEE" ? `<div class="confirmation-mission">${(m.etapes || {}).confirme ? `<span class="tampon vert">✓ Mission confirmée</span>`
      : `<button type="button" class="bouton secondaire" data-confirmer="${esc(m.reference)}">${icone("valide")} Je confirme ma venue</button>`}
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-annuler-mission="${esc(m.reference)}">Annuler la mission</button></div>` : ""}
    ${m.statut !== "CONFIRMEE" ? friseMission(m) : ""}
    ${blocAcces(m)}
    ${blocGuideMission(m)}
    ${["CONFIRMEE", "EN_ROUTE"].includes(m.statut) ? blocMateriel(m) : ""}
    ${["EN_ROUTE", "SUR_PLACE", "EN_COURS"].includes(m.statut) ? blocSecurite(m) : ""}
    ${m.statut === "EN_ROUTE" ? `<p class="petit partage-actif" style="margin:8px 0 0">${icone("position")} Position partagée avec le client pendant le trajet</p>` : ""}
    ${["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<div class="barre-plein-ecran">
        <button type="button" class="bouton secondaire" data-plein-ecran>${icone("agrandir")} ${tr("Mode mission plein écran")}</button>
        <span class="minuteur-mission" data-minuteur="${esc((m.etapes || {}).debut || "")}" data-duree="${m.duree_min || 0}"></span>
        <button type="button" class="bouton secondaire quitter-plein-ecran" data-quitter-plein-ecran>${tr("Quitter le plein écran")}</button></div>
      <div class="controle-mission" data-controle="${esc(m.reference)}"></div>` : ""}
    ${m.statut === "SUR_PLACE" ? blocAccesImpossible(m) : ""}
    ${m.rubrique_id === "rental" && ["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<div data-consommables="${esc(m.reference)}"></div>` : ""}
    ${m.statut === "EN_COURS" ? `<div data-signature-cleaneur="${esc(m.reference)}"></div>` : ""}
    ${blocRetardCleaneur(m)}
    <div class="boutons" style="margin-top:10px">
      ${boutonBon(m.reference)}
      ${bouton ? `<button type="button" class="bouton" data-etape="${esc(m.reference)}">${bouton}</button>` : ""}
      ${boutonGuidage({ rue: m.rue, cp: m.code_postal, ville: m.ville, ...(Number.isFinite(m.acces?.vehicule?.lat) ? { lat: m.acces.vehicule.lat, lon: m.acces.vehicule.lon } : {}) })}
    </div><p class="erreur" data-erreur-mission style="margin:6px 0 0"></p></div>`;
}

/* Accès impossible / client absent (11 novembre 2026, repris de l'appli iPhone) : après 15 min sur place et un essai pour joindre
   le client, la mission est annulée et le client doit une indemnité (30 % du prix, entre 20 et 60 €), contestable 48 h. */
export const MOTIFS_ACCES = [["ABSENT", "Client absent"], ["CLE_INTROUVABLE", "Clé ou code introuvable"], ["ACCES_REFUSE", "Accès refusé"], ["DANGEREUX", "Logement inaccessible ou dangereux"]];
function blocAccesImpossible(m) {
  return `<details class="acces-impossible" style="margin-top:10px"><summary class="petit">Impossible d'entrer ?</summary>
    <p class="petit" style="margin:6px 0">${tr("Prévenez d'abord le client avec « Je ne trouve pas l'accès ».")} Après ${REGLES.ATTENTE_ACCES_IMPOSSIBLE_MIN} min d'attente sur place, déclarez l'accès impossible : la mission est annulée et vous recevez une indemnité de ${euros(indemniteAccesC(m.estimation_c))}. En cas de danger, partez tout de suite.</p>
    <label class="champ">Motif<select data-motif-acces>${MOTIFS_ACCES.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></label>
    <label class="champ">Précisions (facultatif)<input data-note-acces maxlength="500"></label>
    <button type="button" class="bouton danger" data-acces-impossible="${esc(m.reference)}">Déclarer l'accès impossible</button></details>`;
}

/** Accès au logement (transmis une fois la mission confirmée) : boîte à clés avec sa photo, personne sur place, accès autonome. */
function blocAcces(m) {
  if (m.rubrique_id === "car") return blocAccesVehicule(m);
  const a = m.acces || {};
  const ligne = (titre, texte) => `<p class="petit" style="margin:2px 0 0"><b>${titre}</b> ${esc(texte)}</p>`;
  let corps = "";
  if (m.accueil === "BOITE") corps = ligne(tr("Boîte à clés :"), a.emplacement || "") + (a.code ? ligne(tr("Code :"), a.code) : "")
    + (a.photo ? `<img class="photo-boite-mission" alt="${esc(tr("Boîte à clés"))}" data-photo-boite="${esc(a.photo)}">` : "");
  else if (m.accueil === "TIERS") corps = ligne(tr("Accueil par :"), a.nom || "");   // jamais de numéro (23/11/2026)
  else if (m.accueil === "AUTONOME") corps = ligne(tr("Accès autonome :"), a.code || "");
  else corps = `<p class="petit" style="margin:2px 0 0">${tr("Le client sera présent.")}</p>`;
  return `<div class="acces-mission">${icone("cle")}<div>${corps}</div></div>`;
}

/* Véhicules (26/11/2026) : où trouver la voiture, remise et restitution des clés, preuve « Clés reçues » / « Clés rendues »
   avec photo du tableau de bord (noter_cles, outils/base-cles-vehicule.sql). */
const LIB_REMISE = { MAIN: "En main propre par le client", PERSONNE: "Par la personne désignée", ACCUEIL: "À l'accueil de l'entreprise", BOITE: "Dans la boîte à clés", SANS: "Sans clés : extérieur seulement" };
const LIB_RESTITUTION = { MEME: "Au même endroit que la remise", MAIN: "En main propre (prévenez le client 10 min avant la fin)", ACCUEIL: "À l'accueil de l'entreprise", BOITE: "Dans la boîte à clés" };
export const clesAttendues = m => m.rubrique_id === "car" && (m.acces?.cles || "") !== "SANS" && !!m.acces?.cles;
function blocAccesVehicule(m) {
  const a = m.acces || {}, v = a.vehicule || {}, e = m.etapes || {};
  const ligne = (titre, texte) => texte ? `<p class="petit" style="margin:2px 0 0"><b>${tr(titre)}</b> ${esc(texte)}</p>` : "";
  const heureDe = x => { if (!x?.le) return ""; const d = new Date(x.le); return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`; };
  const cles = a.cles ? ligne("Remise des clés :", tr(LIB_REMISE[a.cles] || "")) + (a.cles === "BOITE" ? ligne("Boîte à clés :", a.emplacement) + ligne("Code :", a.code) : "")
      + (["PERSONNE", "ACCUEIL"].includes(a.cles) ? ligne(a.cles === "ACCUEIL" ? "Accueil :" : "Remise par :", a.nom) : "")
      + (a.restitution ? ligne("Restitution :", tr(LIB_RESTITUTION[a.restitution] || "")) + ligne("Lieu :", a.restitutionLieu)
        + (a.restitution === "BOITE" && a.cles !== "BOITE" ? ligne("Boîte à clés :", a.emplacement) + ligne("Code :", a.code) : "") : "")
      + (a.photo ? `<img class="photo-boite-mission" alt="${esc(tr("Boîte à clés"))}" data-photo-boite="${esc(a.photo)}">` : "")
    : `<p class="petit" style="margin:2px 0 0">${tr("Clés et consignes transmises une fois la mission confirmée.")}</p>`;
  const surPlace = ["SUR_PLACE", "EN_COURS"].includes(m.statut);
  const preuve = clesAttendues(m) && (surPlace || e.cles_recues) ? `<div class="preuve-cles">
      ${e.cles_recues ? `<span class="tampon vert">${icone("valide")} ${tr("Clés reçues")} ${heureDe(e.cles_recues)}</span>`
        : surPlace ? `<label class="bouton secondaire petit-bouton">${icone("photo")} ${tr("Clés reçues")}<input type="file" accept="image/*" capture="environment" hidden data-cles="recues" data-ref="${esc(m.reference)}"></label>` : ""}
      ${e.cles_rendues ? `<span class="tampon vert">${icone("valide")} ${tr("Clés rendues")} ${heureDe(e.cles_rendues)}</span>`
        : e.cles_recues && surPlace ? `<label class="bouton secondaire petit-bouton">${icone("photo")} ${tr("Clés rendues")}<input type="file" accept="image/*" capture="environment" hidden data-cles="rendues" data-ref="${esc(m.reference)}"></label>` : ""}
      ${surPlace && !e.cles_rendues ? `<p class="petit muet" style="margin:4px 0 0;flex-basis:100%">${tr("Photographiez le tableau de bord (kilométrage et carburant) : elle prouve que le véhicule n'a pas roulé. Le client est prévenu.")}</p>` : ""}</div>` : "";
  return `<div class="acces-mission">${icone("vehicule")}<div>
      ${ligne("Véhicule :", [v.modele, v.immat].filter(Boolean).join(" · "))}${ligne("Repère :", v.repere)}${ligne("Accès au parking :", v.accesParking)}
      ${cles}${preuve}</div></div>`;
}

function carteDisponible(m) {
  const r = rubrique(m.rubrique_id);
  return `<div class="carte ligne-compte" data-dispo="${esc(m.reference)}">${icone(r.icone, { tuile: true })}
    <div class="corps"><div class="haut"><h3>${m.urgence ? `<span class="tampon urgence">${icone("alerte")} Urgence</span> ` : ""}${r.nom}</h3><b>${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}</b></div>
      ${m.urgence ? `<p class="petit" style="margin:2px 0 0;color:var(--succes);font-weight:700">${tr("Renfort : 0 % de commission")} · ${tr("vous touchez")} ${euros(m.estimation_c)}</p>` : ""}
      <p class="muet" style="margin:2px 0 0">${quand(m)} · ${duree(m.duree_min)}${m.nombre_cleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
      <div data-chez-qui="${esc(m.reference)}"></div>
      <p class="petit" style="margin:2px 0 0">${esc(m.code_postal)} ${esc(m.ville)}${scores.has(m.reference) ? ` · <b style="color:var(--primaire)">${tr("Compatibilité")} ${Math.min(100, scores.get(m.reference))}/100</b>` : ""}</p><p class="petit" data-note-client="${esc(m.reference)}" style="margin:2px 0 0"></p><p class="erreur" data-erreur-prendre style="margin:4px 0 0"></p></div>
    ${personnelles.has(m.reference) ? `<div class="demande-perso"><span class="tampon vert">${icone("cleaneurs")} ${tr("Le client vous a demandé")}</span>
        <span class="petit">${tr("Réservée pour vous jusqu'à")} ${new Date(personnelles.get(m.reference)).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}</span>
        <div class="boutons-ligne"><button type="button" class="bouton" data-prendre="${esc(m.reference)}">${tr("Prendre la mission")}</button>
        <button type="button" class="bouton secondaire" data-pas-dispo="${esc(m.reference)}">${tr("Je ne suis pas disponible")}</button></div></div>`
      : m.choix_cleaneur === "directe" ? `<button type="button" class="bouton" data-prendre="${esc(m.reference)}">Prendre la mission</button>`
      : formulaireProposition(m, mesPropositions.find(x => x.reference === m.reference), distances.get(m.reference) ?? null)}</div>`;
}
let mesPropositions = [];
/** Demandes où le client m'a demandé personnellement (référence → fin de l'exclusivité). */
let personnelles = new Map();
let scores = new Map();

const vide = (t, plus = "") => `<div class="vide-compte"><p class="muet">${t}</p>${plus ? `<p class="petit">${plus}</p>` : ""}</div>`;

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

/* ------------------------------------------------------------------ « Inviter mon client » (plan de démarchage, 22/11/2026)
   Le Cleaneur fait venir ses propres clients : 0 % de commission Cleaneroo pendant 12 mois sur leurs prestations avec lui, puis la moitié.
   Seul un nouveau compte client est rattaché (lien ou code du Cleaneur saisi à l'inscription). Même écran dans l'appli (InviterClient.kt). */
async function blocInviterClient(z) {
  if (!z) return;
  const [d, r] = await Promise.all([monParrainage().catch(() => null), supabase.rpc("mes_clients_apportes")]);
  if (!d?.code || !z.isConnected) return;
  const lien = lienInviterClient(d.code), clients = r.error ? [] : (r.data || []);
  const message = tr("Bonjour, je passe par Cleaneroo pour mes ménages : réservation en 2 minutes, paiement protégé jusqu'à votre validation, facture et attestation automatiques. Créez votre compte avec mon lien :") + " " + lien;
  z.innerHTML = `<div class="carte inviter-client"><b>${icone("equipe")} ${tr("Inviter mon client")}</b>
    <p class="petit" style="margin:4px 0 8px">${tr("Vous avez déjà vos clients ? Faites-les venir sur Cleaneroo : 0 % de commission pendant 12 mois sur leurs prestations avec vous, puis la moitié. Paiement sécurisé, factures et attestations faites pour vous, remplaçant si vous êtes absent.")}</p>
    <p class="petit" style="margin:0 0 8px">${tr("Votre code :")} <b class="code">${esc(d.code)}</b></p>
    <div class="boutons-ligne"><a class="bouton" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">${icone("message")} ${tr("Envoyer par WhatsApp")}</a>
      <a class="bouton secondaire" href="sms:?&body=${encodeURIComponent(message)}">${tr("Par SMS")}</a>
      <button type="button" class="bouton secondaire" data-copier-lien>${tr("Copier le lien")}</button></div>
    ${clients.length ? `<p class="petit" style="margin:12px 0 4px"><b>${tr("Mes clients apportés")} (${clients.length})</b></p>
      ${clients.map(c => `<p class="petit" style="margin:2px 0">${esc(c.prenom || "—")}${c.ville ? ` · ${esc(c.ville)}` : ""} · ${c.missions} ${tr(c.missions > 1 ? "prestations" : "prestation")}
        · ${new Date(c.offert_jusqu) > new Date() ? `${tr("0 % jusqu'au")} ${esc(dateLongue(new Date(c.offert_jusqu)))}` : tr("commission réduite de moitié")}</p>`).join("")}` : ""}</div>`;
  traduire(z);
  z.querySelector("[data-copier-lien]").onclick = async e => {
    try { await navigator.clipboard.writeText(lien); e.target.textContent = tr("Lien copié ✓"); } catch { prompt(tr("Copiez ce lien :"), lien); }
  };
}

/* ------------------------------------------------------------------ Comptes rendus des missions terminées (22/11/2026, comme ComptesRendus.kt) */
const VERSEMENTS = { VERSE: "Versé · virement le vendredi", COMPTE_A_ACTIVER: "Activez vos versements (Gains)", ECHEC: "Versement à réessayer", RIEN: "Rien à verser" };
const ETAPES_CR = [["en_route", "En route"], ["sur_place", "Arrivé sur place"], ["debut", "Début du ménage"], ["fin", "Fin du ménage"], ["depart", "Départ du logement"]];
async function blocComptesRendus(z, salarie) {
  if (!z) return;
  z.innerHTML = `<h2 class="titre-section">${icone("document")} ${tr("Mes comptes rendus")}</h2><p class="petit muet">${tr("Chargement…")}</p>`;
  const { data, error } = await supabase.rpc("mes_comptes_rendus");
  const l = error ? [] : (data || []);
  const hm = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? heure(d.getHours(), d.getMinutes()) : ""; };
  z.innerHTML = `<h2 class="titre-section">${icone("document")} ${tr("Mes comptes rendus")}</h2>` + (l.length ? l.map(c => {
    const e = c.etapes || {}, debut = e.debut ? new Date(e.debut) : null, fin = e.fin ? new Date(e.fin) : null;
    const reelle = debut && fin && fin > debut ? Math.round((fin - debut) / 60000) : null;
    const [etat, cl] = c.litige === "OUVERT" ? ["Réclamation en cours", " rouge"] : c.statut === "A_VALIDER" ? ["À valider par le client", ""] : ["Validée", " vert"];
    return `<details class="carte compte-rendu" data-cr="${esc(c.reference)}"><summary>
      <div class="haut-cr"><b>${esc(rubrique(c.rubrique_id)?.nom || c.rubrique_id)}</b><span class="tampon${cl}">${tr(etat)}</span></div>
      <p class="petit" style="margin:2px 0">${c.creneau ? esc(dateLongue(new Date(c.creneau))) : ""} · ${esc(c.ville || "")} · ${tr("Client")} : ${esc(c.prenom || "")}</p>
      <p class="petit chiffres-cr">${icone("horloge")} ${duree(reelle || c.duree_min || 0)}${c.pieces ? ` · ${icone("logement")} ${c.pieces} ${tr(c.pieces > 1 ? "pièces" : "pièce")}` : ""}${c.photos ? ` · ${icone("appareil-photo")} ${c.photos}` : ""}${c.signe ? ` · ${icone("document")} ${tr("Signé")}` : ""}</p>
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
  personnelles = new Map((await mesDemandesPersonnelles().catch(() => [])).map(x => [x.reference, x.jusqu]));
  const [propositions, invitations] = p.employeur_id ? [[], []] : await Promise.all([mesPropositionsPassage().catch(() => null).then(x => x || []),
    mesInvitationsFavori().catch(() => null).then(x => x || [])]);
  const [penalites, docs, tableau] = await Promise.all([p.role === "admin" ? null : mesPenalites().catch(() => null),
    mesDocuments().catch(() => []), tableauCleaneur().catch(() => null)]);
  if (!document.body.contains(boite)) return;
  // Recommandation : les mieux placées d'abord (distance, enchaînement, créneaux, délai, gain horaire).
  scores = await scoresMissions(dispo, miennes, p, tableau?.formule).catch(() => new Map());
  dispo.sort((a, b) => (scores.get(b.reference) || 0) - (scores.get(a.reference) || 0));
  const auj = new Date().toDateString();
  const duJour = miennes.filter(m => m.statut !== "CONFIRMEE" || (m.creneau && new Date(m.creneau).toDateString() === auj));
  const plusTard = miennes.filter(m => !duJour.includes(m));
  // « Ma tournée » (23/11/2026) : les missions du jour sur la carte, dans l'ordre, avec l'itinéraire et le départ conseillé.
  const etapesJour = duJour.map(m => ({ titre: rubrique(m.rubrique_id)?.nom || m.rubrique_id, debut: m.creneau ? new Date(m.creneau) : null,
    adresse: `${m.rue || ""}, ${m.code_postal || ""} ${m.ville || ""}`.replace(/^[,\s]+/, "").trim(), rue: m.rue, cp: m.code_postal, ville: m.ville }));
  const combler = p.employeur_id ? [] : comblerJournee(miennes, dispo);
  // Prompt 4, lot 6 : hiérarchie Urgent · Aujourd'hui · À venir · Performance dans l'onglet « Aujourd'hui ».
  const urgent = [];
  if (geo !== "granted") urgent.push(`<div class="carte teintee geoloc"><b>${icone("position")} Géolocalisation</b>
      <p class="petit" style="margin:4px 0 10px">${geo === "denied" ? "La géolocalisation est bloquée dans votre navigateur : autorisez-la dans les réglages du site (cadenas à gauche de l'adresse)."
        : "Elle sert à prévenir le client pendant votre trajet et à confirmer votre arrivée. Votre position n'est partagée que pendant le trajet."}</p>
      ${geo === "prompt" ? `<button type="button" class="bouton" id="autoriser-geoloc">Autoriser la géolocalisation</button>` : ""}</div>`);
  if (avert && (avert.banni || avert.nombre > 0)) urgent.push(blocAvertissements(avert));
  if (!avert?.banni && duJour.length && !["VALIDE", "A_VERIFIER"].includes(selfie)) urgent.push(blocSelfie(selfie));
  for (const [ref, jusqu] of personnelles) {
    const m = dispo.find(x => x.reference === ref);
    if (m) urgent.push(`<a class="carte ligne-compte urgent-ligne" href="#missions-disponibles" data-aller="missions-disponibles">${icone("cleaneurs", { tuile: true })}
      <div class="corps"><b>${tr("Un client vous demande personnellement")}</b><p class="petit" style="margin:2px 0 0">${esc(rubrique(m.rubrique_id)?.nom || "")} · ${esc(m.ville)} · ${tr("répondez avant")} ${new Date(jusqu).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}</p></div><span aria-hidden="true">›</span></a>`);
  }
  // Conflits horaires dans les 7 prochains jours : à régler avant de partir (décaler avec le client ou annuler à temps).
  const conflits = conflitsPlanning(miennes), semaine = Date.now() + 7 * 864e5;
  for (const [ref, type] of conflits) {
    const m = miennes.find(x => x.reference === ref);
    if (type !== "conflit" || !m || new Date(m.creneau).getTime() > semaine) continue;
    urgent.push(`<a class="carte ligne-compte urgent-ligne" href="#mes-missions-a-venir" data-segment-aller="a_venir">${icone("alerte", { tuile: true })}
      <div class="corps"><b>${tr("Conflit horaire")}</b><p class="petit" style="margin:2px 0 0">${esc(rubrique(m.rubrique_id)?.nom || "")} · ${esc(dateCourte(new Date(m.creneau)))} ${heure(new Date(m.creneau).getHours(), new Date(m.creneau).getMinutes())} · ${tr("commence avant la fin de la mission précédente")}</p></div><span aria-hidden="true">›</span></a>`);
  }
  if (p.role !== "admin" && !p.employeur_id && p.dossier !== "VALIDE") urgent.push(`<a class="carte ligne-compte urgent-ligne" href="#dossier" data-aller="dossier">${icone("garantie", { tuile: true })}
      <div class="corps"><b>${tr("Complétez votre dossier Cleaneur")}</b><p class="petit" style="margin:2px 0 0">${tr("Pièce d'identité, SIRET, assurance et URSSAF.")}</p></div><span aria-hidden="true">›</span></a>`);
  // Refonte du 22/11/2026 : quatre parties rangées dans les onglets Aujourd'hui · Missions (Disponibles, À venir, Terminées) · Gains · Profil.
  // Plein écran en cours : la carte posée sur la page est remplacée par la nouvelle (rouverte en plein écran après l'affichage).
  const pleinEcran = document.querySelector("body > .mission-plein-ecran")?.dataset.mission || "";
  document.querySelectorAll("body > .mission-plein-ecran").forEach(x => { x._repere?.remove(); x.remove(); });
  boite.innerHTML = `
  <div id="cleaneur-aujourdhui" class="cleaneur-partie pilotage">
    ${urgent.length ? `<section class="niveau-tdb urgent" aria-labelledby="titre-urgent"><h2 class="titre-niveau" id="titre-urgent"><i class="pastille-niveau"></i>${tr("Urgent")}</h2>${urgent.join("")}</section>` : ""}
    ${chiffresDuJour(p, duJour, dispo, tableau)}
    <div class="pilotage-colonnes"><div class="pilotage-principal">
    <section class="niveau-tdb" aria-labelledby="titre-aujourdhui"><h2 class="titre-niveau" id="titre-aujourdhui">${tr("Ma journée")} <span class="date-niveau">${esc(dateLongue(new Date()))}</span></h2>
    ${p.employeur_id ? "" : tableauDeBord(p, docs, miennes, dispo, tableau, "aujourdhui", !duJour.length)}
    ${duJour.map((m, i) => (i === 0 ? `<h3 class="sous-niveau">${tr("Prochaine action")}</h3>` : i === 1 ? `<h3 class="sous-niveau">${tr("Plus tard aujourd'hui")}</h3>` : "") + carteMission(m)).join("")}
    ${!duJour.length ? `<div class="carte vide-jour"><b>${tr("Aucune mission aujourd'hui")}</b><p class="petit" style="margin:4px 0 0">${tr(plusTard.length ? "Votre prochaine mission est dans « À venir »." : "Les missions commencent dès l'ouverture des réservations. Elles s'afficheront ici, dans l'ordre de la journée.")}</p></div>` : ""}
    </section></div><div class="pilotage-cote">
    ${duJour.length ? `<div id="tournee-jour" class="carte pilotage-bloc">${blocTournee(etapesJour)}</div>` : ""}
    <section class="niveau-tdb carte pilotage-bloc" aria-labelledby="titre-a-venir"><h2 class="titre-niveau" id="titre-a-venir">${tr("À venir")}</h2>
    ${combler.length ? `<div class="combler-journee"><b>${icone("calendrier")} ${tr("Combler votre journée")}</b>
      <p class="petit muet" style="margin:2px 0 6px">${tr("Missions disponibles près de vos missions prévues, sans chevauchement.")}</p>
      ${combler.map(c => `<a class="ligne-a-venir" href="#missions-disponibles" data-aller="missions-disponibles">
        <span class="quand-a-venir"><b>${esc(dateCourte(new Date(c.mission.creneau)))}</b><span>${heure(new Date(c.mission.creneau).getHours(), new Date(c.mission.creneau).getMinutes())}</span></span>
        <span class="corps">${icone(rubrique(c.mission.rubrique_id)?.icone || "termine")} <span><b>${esc(rubrique(c.mission.rubrique_id)?.nom || "")} · ${c.mission.sur_devis ? tr("Sur devis") : euros(c.mission.estimation_c)}</b>
          <span class="petit">${tr(c.avant ? "Avant votre mission de" : "Après votre mission de")} ${heure(new Date(c.voisine.creneau).getHours(), new Date(c.voisine.creneau).getMinutes())} · ${esc(c.mission.ville || "")}</span></span></span>
        <span aria-hidden="true">›</span></a>`).join("")}</div>` : ""}
    ${plusTard.length ? `<div class="liste-a-venir">${plusTard.slice(0, 4).map(m => `<a class="ligne-a-venir" href="#mes-missions-a-venir" data-segment-aller="a_venir">
        <span class="quand-a-venir"><b>${m.creneau ? esc(dateCourte(new Date(m.creneau))) : tr("Date flexible")}</b>${m.creneau ? `<span>${heure(new Date(m.creneau).getHours(), new Date(m.creneau).getMinutes())}</span>` : ""}</span>
        <span class="corps">${icone(rubrique(m.rubrique_id)?.icone || "termine")} <span><b>${esc(rubrique(m.rubrique_id)?.nom || "")}</b><span class="petit">${esc(m.ville || "")} · ${duree(m.duree_min)} · ${m.sur_devis ? tr("Sur devis") : euros(m.estimation_c)}</span></span></span>
        <span aria-hidden="true">›</span></a>`).join("")}
      ${plusTard.length > 4 ? `<a class="lien-bouton" href="#mes-missions-a-venir" data-segment-aller="a_venir">${tr("Voir mes")} ${plusTard.length} ${tr("missions à venir")} ›</a>` : ""}</div>`
      : `<p class="petit muet" style="margin:0">${tr("Aucune mission à venir pour l'instant.")}</p>`}
    </section>
    ${p.employeur_id ? "" : `<section class="niveau-tdb carte pilotage-bloc" aria-labelledby="titre-performance"><h2 class="titre-niveau" id="titre-performance">${tr("Performance")}</h2>
    <div class="tuiles-tdb performance">
      <a class="tuile-tdb" href="#cleaneur-gains" data-sous-aller="gains"><b>${tableau?.missions_terminees || 0}</b><span>${tr((tableau?.missions_terminees || 0) > 1 ? "missions réalisées" : "mission réalisée")}</span></a>
      <a class="tuile-tdb${p.dossier === "VALIDE" ? " ok" : " alerte"}" href="#dossier" data-aller="dossier"><b>${p.dossier === "VALIDE" ? "✓" : "!"}</b><span>${tr(p.dossier === "VALIDE" ? "Dossier conforme" : "Dossier à compléter")}</span></a>
    </div>
    <a class="lien-bouton" href="#cleaneur-gains" data-sous-aller="gains">${tr("Voir mes revenus")} ›</a>
    ${avert && !avert.banni && !(avert.nombre > 0) ? blocAvertissements(avert) : ""}
    </section>`}
    </div></div>
  </div>
  <div id="cleaneur-missions" class="cleaneur-partie">
    <div class="segments segments-missions">${[...(p.employeur_id ? [] : [["disponibles", `${tr("Disponibles")} (${dispo.length})`]]), ["a_venir", `${tr("À venir")} (${plusTard.length})`], ["terminees", tr("Terminées")]]
      .map(([id, nom]) => `<button type="button" data-segment-missions="${id}">${nom}</button>`).join("")}</div>
    <div data-segment="disponibles">
    ${blocSecteur(p, dispo)}
${p.employeur_id ? "" : `    <h2 class="titre-section" id="missions-disponibles">${icone("position", { tuile: true })}Missions disponibles</h2>
    <p class="petit" style="margin-top:0">Missions en ligne pour les prestations que vous proposez et pour lesquelles vous êtes formé. Le premier Cleaneur qui la prend l'obtient.</p>
    <p class="petit" style="margin-top:0">${tr("Les plus proches et celles qui comblent vos trous de planning d'abord.")}</p>
    ${blocListeCarte(dispo.length)}
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
    ${p.employeur_id ? "" : blocProchainsPassages(miennes, propositions, invitations)}
    <div id="noter-clients"></div>
    <div id="comptes-rendus"></div>
    </div>
  </div>
  <div id="cleaneur-gains" class="cleaneur-partie">
    ${p.employeur_id ? `<p class="petit">${tr("Votre rémunération est versée par votre employeur.")}</p>` : tableauDeBord(p, docs, miennes, dispo, tableau, "gains")}
    ${p.employeur_id ? "" : `<div id="inviter-client"></div>`}
    ${blocPenalites(penalites)}
    <div id="avis-recus"></div>
    <div id="niveau-cleaneur"></div>
  </div>
  <div id="cleaneur-profil" class="cleaneur-partie">
    ${p.employeur_id ? "" : tableauDeBord(p, docs, miennes, dispo, tableau, "profil")}
    <details class="carte" id="mes-disponibilites" open><summary><b>${icone("calendrier")} ${tr("Mes disponibilités")}</b></summary>
      <p class="petit muet" style="margin:6px 0 0">${tr("Vos créneaux habituels et vos congés : les clients voient vos prochains jours ouverts sur votre fiche, et les missions qui y tombent passent en tête.")}</p>
      <div id="creneaux-cleaneur"></div>
      <div id="periodes-fermees"></div></details>
    <div id="ce-qui-manque"></div>
    <div id="formations-cleaneur"></div>
    ${p.employeur_id ? "" : `<div id="materiel-cleaneur"></div>`}
    <div class="carte preferences-cleaneur">${choixGuidage()}</div>
    <a class="carte ligne-compte aide-whatsapp" href="${lienWhatsAppSupport("Bonjour Cleaneroo, je suis Cleaneur et j'ai une question : ")}" target="_blank" rel="noopener">${icone("message")}
      <div class="corps"><b>${tr("Une question ? Écrivez-nous sur WhatsApp")}</b><p class="petit" style="margin:2px 0 0">${tr("Le support Cleaneroo vous répond directement.")}</p></div><span aria-hidden="true">›</span></a>
  </div>
`;
  traduire(boite);
  import("./equipements.js").then(m => m.blocMonMateriel(boite.querySelector("#materiel-cleaneur"), p)).catch(() => null);
  brancherSegments(boite, p, plusTard.length);
  blocComptesRendus(boite.querySelector("#comptes-rendus"), !!p.employeur_id);
  blocInviterClient(boite.querySelector("#inviter-client"));
  brancherTableau(boite, miennes, () => brancherMissions(vue, p));
  blocNoterClients(boite.querySelector("#noter-clients")).then(() => blocAvisRecus(boite.querySelector("#avis-recus")));
  if (p.role !== "admin") blocCeQuiMeManque(boite.querySelector("#ce-qui-manque"));
  if (p.role !== "admin") { blocFormations(boite.querySelector("#formations-cleaneur")); blocPeriodes(boite.querySelector("#periodes-fermees")); blocNiveau(boite.querySelector("#niveau-cleaneur")); blocCreneaux(boite.querySelector("#creneaux-cleaneur"), p); }
  remplirNotesClients(boite);
  brancherRetards(boite);
  brancherGuidesMissions(boite);
  // Vitrine du client professionnel et « Je suis devant le logement / Je ne trouve pas l'accès » (23/11/2026).
  remplirChezQui(boite);
  brancherGuidage(boite);
  brancherChoixGuidage(boite, () => brancherMissions(vue, p));
  boite.querySelectorAll("[data-signaler]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data } = await supabase.rpc("signaler_acces", { p_reference: b.dataset.ref, p_type: b.dataset.signaler }).catch(() => ({ data: null }));
    b.textContent = data === "ok" ? `✓ ${tr("Client prévenu")}` : tr("Réessayez dans un instant");
    if (data !== "ok") b.disabled = false;
  });
  brancherBons(boite);
  // Missions incompatibles, avec la raison (comme l'appli de Vincent).
  supabase.rpc("missions_incompatibles").then(({ data }) => {
    const z = boite.querySelector("#missions-incompatibles");
    if (!z || !data?.length) return;
    const RAISONS = { qualification: "Formation exigée par la loi (Certibiocide) : voir comment l'obtenir dans « Formations »", fermee: "Pendant une de vos périodes fermées", assurance: "Activité non couverte par votre RC Pro", equipement: "Matériel nécessaire non coché dans « Mon matériel »" };
    z.innerHTML = `<details class="carte" style="margin-top:12px"><summary><b>${tr("Missions incompatibles")} (${data.length})</b></summary>
      <p class="petit">${tr("Ces missions ne vous sont pas notifiées : vous ne pourriez pas les assurer.")}</p>
      ${data.map(x => `<p class="petit" style="margin:6px 0">${esc(rubrique(x.rubrique_id)?.nom || "")} · ${esc(x.ville)}${x.creneau ? " · " + esc(dateLongue(new Date(x.creneau))) : ""}<br><b>${tr(RAISONS[x.raison] || x.raison)}</b></p>`).join("")}</details>`;
    traduire(z);
  });
  boite.querySelectorAll("[data-consommables]").forEach(c => blocConsommablesCleaneur(c, c.dataset.consommables));
  // Signature du compte rendu, obligatoire avant « J'ai terminé ».
  boite.querySelectorAll("[data-signature-cleaneur]").forEach(async z => {
    const deja = (await signaturesDe(z.dataset.signatureCleaneur)).some(s => s.role === "cleaneur");
    if (deja) { z.innerHTML = `<p class="petit" style="color:var(--succes);margin-top:8px">${icone("valide")} ${tr("Compte rendu signé.")}</p>`; return; }
    zoneSignature(z, z.dataset.signatureCleaneur, { apres: () => { z.innerHTML = `<p class="petit" style="color:var(--succes);margin-top:8px">${icone("valide")} ${tr("Compte rendu signé.")}</p>`; } });
  });
  brancherPropositions(boite, () => brancherMissions(vue, p));
  majTemps(boite);
  clearInterval(minuterieFrise);
  minuterieFrise = setInterval(() => { if (!boite.isConnected) return clearInterval(minuterieFrise); majTemps(boite); }, 60000);
  // Photo de vérification du jour prise depuis le bloc du haut.
  boite.querySelector("#selfie-jour [data-selfie]")?.addEventListener("change", async e => {
    if (await envoyerSelfie(e.target, boite.querySelector("[data-erreur-selfie]"))) recharger();
  });
  // Photo de la boîte à clés : lien temporaire, seulement pour le Cleaneur de la mission.
  boite.querySelectorAll("[data-photo-boite]").forEach(async img => {
    try { img.src = await lienPhotoDemande(img.dataset.photoBoite); } catch { img.remove(); }
  });
  brancherTournee(boite.querySelector("#tournee-jour"), etapesJour, p.zone_lat != null && p.zone_lon != null ? { lat: Number(p.zone_lat), lon: Number(p.zone_lon) } : null);
  brancherListeCarte(boite.querySelector('[data-segment="disponibles"]'), dispo, miennes,
    { libelle: m => rubrique(m.rubrique_id)?.nom || "", quand, prix: m => m.sur_devis ? tr("Sur devis") : euros(m.estimation_c) });
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
  // Demandé personnellement mais pas disponible : la demande s'ouvre tout de suite aux autres Cleaneurs, le client est prévenu.
  boite.querySelectorAll("[data-pas-dispo]").forEach(b => b.onclick = async () => {
    if (!confirm(tr("Vous n'êtes pas disponible ? La demande sera proposée tout de suite aux autres Cleaneurs, et le client sera prévenu."))) return;
    b.disabled = true;
    try { await libererFavori(b.dataset.pasDispo); recharger(); } catch { b.disabled = false; }
  });
  boite.querySelectorAll("[data-prendre]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await prendreMission(b.dataset.prendre).catch(() => "erreur");
    if (r === "ok") return recharger();
    b.disabled = false;
    b.closest(".carte").querySelector("[data-erreur-prendre]").textContent = tr({
      deja_prise: "Un autre Cleaneur a pris cette mission juste avant vous.", ouverture: "Les missions commencent dès l'ouverture des réservations.",
      dossier: "Votre dossier doit être validé pour prendre des missions.", formule: "Cette mission est réservée aux Cleaneurs Pro pendant ses 30 premières minutes.",
      qualification: "Cette prestation exige une formation imposée par la loi (Certibiocide). Voir « Formations » pour savoir comment l'obtenir.",
      fermee: "Cette mission tombe pendant une de vos périodes fermées.",
      candidature: "Le client choisit parmi les propositions : proposez vos conditions.",
      assurance: "Votre RC Pro ne couvre pas cette activité : mettez-la à jour dans votre dossier.",
      equipement: "Cette mission demande un matériel que vous n'avez pas coché dans « Mon matériel » (Profil)." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  // Mode mission plein écran (lot 6, validé le 25/11) : la carte de la mission occupe tout l'écran, gros boutons, minuteur
  // (temps écoulé depuis « Je commence » / durée prévue). Le contrôle continue de fonctionner sans réseau (file-attente.js).
  boite.querySelectorAll("[data-plein-ecran]").forEach(b => b.onclick = () => {
    const carte = b.closest(".carte.mission");
    // Posée sur la page entière (un parent animé empêcherait la position fixe) ; remise à sa place en quittant.
    const repere = document.createComment("mission"); carte.before(repere); carte._repere = repere; document.body.append(carte);
    carte.classList.add("mission-plein-ecran"); document.body.classList.add("sans-defilement");
    document.documentElement.requestFullscreen?.().catch(() => null);
    // On arrive directement sur la zone de travail : minuteur puis contrôle pièce par pièce.
    requestAnimationFrame(() => { carte.scrollTop = Math.max(0, carte.querySelector(".barre-plein-ecran").offsetTop - 4); });
  });
  boite.querySelectorAll("[data-quitter-plein-ecran]").forEach(b => b.onclick = () => {
    const carte = b.closest(".carte.mission");
    carte.classList.remove("mission-plein-ecran"); document.body.classList.remove("sans-defilement");
    if (carte._repere?.isConnected) carte._repere.replaceWith(carte); else carte.remove();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => null);
  });
  if (pleinEcran) {
    const nb = boite.querySelector(`.carte.mission[data-mission="${CSS.escape(pleinEcran)}"] [data-plein-ecran]`);
    if (nb) nb.click(); else document.body.classList.remove("sans-defilement");
  }
  if (!window._finPleinEcran) window._finPleinEcran = addEventListener("hashchange", () => {
    document.querySelectorAll("body > .mission-plein-ecran").forEach(x => { x._repere?.remove(); x.remove(); });
    document.body.classList.remove("sans-defilement");
  }) || true;
  const minuteurs = () => boite.querySelectorAll("[data-minuteur]").forEach(z => {
    if (!z.isConnected) return;
    const debut = z.dataset.minuteur ? new Date(z.dataset.minuteur) : null, prevu = Number(z.dataset.duree) || 0;
    if (!debut || isNaN(debut)) { z.textContent = prevu ? `${tr("Durée prévue :")} ${duree(prevu)}` : ""; return; }
    const ecoule = Math.max(0, Math.floor((Date.now() - debut) / 60000));
    z.textContent = `${tr("Écoulé")} ${duree(ecoule) || "0 min"}${prevu ? ` / ${tr("prévu")} ${duree(prevu)}` : ""}`;
    z.classList.toggle("depasse", prevu && ecoule > prevu);
  });
  minuteurs(); clearInterval(boite._minuteur); boite._minuteur = setInterval(minuteurs, 30000);
  boite.querySelectorAll("[data-alerte-securite]").forEach(b => b.onclick = async () => {
    const zone = b.closest(".securite-mission"), retour = zone.querySelector("[data-retour-securite]"), message = zone.querySelector("[data-message-securite]").value.trim();
    b.disabled = true; retour.textContent = tr("Envoi en cours…");
    const pos = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok(p.coords), () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }) : ok(null));
    const r = await alerteSecurite(b.dataset.alerteSecurite, pos?.latitude ?? null, pos?.longitude ?? null, message).catch(() => null);
    const lien = lienWhatsAppSupport(`${tr("ALERTE SÉCURITÉ")} · ${tr("Mission")} ${b.dataset.alerteSecurite}${message ? ` · ${message}` : ""}${pos ? ` · https://www.google.com/maps?q=${pos.latitude},${pos.longitude}` : ""}`);
    retour.innerHTML = r === "ok" || r === "deja" ? `${icone("valide")} ${tr("Le support Cleaneroo est prévenu, avec votre position.")} <a href="${esc(lien)}" target="_blank" rel="noopener">${tr("Écrire aussi sur WhatsApp")}</a>`
      : `${tr("L'alerte n'a pas pu partir : prévenez le support sur WhatsApp.")} <a class="bouton" href="${esc(lien)}" target="_blank" rel="noopener">WhatsApp</a>`;
    b.disabled = false;
  });
  boite.querySelectorAll("[data-inviter-favori]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await inviterFavori(b.dataset.inviterFavori).catch(() => "erreur");
    if (["ok", "deja", "deja_favori"].includes(r)) return recharger();
    b.disabled = false;
    b.nextElementSibling.textContent = tr(r === "impossible" ? "Ce client n'a pas de compte : il ne peut pas recevoir d'invitation." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  boite.querySelectorAll("[data-passage]").forEach(z => {
    z.querySelectorAll("[data-dans]").forEach(x => x.onclick = () => { z.querySelector("[data-jour-passage]").value = x.dataset.dans; });
    const bt = z.querySelector("[data-proposer-passage]");
    if (bt) bt.onclick = async () => {
      const jour = z.querySelector("[data-jour-passage]").value, h = Number(z.querySelector("[data-heure-passage]").value), err = z.querySelector("[data-erreur-passage]");
      if (!jour) { err.textContent = tr("Choisissez une date."); return; }
      bt.disabled = true;
      const r = await proposerProchainPassage(z.dataset.passage, jour, h).catch(() => "erreur");
      if (r === "ok") return recharger();
      bt.disabled = false;
      err.textContent = tr({ deja: "Une proposition est déjà en attente pour ce client.", date: "Choisissez une date entre demain et dans 3 mois.", impossible: "Ce client n'a pas de compte : il ne peut pas recevoir de proposition.", prestation: "Cette prestation suit son propre calendrier : invitez plutôt le client à vous mettre en favori." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    };
  });
  // Contrôle pièce par pièce : « J'ai terminé » reste grisé tant qu'une pièce n'est pas complète.
  boite.querySelectorAll("[data-controle]").forEach(c => {
    const m = miennes.find(x => x.reference === c.dataset.controle);
    const fin = c.closest(".carte").querySelector(`[data-etape="${CSS.escape(m.reference)}"]`);
    brancherControle(c, m, complet => { if (fin && m.statut === "EN_COURS") { fin.disabled = !complet; fin.title = complet ? "" : tr("Terminez le contrôle de chaque pièce."); } });
  });
  // Véhicules : « Clés reçues » / « Clés rendues » avec photo du tableau de bord (noter_cles).
  boite.querySelectorAll("[data-cles]").forEach(inp => inp.onchange = async () => {
    const f = inp.files[0], ref = inp.dataset.ref, moment = inp.dataset.cles, err = inp.closest(".carte").querySelector("[data-erreur-mission]");
    if (!f) return;
    inp.closest("label").classList.add("en-cours");
    let chemin = "";
    try {
      chemin = `${ref}/cles-${moment}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("photos-controles").upload(chemin, await reduirePhoto(f, 1280, 0.7), { contentType: "image/jpeg" });
      if (error) chemin = "";
    } catch { chemin = ""; }
    if (!chemin) { inp.closest("label").classList.remove("en-cours"); err.textContent = tr("La photo n'a pas pu être envoyée. Réessayez."); return; }
    const r = await supabase.rpc("noter_cles", { p_reference: ref, p_moment: moment, p_photo: chemin }).then(x => x.data).catch(() => null);
    if (r !== "ok" && r !== "deja") { inp.closest("label").classList.remove("en-cours"); err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
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
      err.textContent = tr("Prenez d'abord votre photo de vérification du jour (en haut de la page) : elle confirme votre identité au client.");
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
    if (suivant === "A_VALIDER" && clesAttendues(m) && !(m.etapes || {}).cles_rendues) {
      err.textContent = tr("Rendez d'abord les clés au client avec « Clés rendues » (photo du tableau de bord), puis terminez.");
      return;
    }
    b.disabled = true;
    const r = await avancerMission(ref, suivant).catch(() => "erreur");
    if (r !== "ok") { b.disabled = false; err.textContent = tr(r === "controle" ? "Cochez toutes les tâches de chaque pièce avant de terminer : photos avant et après, tâches, avis de l'IA ou justification."
      : r === "selfie" ? "Prenez d'abord votre photo de vérification du jour (en haut de la page) : elle confirme votre identité au client."
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
