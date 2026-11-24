// Abonnement des conciergeries par tranche de logements (modèle économique du 7 novembre 2026) : tranche conseillée selon
// le nombre de biens, comparaison avec les 8 % de frais de service sans abonnement, choix de la tranche.
// Offre « Conciergerie fondatrice » (24/11/2026, remplace « 1er mois offert ») : règles dans regles.js (etatOffreConciergerie).
// Même écran dans l'appli (AbonnementPro.kt).
import { REGLES, euros, tranchePour, prixAbonnementProC, seuilAbonnementProC, etatOffreConciergerie, offreConciergerieOuverte, finInscriptionOffreConciergerie } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { supabase } from "./donnees.js";

const NOMS = { t1: "1 à 5 logements", t2: "6 à 15 logements", t3: "16 à 40 logements", t4: "41 à 100 logements", t5: "Grand compte · 101 à 300 logements", t6: "Grand compte · plus de 300 logements" };

const dateFr = d => new Date(d).toLocaleDateString(LOCALE, { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
/** Texte de présentation de l'offre (Espace Conciergerie, « Mon abonnement », accueil) tant que les inscriptions sont ouvertes. */
export const texteOffreConciergerie = () => `${tr("Offre Conciergerie fondatrice : 3 mois offerts dès votre première intervention, 0 % de frais de service.")} ${tr("Inscription jusqu'au")} ${dateFr(finInscriptionOffreConciergerie())}.`;
export const texteBonusOffreConciergerie = () => tr("+1 mois si 3 de vos Cleaneurs nous rejoignent");

/** Encart de l'offre « Conciergerie fondatrice » selon son état (null : rien à afficher). */
export function blocOffreConciergerie(p, n = 1) {
  const e = etatOffreConciergerie({ inscritLe: "pro" === p.espace || (p.statuts || []).includes("pro") ? p.cree_le : null,
    debut: p.offre_conciergerie_debut, cleaneursBonus: p.offre_cleaneurs_bonus || 0, choix: p.offre_conciergerie_choix || "" });
  const fin = p.offre_conciergerie_fin ? new Date(p.offre_conciergerie_fin) : e.fin;
  const compteur = `<span class="petit">${icone("cleaneurs")} ${e.bonusCompte} ${tr("sur")} ${e.bonusObjectif} ${tr("Cleaneurs pour le mois offert")}</span>`;
  const inviter = `<a class="bouton petit secondaire" href="#form-invitation" data-inviter-cleaneurs>${tr("Inviter mes Cleaneurs")}</a>`;
  if (e.statut === "non_eligible") return "";
  if (e.statut === "avant") return `<div class="offre-pro offre-fondatrice"><span class="badge-formule">${tr("Offre Conciergerie fondatrice")}</span>
      <b>${tr("3 mois offerts dès votre première intervention, 0 % de frais de service.")}</b>
      <span class="petit">${tr("Vos 3 mois offerts démarreront à votre première intervention terminée.")}</span>
      <span class="petit">${texteBonusOffreConciergerie()}</span>${compteur}${inviter}</div>`;
  const jours = Math.max(0, Math.ceil((fin - new Date()) / 864e5));
  if (fin > new Date()) {
    const t = tranchePour(n), prix = t ? prixAbonnementProC(t, n) : 0;
    return `<div class="offre-pro offre-fondatrice"><span class="badge-formule">${tr("Offre Conciergerie fondatrice")}</span>
      <b>${tr("Offre en cours : il vous reste")} ${jours} ${tr(jours > 1 ? "jours" : "jour")} (${tr("jusqu'au")} ${dateFr(fin)})</b>
      <span class="petit">${tr("Abonnement de votre tranche offert et 0 % de frais de service. Prix garanti 12 mois après la fin de l'offre.")}</span>
      ${e.bonus ? `<span class="petit">${icone("termine")} ${tr("Mois offert gagné : 3 de vos Cleaneurs nous ont rejoints.")}</span>` : `<span class="petit">${texteBonusOffreConciergerie()}</span>${compteur}${inviter}`}
      ${jours <= REGLES.OFFRE_CONCIERGERIE_RAPPELS_JOURS[0] && t ? choixFinOffre(p, t, prix) : ""}</div>`;
  }
  // Période terminée : sans accord explicite, aucun prélèvement (sans abonnement, 8 %).
  if (p.offre_conciergerie_choix === "continuer") return "";
  return `<div class="offre-pro offre-fondatrice"><b>${tr("Votre offre Conciergerie fondatrice est terminée.")}</b>
    <span class="petit">${tr("Vous êtes sans abonnement :")} ${REGLES.FRAIS_SERVICE_PRO_PCT} % ${tr("de frais de service par intervention. Rien n'a été prélevé.")}</span></div>`;
}
function choixFinOffre(p, t, prix) {
  const choisi = p.offre_conciergerie_choix;
  return `<div class="choix-fin-offre"><span class="petit"><b>${tr("Et après l'offre ?")}</b> ${tr("Aucun prélèvement sans votre accord. Sans réponse, vous passez sans abonnement")} (${REGLES.FRAIS_SERVICE_PRO_PCT} % ${tr("de frais de service")}).</span>
    <div class="boutons"><button type="button" class="bouton petit${choisi === "continuer" ? "" : " secondaire"}" data-suite-offre="continuer" data-tranche-offre="${t.id}">${tr("Continuer avec l'abonnement")} (${tr(NOMS[t.id])}, ${euros(prix)} ${tr("HT par mois")})</button>
      <button type="button" class="bouton petit${choisi === "arreter" ? "" : " secondaire"}" data-suite-offre="arreter">${tr("Ne pas continuer")}</button></div>
    ${choisi ? `<span class="petit">${icone("termine")} ${tr(choisi === "continuer" ? "Choix enregistré : vous continuez avec l'abonnement après l'offre." : "Choix enregistré : sans abonnement après l'offre.")}</span>` : ""}</div>`;
}

/** Bloc « Mon abonnement » de l'Espace Pro. */
export function blocAbonnementPro(p, biens) {
  const n = Math.max(1, biens.length), conseillee = tranchePour(n), actuelle = p.abonnement_pro || "aucun";
  // Grille du 20/11/2026 : les tranches trop petites pour le parc sont masquées, les grands comptes n'apparaissent qu'à partir de 41 logements.
  const visibles = REGLES.ABONNEMENTS_PRO.filter(t => !t.grandCompte || n > 40 || t === conseillee);
  return `<div class="abonnement-pro" id="abonnement-pro">
    ${blocOffreConciergerie(p, n)}
    <div class="offre-pro"><b>${tr("Abonnement conciergerie : 0 % de frais de service")}</b>
      <span class="petit">${tr("Sans abonnement, chaque intervention compte")} ${REGLES.FRAIS_SERVICE_PRO_PCT} % ${tr("de frais de service.")}</span>
      <span class="petit"><b>${tr("Vous ne pouvez pas perdre :")}</b> ${tr("chaque mois, l'abonnement est plafonné à ce qu'auraient coûté les")} ${REGLES.FRAIS_SERVICE_PRO_PCT} % ${tr("de frais de service. En basse saison, vous payez moins.")}</span>
      <span class="petit">${tr("Engagement annuel :")} ${REGLES.ABONNEMENT_ANNUEL_MOIS_OFFERTS} ${tr("mois offerts.")}</span></div>
    <div class="tranches">${visibles.map(t => {
      const prix = prixAbonnementProC(t, n), choisie = actuelle === t.id;
      return `<div class="tranche${t.id === conseillee?.id ? " conseillee" : ""}${choisie ? " actuelle" : ""}">
        ${t.id === conseillee?.id ? `<span class="badge-formule">${biens.length > 1 ? `${tr("Conseillée pour vos")} ${biens.length} ${tr("biens")}` : tr("Conseillée pour votre bien")}</span>` : ""}
        <b class="nom-formule">${tr(NOMS[t.id])}</b>
        <span class="prix-formule">${euros(t.prixC)} <small>${tr("HT / mois")}</small></span>
        ${t.parLogementC ? `<span class="petit">+ ${euros(t.parLogementC)} ${tr("par logement au-delà de")} ${t.debut}${n > t.debut && n <= t.max ? ` · ${tr("pour vos")} ${n} ${tr("logements :")} <b>${euros(prix)} ${tr("HT / mois")}</b> (${euros(Math.round(prix / n))} ${tr("par logement")})` : ""}</span>`
          : `<span class="petit">${tr("soit de")} ${euros(Math.round(t.prixC / t.max))} ${tr("à")} ${euros(Math.round(t.prixC / (REGLES.ABONNEMENTS_PRO[REGLES.ABONNEMENTS_PRO.indexOf(t) - 1]?.max + 1 || 1)))} ${tr("par logement")}</span>`}
        ${t.grandCompte ? `<span class="petit">${tr("Essai gratuit")} ${REGLES.ESSAI_GRAND_COMPTE_JOURS} ${tr("jours sur")} ${REGLES.ESSAI_GRAND_COMPTE_LOGEMENTS} ${tr("de vos logements.")}</span>` : ""}
        <ul class="plus">${t.inclus.map(x => `<li>${tr(x)}</li>`).join("")}</ul>
        ${choisie ? `<span class="tampon">${tr("Votre abonnement")}</span>`
          : biens.length > t.max ? `<span class="petit trop-petit">${tr("Trop petite pour vos")} ${biens.length} ${tr("biens")}</span>`
          : `<button type="button" class="bouton${t.id === conseillee?.id ? "" : " secondaire"}" data-tranche="${t.id}">${tr("Choisir")}</button>`}
        <span class="petit rentable">${tr("Plein tarif dès")} ${euros(seuilAbonnementProC(t, Math.max(n, (t.debut || 0) + 1)))} ${tr("de ménages par mois ; en dessous, plafonné à 8 %")}</span>
      </div>`; }).join("")}</div>
    ${n > 40 ? `<p class="note">${tr("Plus de 40 logements ? Importez-les tous en une fois depuis un tableau ou votre logiciel de gestion :")} <a href="#/importer-biens">${tr("Importer mes logements")}</a></p>` : ""}
    ${actuelle !== "aucun" ? `<p><button type="button" class="lien-bouton" data-tranche="aucun">${tr("Arrêter l'abonnement (8 % de frais de service par intervention)")}</button></p>` : ""}
    <p class="petit">${tr("Prix hors taxes. Aucun prélèvement sans votre accord explicite ; d'ici l'ouverture des paiements en ligne, rien n'est débité.")}</p>
    <p class="erreur" data-erreur-abonnement></p>
  </div>`;
}

export function brancherAbonnementPro(racine, recharger = () => {}) {
  const bloc = racine.querySelector("#abonnement-pro");
  if (!bloc) return;
  bloc.querySelectorAll("[data-tranche]").forEach(b => b.onclick = async () => {
    const t = b.dataset.tranche;
    if (!confirm(tr(t === "aucun" ? "Arrêter l'abonnement ? Chaque intervention comptera 8 % de frais de service." : "Choisir cet abonnement ? Rien n'est débité avant l'ouverture des paiements en ligne."))) return;
    b.disabled = true;
    const { data, error } = await supabase.rpc("choisir_abonnement_pro", { t });
    if (error || data !== "ok") { b.disabled = false; bloc.querySelector("[data-erreur-abonnement]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
  bloc.querySelectorAll("[data-suite-offre]").forEach(b => b.onclick = async () => {
    const choix = b.dataset.suiteOffre;
    if (choix === "continuer" && !confirm(tr("Continuer avec l'abonnement à la fin de l'offre ? Il ne sera prélevé qu'à partir de cette date."))) return;
    b.disabled = true;
    const { data, error } = await supabase.rpc("choisir_suite_offre", { p_choix: choix, p_tranche: b.dataset.trancheOffre || null });
    if (error || data !== "ok") { b.disabled = false; bloc.querySelector("[data-erreur-abonnement]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
  bloc.querySelectorAll("[data-inviter-cleaneurs]").forEach(a => a.onclick = e => {
    const f = document.getElementById("form-invitation");
    if (f) { e.preventDefault(); f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector("input")?.focus(); }
  });
  traduire(bloc);
}
