// Dossier Cleaneur complet (12 novembre 2026, repris de l'appli iPhone de Vincent) : contrat de prestataire signé, mission test
// rémunérée, activités couvertes par la RC Pro, fin de validité des documents, « Ce que je peux recevoir, et ce qui me manque ».
// Même écran dans l'appli (Dossier.kt). Base : outils/base-dossier-complet.sql.
import { supabase } from "./donnees.js";
import { REGLES, euros } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { zoneSignature } from "./signature.js";

export const CONTRAT_VERSION = "2026-12";
/** Contrat de prestataire (texte affiché et signé ; version CONTRAT_VERSION). Valeurs {entre accolades} tirées de REGLES.
 *  Relecture juridique : CONTRAT_CLEANEUR_RELECTURE.md (dépôt de l'appli). Même texte dans l'appli (Dossier.kt). */
export const CONTRAT = [
  ["Parties et objet", "Ce contrat est conclu entre Cleaneroo, qui exploite la plateforme de mise en relation cleaneroo.fr et l'application Cleaneroo, et le Cleaneur, professionnel indépendant immatriculé (micro-entreprise ou société). Cleaneroo met le Cleaneur en relation avec des clients (particuliers, conciergeries, entreprises) et lui fournit les outils de la plateforme. Chaque prestation est conclue directement entre le client et le Cleaneur, qui la réalise en son nom et sous sa responsabilité ; Cleaneroo n'est pas l'employeur du Cleaneur."],
  ["Indépendance du Cleaneur", "Le Cleaneur travaille en toute indépendance : il choisit librement s'il se rend disponible, quand, où et pour quelles missions, sans minimum d'activité ni exclusivité. Refuser une mission ou ne pas répondre n'entraîne aucune sanction. Il peut travailler pour d'autres plateformes et pour ses propres clients, et organise lui-même son travail, son matériel, ses produits et ses déplacements, dans le respect de la sécurité et de la description de la réservation. Rien dans ce contrat ne crée de lien de subordination."],
  ["Conditions pour recevoir des missions", "Pour recevoir des missions, le Cleaneur fournit et tient à jour : pièce d'identité, justificatif d'immatriculation (SIRET), attestation de vigilance URSSAF de moins de 6 mois et attestation d'assurance responsabilité civile professionnelle couvrant ses activités. Certaines prestations exigent en plus une qualification liée à la sécurité, à l'hygiène ou à l'assurance (par exemple travail en hauteur ou biocides), validée par un module ou un justificatif. Un document expiré suspend seulement les missions qui en dépendent, jusqu'à sa mise à jour."],
  ["Mission test", "Avant l'activation complète, le Cleaneur réalise une mission test rémunérée {missionTest} € par Cleaneroo, qui permet de vérifier que les exigences des prestations sont maîtrisées. Il la facture à Cleaneroo comme toute prestation."],
  ["Missions et engagement", "Les missions compatibles avec les prestations, la zone, les qualifications et les disponibilités du Cleaneur lui sont proposées. Il peut les accepter au prix affiché ou faire une proposition au client (remise jusqu'à {remiseMax} %, hausse justifiée jusqu'à {hausseMax} %, autre horaire, frais de déplacement), que le client accepte ou non. Une mission acceptée engage le Cleaneur envers le client : il la réalise lui-même ou, s'il ne le peut plus, utilise la fonction de remplacement, qui la confie à un autre Cleaneur validé. Il ne peut pas la confier à une personne non validée par Cleaneroo."],
  ["Réalisation et preuves", "Le Cleaneur réalise la prestation décrite dans la réservation avec soin, selon les règles de l'art, les consignes du client et les règles de sécurité. Pour informer le client et prévenir les litiges, l'application enregistre les étapes de la mission (départ, arrivée, début, fin), les photos avant et après, le compte rendu et, le jour de la mission, une photo du Cleaneur qui permet au client de reconnaître la personne réservée. Le Cleaneur prévient le client de tout retard depuis l'application ; au-delà de {retardTolere} min, le client peut annuler sans frais. Les fiches et formations de Cleaneroo sont des conseils de méthode et de sécurité, pas des directives sur l'organisation de son travail."],
  ["Accès impossible et client absent", "Si le Cleaneur ne peut pas entrer dans le logement ou si le client est absent, il le signale depuis l'application ; après {attente} min d'attente, il peut repartir et reçoit une indemnité de {indemnitePct} % du prix de la mission (entre {indemniteMin} € et {indemniteMax} €), payée par le client."],
  ["Prix, commission et formules", "Le prix de chaque mission est affiché avant son acceptation (ou celui de la proposition acceptée par le client). En contrepartie de la mise en relation et des services de la plateforme, Cleaneroo perçoit une commission sur l'estimation initiale de la réservation : {commissionGratuit} % en formule Gratuite, {commissionPro} % en formule Pro (abonnement de {abonnementPro} par mois, sans engagement, résiliable depuis l'espace du Cleaneur). Les pourboires reviennent en totalité au Cleaneur."],
  ["Encaissement et versements", "Le client paie sur la plateforme. Cleaneroo encaisse ces sommes au nom et pour le compte du Cleaneur, par un prestataire de paiement agréé ; le paiement du client à Cleaneroo vaut paiement au Cleaneur. Une mission est validée par le client ou, sans réclamation, automatiquement {validationAuto} h après sa fin. Chaque vendredi, Cleaneroo verse au Cleaneur les missions validées jusqu'au mercredi minuit, après déduction de sa commission, de l'abonnement éventuel et des indemnités prévues à l'article « Annulations et fiabilité », qui se compensent avec les sommes dues."],
  ["Mandat de facturation", "Le Cleaneur donne mandat à Cleaneroo d'établir et d'envoyer en son nom et pour son compte les factures de ses prestations (article 289 du Code général des impôts). Chaque facture indique qu'elle est émise par Cleaneroo au nom et pour le compte du Cleaneur et porte ses mentions légales, dont « TVA non applicable, art. 293 B du CGI » tant qu'il bénéficie de la franchise ; il prévient Cleaneroo sans délai s'il la perd. Les factures sont disponibles dans son espace : il peut les contester sous 15 jours, à défaut elles sont réputées acceptées. Le Cleaneur reste responsable de ses obligations fiscales. Le mandat prend fin avec le contrat."],
  ["Annulations et fiabilité", "Le Cleaneur peut annuler sans frais plus de 24 h avant la mission. À moins de 24 h : indemnité de {penalite24} € et un avertissement. À moins de 2 h, ou en cas d'absence : indemnité de {penalite2} €, ou {penalite2Pct} % du prix si c'est plus, et un avertissement. Ces indemnités financent le remplacement en urgence (prime versée au Cleaneur remplaçant) ; elles sont retenues sur la réserve de garantie du Cleaneur puis sur ses prochains versements. Un cas de force majeure ou un motif grave justifié (maladie, accident, urgence familiale) dans les 72 h annule l'indemnité et l'avertissement. Au-delà de {avertissementsMax} avertissements sur 12 mois, le compte est désactivé dans les conditions de l'article « Suspension et fin du contrat »."],
  ["Avis, niveaux et classement", "Après chaque mission, le client et le Cleaneur peuvent se noter ; les deux avis sont publiés ensemble. Les missions proposées au Cleaneur et leur ordre dépendent principalement : de la compatibilité (prestations, qualifications, distance, disponibilités) ; de la formule (en formule Pro, les missions apparaissent {prioritePro} min plus tôt) ; du niveau (Cleaneur, Confirmé, Expert, Élite, selon le nombre de missions et la note moyenne : les niveaux supérieurs voient certaines missions quelques minutes plus tôt) ; des favoris du client ; du taux d'annulation et des avertissements en cours. Certaines missions (entreprises, conciergeries) sont réservées selon la formule et le niveau, comme indiqué dans l'espace du Cleaneur. Le Cleaneur peut signaler un avis abusif, que Cleaneroo retire s'il ne respecte pas ses règles."],
  ["Responsabilité, assurance et garantie", "Le Cleaneur est responsable de l'exécution de ses prestations et des dommages qu'il cause ; il est assuré en responsabilité civile professionnelle pour chaque activité exercée. Cleaneroo, intermédiaire, ne répond pas de l'exécution des prestations. Lorsqu'elle indemnise un client au titre de la Garantie Cleaneroo pour un dommage causé par le Cleaneur, elle peut, après l'avoir entendu, en demander le remboursement au Cleaneur ou à son assureur, dans la limite du dommage établi. Les frais facturés par le médiateur de la consommation pour un litige portant sur la prestation du Cleaneur sont à sa charge, sauf si le litige résulte d'une erreur de Cleaneroo ; ils sont retenus sur ses prochains versements."],
  ["Confidentialité et clients", "Le Cleaneur garde strictement confidentielles les informations des clients (identité, adresse, codes, clés, guide d'accès, consignes, photos) et ne les utilise que pour la mission ; il ne conserve aucune copie des codes et remet les clés selon les consignes. Il n'utilise pas les coordonnées obtenues par Cleaneroo pour démarcher les clients en dehors de la plateforme. Ces obligations continuent après la fin du contrat."],
  ["Données personnelles", "Cleaneroo traite les données du Cleaneur (identité, documents, coordonnées, position pendant le trajet et l'arrivée seulement, photo du jour, photos et comptes rendus de mission, avis, versements) pour gérer son compte, la mise en relation, la sécurité des clients, la facturation et ses obligations légales. Les données sont conservées pendant le contrat puis selon les durées légales (factures : 10 ans). Le Cleaneur peut exercer ses droits d'accès, de rectification, d'effacement, d'opposition et de portabilité à contact@cleaneroo.fr et saisir la CNIL. Les photos de mission ne servent qu'au client, à la preuve et aux litiges, jamais à la publicité sans son accord."],
  ["Obligations sociales et fiscales", "Le Cleaneur déclare lui-même son chiffre d'affaires et paie ses cotisations et impôts. Comme le prévoit l'article 242 bis du Code général des impôts, Cleaneroo l'informe de ses obligations fiscales et sociales et lui envoie chaque année, avant le 31 janvier, le récapitulatif des sommes perçues ; elle déclare aussi ces sommes à l'administration fiscale. Lorsque les conditions des articles L7342-1 et suivants du Code du travail sont remplies, le Cleaneur bénéficie des droits qu'ils prévoient (prise en charge de l'assurance accidents du travail, formation professionnelle, validation des acquis) ; un refus concerté de fournir ses services pour défendre des revendications professionnelles ne peut entraîner ni rupture ni pénalité, sauf abus."],
  ["Suspension et fin du contrat", "Le Cleaneur peut mettre fin au contrat à tout moment depuis son compte ; il réalise ou fait remplacer les missions déjà acceptées. Cleaneroo peut, en indiquant le motif par écrit : désactiver immédiatement le compte en cas de manquement grave (fraude, faux document, vol, violence, mise en danger) ou de manquements répétés ; suspendre les missions concernées tant qu'un document obligatoire manque ; dans les autres cas, mettre fin au contrat avec un préavis de 30 jours. Le Cleaneur peut contester la décision et présenter ses explications ; Cleaneroo lui répond sous 15 jours."],
  ["Modification du contrat", "Cleaneroo informe le Cleaneur de toute modification au moins 15 jours avant son entrée en vigueur ; la nouvelle version lui est présentée pour signature dans son espace. Il peut refuser la modification en mettant fin au contrat avant cette date."],
  ["Signature, langue et litiges", "Le contrat est signé électroniquement dans l'application ; la signature, la date et la version sont conservées comme preuve. Le texte français fait foi, les traductions sont fournies pour information. Le contrat est soumis au droit français. En cas de désaccord, les parties cherchent d'abord une solution amiable pendant 30 jours (contact@cleaneroo.fr), puis peuvent saisir le tribunal compétent."],
];
const valeursContrat = () => ({ missionTest: REGLES.MISSION_TEST_C / 100, remiseMax: REGLES.PROPOSITION_REMISE_MAX_PCT, hausseMax: REGLES.PROPOSITION_HAUSSE_MAX_PCT,
  retardTolere: REGLES.RETARD_TOLERE_MIN, attente: REGLES.ATTENTE_ACCES_IMPOSSIBLE_MIN, indemnitePct: REGLES.INDEMNITE_PCT,
  indemniteMin: REGLES.INDEMNITE_MIN_C / 100, indemniteMax: REGLES.INDEMNITE_MAX_C / 100, commissionGratuit: REGLES.COMMISSION_GRATUIT_PB / 100,
  commissionPro: REGLES.COMMISSION_PRO_PB / 100, abonnementPro: euros(REGLES.ABONNEMENT_CLEANEUR_C), validationAuto: REGLES.VALIDATION_AUTO_H,
  penalite24: REGLES.PENALITE_24H_C / 100, penalite2: REGLES.PENALITE_2H_C / 100, penalite2Pct: REGLES.PENALITE_2H_PCT,
  avertissementsMax: REGLES.AVERTISSEMENTS_MAX, prioritePro: REGLES.PRIORITE_PRO_MIN });
