// Abonnement des conciergeries par tranche de logements (modèle économique du 7 novembre 2026) : tranche conseillée selon
// le nombre de biens, comparaison avec les 8 % de frais de service sans abonnement, 1er mois offert, choix de la tranche.
// Même écran dans l'appli (AbonnementPro.kt).
import { REGLES, euros, tranchePour, prixAbonnementProC, seuilAbonnementProC } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { supabase } from "./donnees.js";

const NOMS = { t1: "1 à 5 logements", t2: "6 à 15 logements", t3: "16 à 40 logements", t4: "41 logements et plus" };

/** Bloc « Mon abonnement » de l'Espace Pro. */
export function blocAbonnementPro(p, biens) {
  const n = Math.max(1, biens.length), conseillee = tranchePour(n), actuelle = p.abonnement_pro || "aucun";
  const surDevis = n > REGLES.ABONNEMENT_PRO_SUR_DEVIS_LOGEMENTS;
  return `<div class="abonnement-pro" id="abonnement-pro">
    <div class="offre-pro"><span class="badge-formule">${tr("1er mois offert")}</span>
      <b>${tr("Abonnement conciergerie : 0 % de frais de service")}</b>
      <span class="petit">${tr("Sans abonnement, chaque intervention compte")} ${REGLES.FRAIS_SERVICE_PRO_PCT} % ${tr("de frais de service.")}</span></div>
    <div class="tranches">${REGLES.ABONNEMENTS_PRO.map(t => {
      const prix = prixAbonnementProC(t, n), choisie = actuelle === t.id;
      return `<div class="tranche${t.id === conseillee?.id ? " conseillee" : ""}${choisie ? " actuelle" : ""}">
        ${t.id === conseillee?.id ? `<span class="badge-formule">${biens.length > 1 ? `${tr("Conseillée pour vos")} ${biens.length} ${tr("biens")}` : tr("Conseillée pour votre bien")}</span>` : ""}
        <b class="nom-formule">${tr(NOMS[t.id])}</b>
        <span class="prix-formule">${t.parLogementC ? `${euros(t.parLogementC)} <small>${tr("HT par logement / mois")}</small>` : `${euros(t.prixC)} <small>${tr("HT / mois")}</small>`}</span>
        ${!t.parLogementC ? `<span class="petit">${tr("soit de")} ${euros(Math.round(t.prixC / t.max))} ${tr("à")} ${euros(Math.round(t.prixC / (REGLES.ABONNEMENTS_PRO[REGLES.ABONNEMENTS_PRO.indexOf(t) - 1]?.max + 1 || 1)))} ${tr("par logement")}</span>` : `<span class="petit">${tr("Sur devis au-delà de")} ${REGLES.ABONNEMENT_PRO_SUR_DEVIS_LOGEMENTS} ${tr("logements")}</span>`}
        <ul class="plus">${t.inclus.map(x => `<li>${tr(x)}</li>`).join("")}</ul>
        ${choisie ? `<span class="tampon">${tr("Votre abonnement")}</span>`
          : biens.length > t.max ? `<span class="petit trop-petit">${tr("Trop petite pour vos")} ${biens.length} ${tr("biens")}</span>`
          : `<button type="button" class="bouton${t.id === conseillee?.id ? "" : " secondaire"}" data-tranche="${t.id}">${tr("Choisir")}</button>`}
        <span class="petit rentable">${tr("Rentable dès")} ${euros(seuilAbonnementProC(t, n))} ${tr("de ménages par mois")}${t.parLogementC ? ` (${Math.max(41, n)} ${tr("logements")})` : ""}</span>
      </div>`; }).join("")}</div>
    ${surDevis ? `<p class="note">${tr("Plus de 100 logements : contactez-nous pour un devis.")}</p>` : ""}
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
