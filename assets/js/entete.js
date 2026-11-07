// En-tête du site : liens adaptés au visiteur ou au type de compte (Particulier, Pro, Cleaneur, administration),
// un seul bouton de compte une fois connecté. Même organisation que le menu de l'application.
// Le dernier profil connu est gardé sur l'appareil : l'en-tête s'affiche tout de suite, sans clignoter.
import { tr, traduire } from "./langue.js";

const CLE = "cleaneroo-moi";
/** Pages fixes (villes, calculateur…) : les liens repartent vers l'accueil du site. */
const base = () => (/^\/(index\.html)?$/.test(location.pathname) ? "" : "/");

export function profilMemorise() {
  try { return JSON.parse(localStorage.getItem(CLE) || "null"); } catch { return null; }
}
export function memoriserProfil(p) {
  try {
    if (p) localStorage.setItem(CLE, JSON.stringify({ prenom: p.prenom || "", role: p.role || "client", espace: p.espace || "particulier", statuts: p.statuts || [], abonnePro: !!p.abonnement_pro && p.abonnement_pro !== "aucun" }));
    else localStorage.removeItem(CLE);
  } catch { /* navigation privée */ }
}

/** Type d'espace d'un profil : "visiteur", "particulier", "pro", "cleaneur" ou "admin". */
export function typeEspace(p) {
  if (!p) return "visiteur";
  if (p.role === "admin") return "admin";
  return ["particulier", "pro", "cleaneur"].includes(p.espace) ? p.espace : "particulier";
}

const LIENS = {
  visiteur: [["#/prestations", "Prestations"], ["#/reserver", "Estimer mon prix"], ["#/comment-ca-marche", "Comment ça marche"], ["#/devenir-cleaneur", "Devenir Cleaneur"]],
  // L'essentiel, selon l'espace ouvert ; on change d'espace depuis le bouton du compte (à droite).
  particulier: [["#/", "Accueil"], ["#/mes-demandes", "Mes demandes"], ["#/mes-biens", "Mes biens"]],
  pro: [["#/compte/pro", "Agenda"], ["#/mes-demandes", "Mes demandes"], ["#/mes-biens", "Mes biens"]],
  cleaneur: [["#/compte/cleaneur", "Mes missions"], ["#/comment-ca-marche", "Comment ça marche"]],
  admin: [["gestion.html", "Tableau de bord"], ["#/compte/cleaneur", "Missions"], ["#/mes-demandes", "Mes demandes"], ["#/mes-biens", "Mes biens"]],
};
const NOM_ESPACE = { particulier: "Espace Particulier", pro: "Espace Pro", cleaneur: "Espace Cleaneur", admin: "Administration" };

/** Remplit la navigation et les actions de l'en-tête pour ce profil (null = visiteur). */
export function rendreEntete(p) {
  const nav = document.querySelector(".entete .nav"), actions = document.querySelector(".entete .actions-compte");
  if (!nav || !actions) return;
  const type = typeEspace(p), b = base();
  const lien = ([href, nom]) => `<a href="${href.startsWith("#") ? b + href : (b ? "/" : "") + href}">${nom}</a>`;
  const initiale = (p?.prenom || "?").trim().charAt(0).toUpperCase() || "?";
  const html = type === "visiteur"
    ? `<a class="lien-connexion" href="${b}#/compte">Se connecter</a><a class="bouton bouton-entete" href="${b}#/compte/creer">Créer mon espace</a>`
    : `${["particulier", "pro"].includes(type) ? `<a class="bouton bouton-entete" href="${b}#/reserver${type === "pro" ? "/rental" : ""}">Réserver</a>` : ""}
       <a class="puce-compte" href="${b}#/compte" title="${tr("Mon compte")}"><span class="avatar">${initiale}</span><span class="qui"><b>${p.prenom || tr("Mon compte")}</b><small>${NOM_ESPACE[type]}</small></span></a>`;
  actions.innerHTML = html;
  // Téléphone : le panneau du menu reprend les liens puis le compte.
  // Plusieurs statuts (ex. Cleaneur et Particulier) : un lien direct vers chaque autre espace.
  const autres = type === "admin" || type === "visiteur" ? [] : (p.statuts || []).filter(x => x !== type && NOM_ESPACE[x]).map(x => [`#/compte/${x}`, NOM_ESPACE[x]]);
  nav.innerHTML = [...LIENS[type], ...autres].map(lien).join("") + `<div class="nav-compte">${html}</div>`;
  document.body.dataset.espace = type;
  document.body.classList.toggle("acces-cleaneur", type === "cleaneur");
  traduire(nav); traduire(actions);
  marquerActif();
}

/** Lien de la page en cours mis en valeur. */
export function marquerActif() {
  const ici = location.hash.split("/").slice(0, 3).join("/") || "#/";
  document.querySelectorAll(".entete .nav a").forEach(a => {
    const h = a.getAttribute("href").replace(/^\//, "");
    a.classList.toggle("actif", h === ici || (h.length > 2 && ici.startsWith(h)));
  });
}

/** Menu des téléphones : ouvre / ferme le panneau (navigation et compte). */
export function brancherBurger() {
  const burger = document.querySelector(".entete .burger"), entete = document.querySelector(".entete");
  if (!burger || burger.dataset.branche) return;
  burger.dataset.branche = "1";
  burger.addEventListener("click", () => {
    const ouvert = entete.classList.toggle("menu-ouvert");
    burger.setAttribute("aria-expanded", String(ouvert));
    document.body.classList.toggle("sans-defilement", ouvert);
  });
  entete.addEventListener("click", e => {
    if (e.target.closest(".nav a, .actions-compte a")) { entete.classList.remove("menu-ouvert"); burger.setAttribute("aria-expanded", "false"); document.body.classList.remove("sans-defilement"); }
  });
}

// Premier affichage : le dernier profil connu (corrigé dès que le compte est relu).
rendreEntete(profilMemorise());
brancherBurger();
addEventListener("hashchange", marquerActif);
