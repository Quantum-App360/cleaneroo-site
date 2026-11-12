// Dossier Cleaneur complet (12 novembre 2026, repris de l'appli iPhone de Vincent) : contrat de prestataire signé, mission test
// rémunérée, activités couvertes par la RC Pro, fin de validité des documents, « Ce que je peux recevoir, et ce qui me manque ».
// Même écran dans l'appli (Dossier.kt). Base : outils/base-dossier-complet.sql.
import { supabase } from "./donnees.js";
import { REGLES } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { zoneSignature } from "./signature.js";

export const CONTRAT_VERSION = "2026-11";
/** Contrat de prestataire (texte affiché et signé ; version CONTRAT_VERSION). */
export const CONTRAT = [
  ["Objet", "Cleaneroo met en relation des clients et des prestataires de nettoyage indépendants (« Cleaneurs »). Le Cleaneur réalise les prestations en son nom, comme professionnel indépendant (micro-entreprise ou société), sans lien de subordination avec Cleaneroo."],
  ["Missions", "Le Cleaneur choisit librement les missions qu'il prend ou propose, dans ses prestations, sa zone et ses formations validées. Une mission acceptée est un engagement envers le client."],
  ["Qualité", "Le Cleaneur respecte la charte qualité Cleaneroo : méthode, produits, sécurité, photos de preuve, ponctualité, discrétion et respect du logement et des consignes."],
  ["Prix et commission", "Le prix de chaque prestation est affiché avant l'acceptation. Cleaneroo perçoit une commission selon la formule du Cleaneur (Gratuit 20 %, Pro 12 %), calculée sur l'estimation de la réservation. Les pourboires reviennent à 100 % au Cleaneur."],
  ["Versements", "Les sommes dues au Cleaneur sont versées chaque vendredi pour les prestations validées jusqu'au mercredi minuit. Cleaneroo établit les factures au nom et pour le compte du Cleaneur (mandat de facturation)."],
  ["Annulation et fiabilité", "Annulation libre jusqu'à 24 h avant ; entre 24 h et 2 h : avertissement ; à moins de 2 h : avertissement et moins-value (30 % du prix, entre 20 et 60 €). Deux avertissements en 12 mois : suspension de 7 jours ; trois : examen de la résiliation par l'équipe. Une force majeure justifiée sous 72 h annule l'avertissement."],
  ["Assurance et obligations", "Le Cleaneur est assuré en responsabilité civile professionnelle pour les activités qu'il exerce, tient ses documents à jour (identité, SIRET, attestation URSSAF, RC Pro) et déclare son chiffre d'affaires."],
  ["Mission test", "Une première mission accompagnée et rémunérée (" + (REGLES.MISSION_TEST_C / 100) + " €, payée par Cleaneroo) vérifie la qualité avant l'activation complète."],
  ["Données et confidentialité", "Le Cleaneur garde confidentielles les informations des clients (adresse, codes, consignes) et ne les utilise que pour la mission. Sa position n'est partagée que pendant le trajet et l'arrivée."],
  ["Durée", "Le contrat est conclu sans durée ; chacun peut y mettre fin à tout moment, les missions déjà acceptées restant dues."],
];

/** Contrat : texte, signature au doigt (enregistrée avec la version et la date). */
export function blocContrat(boite, profil, apres = () => {}) {
  if (!boite) return;
  if (profil?.contrat_signe_le) {
    boite.innerHTML = `<p class="petit" style="color:var(--succes)">✅ ${tr("Contrat de prestataire signé le")} ${new Date(profil.contrat_signe_le).toLocaleDateString("fr-FR")} (${tr("version")} ${esc(profil.contrat_version || "")})</p>`;
    traduire(boite); return;
  }
  boite.innerHTML = `<details class="carte" style="margin:10px 0"><summary><b>📝 ${tr("Contrat de prestataire à signer")}</b></summary>
    <p class="petit">${tr("Version")} ${CONTRAT_VERSION}</p>
    ${CONTRAT.map(([t, x]) => `<p class="petit" style="margin:8px 0 0"><b>${tr(t)}.</b> ${tr(x)}</p>`).join("")}
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
