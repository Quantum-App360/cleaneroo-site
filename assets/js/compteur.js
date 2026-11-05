// Compteur de visites GoatCounter : sans cookie, sans donnée personnelle.
// Seul le nom de la page est envoyé (jamais la référence, le jeton de suivi ni le code postal).
const ADRESSE = "https://cleaneroo.goatcounter.com/count";
const ROUTES_CONNUES = ["", "prestations", "comment-ca-marche", "devenir-cleaneur", "inscription",
  "confidentialite", "conditions", "mentions-legales", "mes-demandes", "reserver", "demande"];

let enAttente = [];

function envoyer(chemin, evenement = false) {
  if (window.goatcounter?.count) window.goatcounter.count({ path: chemin, title: chemin, event: evenement });
  else enAttente.push([chemin, evenement]);
}
const surLeSite = () => ["cleaneroo.fr", "www.cleaneroo.fr"].includes(location.hostname);

/** Pages statiques (villes, calculateur, comparatifs) : leur adresse, sans paramètre. */
export function compterStatique() { if (surLeSite()) envoyer(location.pathname); }
/** Événement d'analytique (ex. calculator_used), sans donnée personnelle. */
export function evenement(nom) { if (surLeSite()) envoyer(nom, true); }

export function compterPage(route, param) {
  if (!surLeSite()) return;
  let chemin = "/" + (ROUTES_CONNUES.includes(route) ? route : "");
  if ((route === "reserver" || route === "inscription") && /^[a-z-]+$/.test(param || "")) chemin += "/" + param;
  envoyer(chemin);
}

window.goatcounter = Object.assign(window.goatcounter || {}, { no_onload: true });
const script = document.createElement("script");
script.async = true;
script.src = "https://gc.zgo.at/count.js";
script.dataset.goatcounter = ADRESSE;
script.onload = () => { const liste = enAttente; enAttente = []; liste.forEach(([c, e]) => envoyer(c, e)); };
document.head.appendChild(script);
