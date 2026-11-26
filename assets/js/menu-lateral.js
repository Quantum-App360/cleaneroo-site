// Menu latéral des espaces connectés (26/11/2026, retours de Michael) : sur ordinateur, toute la navigation de l'espace
// est à gauche, au même endroit, et la page en cours y est surlignée. Trois niveaux bien distincts : le menu pour se déplacer,
// les onglets et les cartes pour s'organiser dans la page, les boutons pour agir. Sous 1100 px, le menu du haut (burger) reprend la main.
// Côté Cleaneur, les rubriques de l'espace (Aujourd'hui, Missions, Gains, Profil) sont pilotées depuis ce menu.
import { tr, traduire } from "./langue.js";
import { icone } from "./icones.js";

const CLE_SOUS = "cleaneroo-sous-onglet-cleaneur";

/** Entrées du menu selon l'espace : [lien, libellé, icône, rubrique de l'espace Cleaneur]. */
export function entreesMenu(type) {
  const communs = [["#/messages", "Messages", "message"], ["#/favoris", "Mes favoris", "coeur"]];
  switch (type) {
    case "particulier": return [["#/tableau", "Accueil", "logement"], ["#/reserver", "Réserver", "ajouter"], ["#/mes-demandes", "Mes prestations", "calendrier"],
      ...communs, ["#/mes-biens", "Mes biens", "cle"], ["#/compte/particulier", "Mon compte", "equipe"]];
    case "entreprise": return [["#/compte/entreprise", "Mon espace", "bureaux"], ["#/reserver/office", "Réserver", "ajouter"], ["#/mes-demandes", "Mes prestations", "calendrier"],
      ...communs, ["#/prestations", "Prestations", "document"]];
    case "pro": return [["#/compte/pro", "Planning", "calendrier"], ["#/reserver/rental", "Réserver", "ajouter"], ["#/mes-demandes", "Mes prestations", "document"],
      ...communs, ["#/mes-biens", "Mes biens", "cle"]];
    case "hotellerie": return [["#/compte/hotellerie", "Mon espace", "location"], ["#/reserver/hospitality", "Réserver", "ajouter"], ["#/mes-demandes", "Mes prestations", "calendrier"],
      ...communs, ["#/mes-biens", "Mes sites", "cle"]];
    case "cleaneur": return [["#/compte/cleaneur", "Ma société", "equipe", "societe"], ["#/compte/cleaneur", "Aujourd'hui", "horloge", "aujourdhui"],
      ["#/compte/cleaneur", "Missions", "calendrier", "missions"], ["#/compte/cleaneur", "Gains", "paiement", "gains"], ["#/messages", "Messages", "message"],
      ["#/notifications", "Notifications", "cloche"], ["#/compte/cleaneur", "Profil et documents", "document", "profil"], ["#/comment-ca-marche", "Comment ça marche", "formation"]];
    default: return [];
  }
}