/** Texte traduit puis valeurs remplies. */
export const texteContrat = x => tr(x).replace(/\{(\w+)\}/g, (m, k) => String(valeursContrat()[k] ?? m));

/** Contrat : texte, signature au doigt (enregistrée avec la version et la date). */
export function blocContrat(boite, profil, apres = () => {}) {
  if (!boite) return;
  if (profil?.contrat_signe_le && profil.contrat_version === CONTRAT_VERSION) {
    boite.innerHTML = `<p class="petit" style="color:var(--succes)">✅ ${tr("Contrat de prestataire signé le")} ${new Date(profil.contrat_signe_le).toLocaleDateString("fr-FR")} (${tr("version")} ${esc(profil.contrat_version || "")})</p>`;
    traduire(boite); return;
  }
  const ancienne = profil?.contrat_signe_le && profil.contrat_version !== CONTRAT_VERSION;
  boite.innerHTML = `<details class="carte" style="margin:10px 0" ${ancienne ? "open" : ""}><summary><b>📝 ${tr("Contrat de prestataire à signer")}</b></summary>
    ${ancienne ? `<p class="erreur">${tr("Nouvelle version du contrat : lisez-la et signez-la pour continuer à recevoir des missions.")}</p>` : ""}
    <p class="petit"><b>${tr("Contrat de prestataire Cleaneroo")}</b> · ${tr("Version")} ${CONTRAT_VERSION}</p>
    ${CONTRAT.map(([t, x], i) => `<p class="petit" style="margin:8px 0 0"><b>${i + 1}. ${tr(t)}.</b> ${esc(texteContrat(x))}</p>`).join("")}
    <div data-zone-contrat></div></details>`;
  traduire(boite);
  zoneSignature(boite.querySelector("[data-zone-contrat]"), null, { titre: "Signer le contrat",
    envoyer: async png => (await supabase.rpc("signer_contrat", { p_version: CONTRAT_VERSION, p_signature: png })).data,
    apres: () => { boite.innerHTML = `<p class="petit" style="color:var(--succes)">✅ ${tr("Contrat signé.")}</p>`; apres(); } });
}

