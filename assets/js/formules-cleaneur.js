// Formules des Cleaneurs (modèle économique du 7 novembre 2026) : Gratuit ou Pro, avantages et inconvénients,
// calcul « combien je touche », offre de lancement (3 mois de Pro offerts aux inscrits jusqu'au 31 janvier 2027). Même écran dans l'appli (FormulesCleaneur.kt).
import { REGLES, euros, dateLongue, revenuCleaneurC, seuilRentabiliteProC, finOffreLancement, joursOffreLancement } from "./regles.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { supabase } from "./donnees.js";

const pct = pb => `${pb / 100} %`;
/** Ligne d'avantage ou d'inconvénient : texte, ou [texte, montant, texte] (le montant ne se traduit pas). */
const ligne = x => (Array.isArray(x) ? `${tr(x[0])} ${x[1]} ${tr(x[2])}` : tr(x));

/** Contenu des deux formules : [id, nom, prix, commission, avantages, inconvénients]. */
export function formulesCleaneur() {
  const seuil = euros(seuilRentabiliteProC());
  return [
    ["gratuit", "Gratuit", tr("0 € par mois"), pct(REGLES.COMMISSION_GRATUIT_PB), [
      "Aucun abonnement, aucun engagement",
      "Idéal pour démarrer ou pour quelques missions par mois",
      "Paiement sécurisé et outils identiques à la formule Pro",
    ], [
      `Commission plus élevée : ${pct(REGLES.COMMISSION_GRATUIT_PB)} sur chaque mission`,
      "Missions des particuliers seulement",
      `Nouvelles missions visibles ${REGLES.PRIORITE_PRO_MIN} min après les Cleaneurs Pro`,
    ]],
    ["pro", "Pro", `${euros(REGLES.ABONNEMENT_CLEANEUR_C)} ${tr("par mois")}`, pct(REGLES.COMMISSION_PRO_PB), [
      `${(REGLES.COMMISSION_GRATUIT_PB - REGLES.COMMISSION_PRO_PB) / 100} points de commission en moins : vous gardez ${100 - REGLES.COMMISSION_PRO_PB / 100} % du prix`,
      "Toutes les missions : particuliers, conciergeries et entreprises",
      `${REGLES.PRIORITE_PRO_MIN} min d'avance sur chaque nouvelle mission`,
      "Badge Pro visible des clients",
      ["Rentabilisé dès", seuil, "de missions par mois"],
    ], [
      "Abonnement dû même en période de faible activité",
      ["Moins intéressant sous", seuil, "de missions par mois"],
    ]],
  ];
}

/** Offre de lancement pour ce compte : inscrit jusqu'au 31 janvier 2027 et 3 mois pas encore écoulés depuis la première mission. */
const proOffert = p => !!p && !!p.cree_le && new Date(p.cree_le) <= finOffreLancement()
  && (!p.pro_offert_jusqu || new Date(p.pro_offert_jusqu) > new Date());

/** Bloc complet : offre de lancement, deux cartes, calcul. p : profil du Cleaneur connecté (null = visiteur). */
export function blocFormulesCleaneur(p = null) {
  const offert = proOffert(p);
  const actuelle = p ? (p.role === "admin" || offert || p.formule_cleaneur === "pro" ? "pro" : "gratuit") : "";
  return `<div class="formules-cleaneur" id="formules-cleaneur">
    ${joursOffreLancement() > 0 || offert ? `<div class="offre-pro"><span class="badge-formule">${tr("Offre de lancement")}</span>
      <b>${REGLES.OFFRE_LANCEMENT_MOIS} ${tr("mois de formule Pro offerts à tous les Cleaneurs inscrits jusqu'au")} ${finOffreLancement().toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}</b>
      <span class="phrase-offre">${offert && p.pro_offert_jusqu ? `${tr("Votre formule Pro est offerte jusqu'au")} ${dateLongue(new Date(p.pro_offert_jusqu))}`
        : p ? tr("Votre formule Pro est offerte : les 3 mois commenceront à votre première mission") : tr("Inscrivez-vous : les 3 mois de Pro commencent à votre première mission")}</span>
      ${joursOffreLancement() > 0 ? `<span class="petit">${tr("Plus que")} ${joursOffreLancement()} ${tr("jours pour s'inscrire · sans limite de places")}</span>` : ""}</div>` : ""}
    <div class="cartes-formules">${formulesCleaneur().map(([id, nom, prix, com, plus, moins]) => `
      <div class="formule-cleaneur${id === "pro" ? " pro" : ""}${actuelle === id ? " actuelle" : ""}">
        ${id === "pro" ? `<span class="badge-formule">${tr("Badge Pro")}</span>` : ""}
        <b class="nom-formule">${tr(nom)}</b>
        <span class="prix-formule">${prix}</span>
        <span class="commission">${tr("Commission")} <b>${com}</b></span>
        <p class="titre-liste plus">${tr("Avantages")}</p><ul class="plus">${plus.map(x => `<li>${ligne(x)}</li>`).join("")}</ul>
        <p class="titre-liste moins">${tr("Inconvénients")}</p><ul class="moins">${moins.map(x => `<li>${ligne(x)}</li>`).join("")}</ul>
        ${p ? (actuelle === id ? `<span class="tampon">${tr("Votre formule")}</span>`
          : offert && id === "gratuit" ? "" : `<button type="button" class="bouton${id === "pro" ? "" : " secondaire"}" data-choisir-formule="${id}">${tr(id === "pro" ? "Passer en Pro" : "Passer en Gratuit")}</button>`) : ""}
      </div>`).join("")}</div>
    <div class="calcul-formules carte">
      <label class="champ">${tr("Vos missions par mois (chiffre d'affaires)")}<input type="range" min="100" max="4000" step="50" value="1000" data-ca></label>
      <p class="resultat-calcul" data-calcul></p>
    </div>
    ${p ? `<p class="petit">${tr("L'abonnement Pro sera prélevé chaque mois à l'ouverture des paiements en ligne ; d'ici là, rien n'est débité.")}</p>` : ""}
    <p class="erreur" data-erreur-formule></p>
  </div>`;
}