/** Pages où le menu s'affiche : celles de l'espace, pas les pages de présentation du site. */
const PAGES_ESPACE = ["tableau", "reserver", "mes-demandes", "mes-biens", "messages", "notifications", "favoris", "compte", "demande", "aide", "importer-biens", "formation"];
export function pageAvecMenu(hash, type) {
  const [route, param] = hash.replace(/^#\/?/, "").split("/");
  if (!entreesMenu(type).length) return false;
  if (type === "cleaneur") return ["compte", "messages", "notifications", "demande", "aide", "formation", "comment-ca-marche"].includes(route) && (route !== "compte" || !param || param === "cleaneur");
  if (route === "compte") return !param || param === type || param === "particulier";
  return PAGES_ESPACE.includes(route);
}

/** Entrée active : la rubrique Cleaneur affichée, sinon le lien le plus long qui correspond à l'adresse. */
export function entreeActive(entrees, hash, sous) {
  const ici = hash || "#/";
  const avecSous = entrees.filter(e => e[3]);
  if (avecSous.length && ici.startsWith("#/compte/cleaneur")) return avecSous.find(e => e[3] === sous) || avecSous.find(e => e[3] === "aujourdhui");
  if (ici.startsWith("#/demande/")) return entrees.find(e => e[0] === "#/mes-demandes") || null;
  return entrees.filter(e => !e[3] && (ici === e[0] || ici.startsWith(e[0] + "/") || (e[0].startsWith("#/reserver") && ici.startsWith("#/reserver"))))
    .sort((a, b) => b[0].length - a[0].length)[0] || null;
}

let typeCourant = "visiteur", nomCourant = "";
let sousCourant = null;

function aside() {
  let a = document.querySelector(".menu-lateral");
  if (!a) {
    a = document.createElement("aside");
    a.className = "menu-lateral";
    a.setAttribute("aria-label", tr("Menu de l'espace"));
    document.querySelector(".entete")?.after(a);
    a.addEventListener("click", e => {
      const l = e.target.closest("[data-sous-menu]");
      if (!l) return;
      try { localStorage.setItem(CLE_SOUS, l.dataset.sousMenu); } catch { /* rien */ }
      const bouton = document.querySelector(`.sous-onglets [data-sous-onglet="${l.dataset.sousMenu}"]`);
      if (bouton && location.hash.startsWith("#/compte/cleaneur")) { e.preventDefault(); bouton.click(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  }
  return a;
}

/** (Re)dessine le menu pour cet espace et cette page. */
export function rendreMenuLateral(type, nomEspace) {
  typeCourant = type; nomCourant = nomEspace || "";
  const entrees = entreesMenu(type);
  const visible = pageAvecMenu(location.hash, type);
  document.body.classList.toggle("avec-menu", visible);
  if (!visible) { document.querySelector(".menu-lateral")?.setAttribute("hidden", ""); return; }
  try { sousCourant = sousCourant || localStorage.getItem(CLE_SOUS); } catch { /* rien */ }
  const actif = entreeActive(entrees, location.hash, sousCourant);
  // « Ma société » n'apparaît que si l'espace en a une (même règle que l'onglet de la page).
  const societe = !!document.querySelector('.sous-onglets [data-sous-onglet="societe"]:not([hidden])');
  const a = aside();
  a.hidden = false;
  a.innerHTML = `<p class="menu-lateral-titre">${tr(nomCourant)}</p><nav>${entrees.filter(e => e[3] !== "societe" || societe).map(e => `<a href="${e[0]}"${e[3] ? ` data-sous-menu="${e[3]}"` : ""}${e === actif ? ' class="actif" aria-current="page"' : ""}>${icone(e[2])}<span>${tr(e[1])}</span>${e[0] === "#/messages" ? '<b class="menu-compteur" data-compteur-messages hidden></b>' : ""}${e[0] === "#/notifications" ? '<b class="menu-compteur pastille-cloche-notifs" hidden></b>' : ""}</a>`).join("")}</nav>
    <div class="menu-lateral-bas"><button type="button" data-rappel>${icone("telephone")}<span>${tr("Être rappelé")}</span></button></div>`;
  traduire(a);
  compterMessages(a);
}

/** Nombre de messages non lus, pris dans les conversations de l'utilisateur. */
async function compterMessages(a) {
  const b = a.querySelector("[data-compteur-messages]");
  if (!b) return;
  try {
    const { supabase } = await import("./donnees.js");
    const { data } = await supabase.rpc("mes_conversations");
    const n = (data || []).reduce((s, c) => s + (Number(c.non_lus) || 0), 0);
    if (!b.isConnected) return;
    b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n;
  } catch { /* hors ligne : pas de compteur */ }
}

/** Changement de rubrique dans l'espace Cleaneur (sous-onglets.js) : le menu suit. */
addEventListener("cleaneroo:sous-onglet", e => {
  if (e.detail?.espace !== "cleaneur") return;
  sousCourant = e.detail.id;
  const a = document.querySelector(".menu-lateral");
  if (!a || a.hidden) return;
  a.querySelectorAll("[data-sous-menu]").forEach(l => { const oui = location.hash.startsWith("#/compte/cleaneur") && l.dataset.sousMenu === sousCourant; l.classList.toggle("actif", oui); oui ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current"); });
  const soc = a.querySelector('[data-sous-menu="societe"]');
  const aSociete = !!document.querySelector('.sous-onglets [data-sous-onglet="societe"]:not([hidden])');
  if (!soc && aSociete) rendreMenuLateral(typeCourant, nomCourant);
});