/** « Ce que je peux recevoir, et ce qui me manque » (tableau de bord du Cleaneur). */
export async function blocCeQuiMeManque(boite) {
  if (!boite) return;
  const { data: m } = await supabase.rpc("ce_qui_me_manque");
  if (!boite.isConnected || !m) return;
  const lignes = [
    [m.dossier === "VALIDE", "Dossier administratif validé"],
    [m.contrat_signe, "Contrat de prestataire signé"],
    [m.mission_test === "REUSSIE", m.mission_test === "A_REFAIRE" ? `${tr("Mission test à refaire")}${m.mission_test_motif ? " : " + m.mission_test_motif : ""}` : "Mission test rémunérée réussie"],
    [!m.formations_manquantes?.length, m.formations_manquantes?.length ? `${m.formations_manquantes.length} ${tr("formation(s) à valider pour vos prestations")}` : "Formations de vos prestations validées"],
    [!m.documents_expirent?.length, m.documents_expirent?.length ? `${m.documents_expirent.length} ${tr("document(s) qui expirent bientôt")}` : "Documents à jour"],
  ];
  const ok = lignes.every(l => l[0]);
  boite.innerHTML = `<details class="carte"${ok ? "" : " open"}><summary><b>${ok ? "✅" : "📋"} ${tr("Ce que je peux recevoir, et ce qui me manque")}</b></summary>
    <ul class="manque">${lignes.map(([fait, texte]) => `<li class="${fait ? "fait" : ""}">${fait ? "✅" : "⬜"} ${tr(texte)}</li>`).join("")}</ul>
    ${m.rc_pro_activites ? `<p class="petit">${tr("Activités couvertes par votre RC Pro :")} ${m.rc_pro_activites.map(a => tr(ACTIVITES_RC_PRO.find(x => x[0] === a)?.[1] || a)).join(", ")}</p>` : ""}
    ${ok ? `<p class="petit">${tr("Vous recevez toutes les missions de vos prestations, dans votre zone et vos disponibilités.")}</p>` : ""}</details>`;
  traduire(boite);
  if (!document.getElementById("styles-manque")) { const s = document.createElement("style"); s.id = "styles-manque";
    s.textContent = `.manque{list-style:none;padding:0;margin:8px 0}.manque li{padding:4px 0}.manque li.fait{color:var(--texte2,#425E62)}`; document.head.appendChild(s); }
}