/** Calcul en direct, compteur de places et changement de formule. */
export function brancherFormulesCleaneur(racine, p = null, recharger = () => {}) {
  const bloc = racine.querySelector("#formules-cleaneur");
  if (!bloc) return;
  const offert = proOffert(p);
  const ca = bloc.querySelector("[data-ca]"), sortie = bloc.querySelector("[data-calcul]");
  const calculer = () => {
    const c = Number(ca.value) * 100;
    const g = revenuCleaneurC(c, "gratuit"), pr = revenuCleaneurC(c, "pro", false);
    // Le Cleaneur déclare à l'URSSAF le prix total des missions : les cotisations se calculent sur le chiffre d'affaires, pas sur le versé.
    const cot = Math.round(c * REGLES.URSSAF_SERVICES_PCT / 100);
    const apres = v => `<span class="ligne-apres petit">${tr("après cotisations URSSAF :")} <b>${euros(v - cot)}</b></span>`;
    sortie.innerHTML = `<span>${tr("Pour")} <b>${euros(c)}</b> ${tr("de missions par mois, vous percevez :")}</span>
      <span class="ligne-calcul"><span>${tr("Gratuit")}</span><b>${euros(g)}</b></span>${apres(g)}
      <span class="ligne-calcul${pr > g ? " meilleur" : ""}"><span>${tr("Pro (abonnement déduit)")}</span><b>${euros(pr)}</b></span>${apres(pr)}
      ${offert ? `<span class="ligne-calcul meilleur"><span>${tr("Pro offert")}</span><b>${euros(revenuCleaneurC(c, "pro", true))}</b></span>${apres(revenuCleaneurC(c, "pro", true))}` : ""}
      <span class="petit muet">${tr("Cotisations estimées à")} ${String(REGLES.URSSAF_SERVICES_PCT).replace(".", ",")} % ${tr("du chiffre d'affaires (micro-entreprise, sans ACRE). Montants avant frais de paiement Stripe : environ")} ${String(REGLES.FRAIS_STRIPE_PCT).replace(".", ",")} % + ${euros(REGLES.FRAIS_STRIPE_FIXE_C)} ${tr("par mission")}.</span>
      <span class="petit">${pr > g ? `${tr("Pro vous rapporte")} ${euros(pr - g)} ${tr("de plus par mois.")}` : tr("À ce niveau, la formule Gratuit vous convient mieux.")}</span>`;
  };
  ca.oninput = calculer; calculer();
  bloc.querySelectorAll("[data-choisir-formule]").forEach(b => b.onclick = async () => {
    const f = b.dataset.choisirFormule;
    if (!confirm(f === "pro" ? `${tr("Passer à la formule Pro ?")} ${tr("Commission de")} ${pct(REGLES.COMMISSION_PRO_PB)} ${tr("et toutes les missions ; l'abonnement sera prélevé à l'ouverture des paiements en ligne.")}`
      : `${tr("Passer à la formule Gratuit ?")} ${tr("Commission de")} ${pct(REGLES.COMMISSION_GRATUIT_PB)} ${tr("et missions des particuliers seulement.")}`)) return;
    b.disabled = true;
    const { data, error } = await supabase.rpc("choisir_formule", { f });
    if (error || data !== "ok") { b.disabled = false; bloc.querySelector("[data-erreur-formule]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
  traduire(bloc);
}
