// Formules des Cleaneurs (modèle économique du 7 novembre 2026) : Gratuit ou Pro, avantages et inconvénients,
// calcul « combien je touche », offre de lancement (Pro offert 12 mois aux 500 premiers). Même écran dans l'appli (FormulesCleaneur.kt).
import { REGLES, euros, dateLongue, revenuCleaneurC, seuilRentabiliteProC } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { supabase, placesRestantes } from "./donnees.js";

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
      "Paiement sécurisé et assurance comme en Pro",
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
      "Abonnement à payer même les mois calmes",
      ["Moins intéressant sous", seuil, "de missions par mois"],
    ]],
  ];
}

/** Bloc complet : offre de lancement, deux cartes, calcul. p : profil du Cleaneur connecté (null = visiteur). */
export function blocFormulesCleaneur(p = null) {
  const offert = p?.pro_offert_jusqu && new Date(p.pro_offert_jusqu) > new Date();
  const actuelle = p ? (p.role === "admin" || offert || p.formule_cleaneur === "pro" ? "pro" : "gratuit") : "";
  return `<div class="formules-cleaneur" id="formules-cleaneur">
    <div class="offre-pro"><span class="badge-formule">${tr("Offre de lancement")}</span>
      <b>${tr("Formule Pro offerte")} ${REGLES.OFFRE_LANCEMENT_MOIS} ${tr("mois aux")} ${REGLES.OFFRE_LANCEMENT_PLACES} ${tr("premiers Cleaneurs")}</b>
      <span class="petit" data-places-formules></span>
      ${offert ? `<span class="tampon vert">${tr("Votre formule Pro est offerte jusqu'au")} ${dateLongue(new Date(p.pro_offert_jusqu))}</span>` : ""}</div>
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
  const offert = p?.pro_offert_jusqu && new Date(p.pro_offert_jusqu) > new Date();
  const ca = bloc.querySelector("[data-ca]"), sortie = bloc.querySelector("[data-calcul]");
  const calculer = () => {
    const c = Number(ca.value) * 100;
    const g = revenuCleaneurC(c, "gratuit"), pr = revenuCleaneurC(c, "pro", false);
    sortie.innerHTML = `<span>${tr("Pour")} <b>${euros(c)}</b> ${tr("de missions par mois, vous touchez :")}</span>
      <span class="ligne-calcul"><span>${tr("Gratuit")}</span><b>${euros(g)}</b></span>
      <span class="ligne-calcul${pr > g ? " meilleur" : ""}"><span>${tr("Pro (abonnement déduit)")}</span><b>${euros(pr)}</b></span>
      ${offert ? `<span class="ligne-calcul meilleur"><span>${tr("Pro offert")}</span><b>${euros(revenuCleaneurC(c, "pro", true))}</b></span>` : ""}
      <span class="petit">${pr > g ? `${tr("Pro vous rapporte")} ${euros(pr - g)} ${tr("de plus par mois.")}` : tr("À ce niveau, la formule Gratuit vous convient mieux.")}</span>`;
  };
  ca.oninput = calculer; calculer();
  placesRestantes().then(n => { const e = bloc.querySelector("[data-places-formules]"); if (e && n != null) e.textContent = `${n} ${tr("places restantes sur")} ${REGLES.OFFRE_LANCEMENT_PLACES}`; });
  bloc.querySelectorAll("[data-choisir-formule]").forEach(b => b.onclick = async () => {
    const f = b.dataset.choisirFormule;
    if (!confirm(tr(f === "pro" ? "Passer à la formule Pro ? Commission de 12 % et toutes les missions ; l'abonnement sera prélevé à l'ouverture des paiements en ligne." : "Passer à la formule Gratuit ? Commission de 20 % et missions des particuliers seulement."))) return;
    b.disabled = true;
    const { data, error } = await supabase.rpc("choisir_formule", { f });
    if (error || data !== "ok") { b.disabled = false; bloc.querySelector("[data-erreur-formule]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    recharger();
  });
  traduire(bloc);
}
