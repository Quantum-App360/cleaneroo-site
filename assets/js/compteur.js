// Compteur de visites Cleaneroo (base Supabase, table « visites ») : sans cookie, sans donnée personnelle.
// Seuls le nom de la page (jamais la référence, le jeton de suivi ni le code postal), le type d'appareil et le site
// d'origine (nom de domaine seul) sont envoyés. « Nouvelle visite » = première page vue dans cet onglet (mémoire de
// l'onglet, effacée à sa fermeture : pas de cookie). Statistiques dans gestion.html, onglet « Visites ».
const BASE = "https://wmxrmnujuqkdgvdtlnai.supabase.co/rest/v1/visites";
const CLE = "sb_publishable_6hnw_AhmOT7nOnqYJOVaSQ_XQSMSZ_H";
const ROUTES_CONNUES = ["", "prestations", "comment-ca-marche", "devenir-cleaneur", "inscription", "compte",
  "confidentialite", "conditions", "mentions-legales", "mes-demandes", "reserver", "demande"];

const surLeSite = () => ["cleaneroo.fr", "www.cleaneroo.fr"].includes(location.hostname);

function appareil() {
  const tactile = matchMedia("(pointer: coarse)").matches;
  if (!tactile) return "ordinateur";
  return Math.min(screen.width, screen.height) >= 600 ? "tablette" : "mobile";
}

function origine() {
  try {
    const h = new URL(document.referrer).hostname.replace(/^www\./, "");
    return h && !h.endsWith("cleaneroo.fr") ? h.slice(0, 100) : "";
  } catch { return ""; }
}

function nouvelleVisite() {
  try {
    if (sessionStorage.getItem("cleaneroo-visite")) return false;
    sessionStorage.setItem("cleaneroo-visite", "1");
    return true;
  } catch { return false; }
}

function envoyer(page) {
  if (!surLeSite()) return;
  const nouvelle = nouvelleVisite();
  fetch(BASE, {
    method: "POST", keepalive: true,
    headers: { apikey: CLE, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ page: page.slice(0, 80), source: "site", appareil: appareil(), origine: nouvelle ? origine() : "", nouvelle }),
  }).catch(() => { /* hors ligne : tant pis */ });
}

/** Pages statiques (villes, calculateur, comparatifs) : leur adresse, sans paramètre. */
export function compterStatique() { envoyer(location.pathname); }
/** Événement (ex. calculator_used), sans donnée personnelle. */
export function evenement(nom) { envoyer(`événement : ${nom}`); }

export function compterPage(route, param) {
  let chemin = "/" + (ROUTES_CONNUES.includes(route) ? route : "");
  if ((route === "reserver" || route === "inscription") && /^[a-z-]+$/.test(param || "")) chemin += "/" + param;
  envoyer(chemin);
}
