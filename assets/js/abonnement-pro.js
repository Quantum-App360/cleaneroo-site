// Abonnement des conciergeries par tranche de logements (modèle économique du 7 novembre 2026) : tranche conseillée selon
// le nombre de biens, comparaison avec les 8 % de frais de service sans abonnement, 1er mois offert, choix de la tranche.
// Même écran dans l'appli (AbonnementPro.kt).
import { REGLES, euros, tranchePour, prixAbonnementProC, seuilAbonnementProC } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { supabase } from "./donnees.js";

const NOMS = { t1: "1 à 5 logements", t2: "6 à 15 logements", t3: "16 à 40 logements", t4: "41 à 100 logements", t5: "Grand compte · 101 à 300 logements", t6: "Grand compte · plus de 300 logements" };

/** Bloc « Mon abonnement » de l'Espace Pro. */
export function blocAbonnementPro(p, biens) {
  const n = Math.max(1, biens.length), conseillee = tranchePour(n), actuelle = p.abonnement_pro || "aucun";
  // Grille du 20/11/2026 : les tranches trop petites pour le parc sont masquées, les grands comptes n'apparaissent qu'à partir de 41 logements.
  const visibles = REGLES.ABONNEMENTS_PRO.filter(t => !t.grandCompte || n > 40 || t === conseillee);
  return `<div class="abonnement-pro" id="abonnement-pro">
    <div class="offre-pro"><span class="badge-formule">${tr("1er mois offert")}</span>
      <b>${tr("Abonnement conciergerie : 0 % de frais de service")}</b>
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
    <p class="petit">${tr("Prix hors taxes. L'abonnement sera prélevé chaque mois à l'ouverture des paiements en ligne, après le 1er mois offert ; d'ici là, rien n'est débité.")}</p>
    <p class="erreur" data-erreur-abonnement></p>
  </div>`;
}

export function brancherAbonnementPro(racine, recharger = () => {}) {
  const bloc = racine.querySelector("#abonnement-pro");
  if (!bloc) return;
  bloc.querySelectorAll("[data-tranche]").forEach(b => b.onclick = async () => {
    const t = b.dataset.tranche;
    if (!confirm(tr(t === "aucun" ? "Arrêter l'abonnement ? Chaque intervention comptera 8 % de frais de service." : "Choisir cet abonnement ? Le 1er mois est offert ; rien n'est débité avant l'ouverture des paiements en ligne."))) return;
    b.disabled = true;
    const { data, error } = await supabase.rpc("choisir_abonnement_pro", { t });
    if (error || data !== "ok") { b.disabled = false; bloc.querySelector("[data-erreur-abonnement]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
  traduire(bloc);
}
