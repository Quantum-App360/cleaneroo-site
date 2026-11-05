// Compteur de visites GoatCounter : sans cookie, sans donnée personnelle.
// Seul le nom de la page est envoyé (jamais la référence, le jeton de suivi ni le code postal).
const ADRESSE = "https://cleaneroo.goatcounter.com/count";
const ROUTES_CONNUES = ["", "prestations", "comment-ca-marche", "devenir-cleaneur", "inscription",
  "confidentialite", "conditions", "mentions-legales", "mes-demandes", "reserver", "demande"];

let enAttente = [];

function envoyer(chemin) {
  if (window.goatcounter?.count) window.goatcounter.count({ path: chemin, title: chemin });
  else enAttente.push(chemin);
}

export function compterPage(route, param) {
  if (!["cleaneroo.fr", "www.cleaneroo.fr"].includes(location.hostname)) return;
  let chemin = "/" + (ROUTES_CONNUES.includes(route) ? route : "");
  if ((route === "reserver" || route === "inscription") && /^[a-z-]+$/.test(param || "")) chemin += "/" + param;
  envoyer(chemin);
}

window.goatcounter = Object.assign(window.goatcounter || {}, { no_onload: true });
const script = document.createElement("script");
script.async = true;
script.src = "https://gc.zgo.at/count.js";
script.dataset.goatcounter = ADRESSE;
script.onload = () => { const liste = enAttente; enAttente = []; liste.forEach(envoyer); };
document.head.appendChild(script);