/** Activités qu'une RC Pro peut couvrir (copie de activite_rc_pro en base). */
export const ACTIVITES_RC_PRO = [["domicile", "Ménage à domicile"], ["locaux", "Locaux professionnels et parties communes"], ["vitres", "Vitres"],
  ["chantier", "Fin de chantier"], ["cuisines_pro", "Cuisines professionnelles"], ["medical", "Bionettoyage médical"], ["vehicules", "Véhicules"],
  ["textiles", "Textiles"], ["exterieurs", "Extérieurs et haute pression"], ["evenementiel", "Événementiel"], ["specialise", "Interventions spécialisées"]];

/** Gestion : mission test, activités RC Pro et contrat d'un Cleaneur. */
export async function blocDossierAdmin(boite, idCleaneur, recharger) {
  const { data: i } = await supabase.rpc("infos_dossier", { p_cleaneur: idCleaneur });
  if (!boite || !i) return;
  const act = i.rc_pro_activites;
  boite.innerHTML = `<h2 style="margin-top:20px">Mission test, RC Pro et contrat</h2>
    <div class="carte"><p><b>Contrat :</b> ${i.contrat_signe_le ? `signé le ${new Date(i.contrat_signe_le).toLocaleDateString("fr-FR")} (version ${esc(i.contrat_version || "")})` : "pas encore signé"}</p>
      <p><b>Mission test (${REGLES.MISSION_TEST_C / 100} €) :</b> ${{ A_PLANIFIER: "à planifier", REUSSIE: "réussie", A_REFAIRE: "à refaire" }[i.mission_test]}${i.mission_test_motif ? ` · ${esc(i.mission_test_motif)}` : ""}</p>
      <div class="boutons"><button class="bouton" data-test="1">Mission test réussie</button><button class="bouton danger" data-test="0">À refaire</button></div>
      <p style="margin-top:14px"><b>Activités couvertes par la RC Pro</b> <span class="petit">(rien de coché = pas encore restreint)</span></p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">${ACTIVITES_RC_PRO.map(([v, t]) =>
        `<label class="petit"><input type="checkbox" value="${v}" data-activite ${act?.includes(v) ? "checked" : ""}> ${t}</label>`).join("")}</div>
      <button class="bouton secondaire" data-enregistrer-activites style="margin-top:8px">Enregistrer les activités</button></div>`;
  boite.querySelectorAll("[data-test]").forEach(b => b.onclick = async () => {
    const reussie = b.dataset.test === "1";
    const motif = reussie ? "" : prompt("Motif (visible par le Cleaneur) :", "Qualité insuffisante");
    if (motif === null) return;
    await supabase.rpc("decider_mission_test", { p_cleaneur: idCleaneur, p_reussie: reussie, p_motif: motif || "" });
    recharger();
  });
  boite.querySelector("[data-enregistrer-activites]").onclick = async () => {
    const choix = [...boite.querySelectorAll("[data-activite]:checked")].map(c => c.value);
    await supabase.rpc("definir_activites_rc_pro", { p_cleaneur: idCleaneur, p_activites: choix.length ? choix : null });
    recharger();
  };
}
