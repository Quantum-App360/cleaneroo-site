// En cas de dommage (20 novembre 2026) : Cleaneroo n'est pas assureur et n'indemnise pas ; l'assurance de la partie concernée
// prend en charge (RC Pro du Cleaneur, assurance habitation ou multirisque du client). Cleaneroo réunit les preuves de la mission
// et prépare un dossier PDF prêt à envoyer à l'assureur (bouton sur la prestation, après une déclaration de dommage). Route #/garantie.
import { tr, traduire } from "./langue.js";
import { REGLES } from "./regles.js";

export function pageGarantie(vue) {
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    <span class="surtitre">${tr("Sérénité")}</span><h1>${tr("En cas de souci ou de dommage")}</h1><div class="trait-corail"></div>
    <div class="carte"><h3 style="margin-top:0">${tr("1. Un problème de qualité")}</h3>
      <p>${tr("Avant de valider, demandez une reprise au Cleaneur. Vous pouvez aussi signaler le problème depuis la prestation : rien n'est versé au Cleaneur tant que le signalement est examiné.")}</p></div>
    <div class="carte"><h3 style="margin-top:0">${tr("2. Une casse ou un dommage")}</h3>
      <p>${tr(`Déclarez-le depuis la prestation dans les ${REGLES.GARANTIE_DECLARATION_H} h, avec des photos. Le dommage est pris en charge par l'assurance concernée :`)}</p>
      <ul><li>${tr("l'assurance responsabilité civile professionnelle du Cleaneur (obligatoire et vérifiée avant toute mission) s'il a causé le dommage ;")}</li>
        <li>${tr("votre assurance habitation ou multirisque dans les autres cas.")}</li></ul></div>
    <div class="carte teintee"><h3 style="margin-top:0">${tr("3. Votre dossier est prêt")}</h3>
      <p>${tr("Cleaneroo réunit tout ce qui a été enregistré pendant la mission : photos avant et après horodatées, compte rendu, signatures, échanges et coordonnées des parties. Vous téléchargez un dossier PDF prêt à envoyer à l'assureur, sans rien rassembler vous-même.")}</p></div>
    <p class="petit muet">${tr("Cleaneroo est une plateforme de mise en relation : elle n'est pas assureur et ne verse pas d'indemnité. Elle facilite la déclaration en fournissant les preuves.")}</p>
    <p><a class="bouton" href="#/mes-demandes">${tr("Mes prestations")}</a> <a class="bouton secondaire" href="#/aide/probleme">${tr("Assistant Cleaneroo")}</a></p>
  </div></section>`;
  traduire(vue);
}
