// Page de référence du design system Cleaneroo (#/design-system), prompt 4, lot 1 (24/11/2026).
// Montre chaque jeton et chaque composant, dans l'univers client (clair, bleu) et l'univers Cleaneur (sombre, vert).
// Page interne, comme #/icones : en français seulement, non liée dans les menus.
import { icone } from "./icones.js";
import { blocEtat, blocSquelette, afficherToast } from "./commun.js";

const COULEURS = [["--marque", "Marque"], ["--primaire", "Primaire (textes, liens)"], ["--marque-clair", "Marque claire"], ["--corail", "Corail (accent)"],
  ["--fond", "Fond"], ["--surface", "Surface"], ["--creux", "Creux"], ["--texte", "Texte"], ["--texte2", "Texte secondaire"], ["--texte3", "Texte discret"],
  ["--succes", "Succès"], ["--alerte", "Alerte"], ["--erreur", "Erreur"], ["--info", "Information"]];
const DEGRADES = [["--degrade", "Dégradé de l'univers"], ["--degrade-corail", "Dégradé corail"]];
const TAILLES = [["--t-3xl", "Titre de page"], ["--t-2xl", "Titre de section"], ["--t-xl", "Sous-titre"], ["--t-l", "Titre de carte"], ["--t-base", "Texte courant"], ["--t-m", "Texte d'interface"], ["--t-s", "Petit texte"], ["--t-xs", "Badge, mention"]];
const ESPACES = ["--esp-1", "--esp-2", "--esp-3", "--esp-4", "--esp-5", "--esp-6", "--esp-7", "--esp-8"];

const univers = (theme, titre) => `<section class="ds-univers ${theme}">
  <h2>${titre}</h2>
  <h3>Couleurs</h3>
  <div class="ds-nuancier">${COULEURS.map(([v, n]) => `<div class="ds-nuance"><i style="background:var(${v})"></i><b>${n}</b><code>${v}</code></div>`).join("")}</div>
  <div class="ds-nuancier">${DEGRADES.map(([v, n]) => `<div class="ds-nuance large"><i style="background:var(${v})"></i><b>${n}</b><code>${v}</code></div>`).join("")}</div>
  <h3>Boutons</h3>
  <div class="ds-ligne"><button class="bouton" type="button">Principal</button><button class="bouton plein" type="button">Plein</button>
    <button class="bouton secondaire" type="button">Secondaire</button><button class="bouton corail" type="button">${icone("telephone")} Être rappelé</button>
    <button class="bouton danger" type="button">Danger</button><button class="bouton" type="button" disabled>Indisponible</button></div>
  <h3>Badges</h3>
  <div class="ds-ligne"><span class="badge">Neutre</span><span class="badge marque">${icone("bouclier-coche")} Vérifié</span><span class="badge succes">${icone("valide")} Confirmée</span>
    <span class="badge alerte">${icone("horloge")} À valider</span><span class="badge erreur">${icone("alerte")} Annulée</span><span class="badge info">En route</span></div>
  <h3>Champs</h3>
  <div class="ds-grille"><label class="champ">Prénom<input value="Marie"></label><label class="champ">Prestation<select><option>Ménage du logement</option></select></label>
    <label class="case"><input type="checkbox" checked><span>Photos avant exigées</span></label></div>
  <h3>Cartes</h3>
  <div class="ds-grille"><div class="carte"><h3>Carte</h3><p class="muet">Surface, rayon de 22 px, ombre douce.</p></div>
    <div class="carte teintee"><h3>Carte teintée</h3><p class="muet">Pour une information à mettre en avant.</p></div></div>
  <h3>États</h3>
  <div class="ds-grille">${blocEtat({ icone: "calendrier", titre: "Aucune prestation prévue", texte: "Réservez en deux minutes : le prix s'affiche tout de suite.", action: { libelle: "Réserver", href: "#/reserver" }, compact: true })}
    ${blocEtat({ icone: "alerte", titre: "Chargement impossible", texte: "Vérifiez votre connexion, puis réessayez.", action: `<button class="bouton secondaire" type="button">Réessayer</button>`, erreur: true, compact: true })}</div>
  <h3>Chargement</h3>
  <div class="ds-grille">${blocSquelette(2)}</div>
</section>`;

export function pageDesignSystem() {
  return `<section class="bloc"><div class="conteneur ds">
    <h1>Design system Cleaneroo</h1>
    <p class="muet">Une seule source de vérité pour les couleurs, la typographie, les espacements et les composants. Couleurs de la marque inchangées ; deux univers, une identité.</p>
    <h3>Typographie · Plus Jakarta Sans</h3>
    <div class="ds-typo">${TAILLES.map(([v, n]) => `<p style="font-size:var(${v});margin:0"><b>${n}</b> <code>${v}</code></p>`).join("")}</div>
    <h3>Espacements · rayons · ombres</h3>
    <div class="ds-ligne">${ESPACES.map(v => `<span class="ds-espace" style="width:var(${v})" title="${v}"></span>`).join("")}</div>
    <div class="ds-ligne">${["--rayon-s", "--rayon", "--rayon-l", "--rayon-xl"].map(v => `<span class="ds-rayon" style="border-radius:var(${v})"><code>${v}</code></span>`).join("")}</div>
    <div class="ds-ligne">${["--ombre", "--ombre-relief", "--ombre-forte"].map(v => `<span class="ds-ombre" style="box-shadow:var(${v})"><code>${v}</code></span>`).join("")}</div>
    <h3>Messages flottants</h3>
    <div class="ds-ligne"><button class="bouton secondaire" type="button" data-toast="succes">Succès</button><button class="bouton secondaire" type="button" data-toast="erreur">Erreur</button><button class="bouton secondaire" type="button" data-toast="info">Information</button></div>
    <p><a href="#/icones">Voir les ${"icônes"} ›</a></p>
    <div class="ds-deux">${univers("", "Univers client")}${univers("theme-cleaneur", "Univers Cleaneur")}</div>
  </div></section>`;
}

export function brancherDesignSystem(vue) {
  vue.querySelectorAll("[data-toast]").forEach(b => b.onclick = () => afficherToast(
    { succes: "Réservation confirmée.", erreur: "Le paiement n'a pas abouti. Aucun montant n'a été débité.", info: "Votre Cleaneur est en route." }[b.dataset.toast], b.dataset.toast));
}
