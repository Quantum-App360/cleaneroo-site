// « Ce qui vous attend » (27/11/2026, validé par Michael) : en tête du tableau de bord, ce qui demande l'attention du compte
// (prestation à valider, paiement à finaliser, Cleaneur qui arrive aujourd'hui, demande en attente qui peut être réservée ;
// côté Cleaneur : mission du jour, avec « Démarrer » à moins de 2 h, missions proposées). Pour un double profil, le nombre de
// choses qui attendent dans l'autre espace s'affiche sur l'interrupteur (mode.js). Rien de nouveau dans la base.
import { demandesDuCompte, mesMissions, missionsDisponibles, session } from "./donnees.js";
import { profilsDe, modeCleaneur, fixerAttenteAutre, fixerMode } from "./mode.js";
import { reservationsFermees } from "./regles.js";
import { rubrique } from "./catalogue.js";
import { mesAttentes } from "./attente.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { icone } from "./icones.js";
import { esc } from "./commun.js";

const H = 3600e3;
const jourParis = d => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
const heureParis = d => new Intl.DateTimeFormat(LOCALE, { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const nom = id => tr(rubrique(id)?.nom || "Prestation");
const ACTIVES = ["VERIFICATION", "PUBLIEE", "CONFIRMEE"];
const EN_ROUTE = ["CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS"];

/** Choses à faire côté client, d'après les demandes du compte et ses demandes en attente. Fonction pure (testée). */
export function aFaireClient(demandes, attentes = [], maintenant = Date.now(), fermees = false) {
  const l = [], auj = jourParis(maintenant);
  for (const d of demandes || []) {
    const lien = d.jeton ? `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton)}` : "#/mes-demandes";
    if (d.statut === "A_VALIDER") l.push({ espace: "client", rang: 1, icone: "valide", titre: tr("Prestation à valider"), texte: `${nom(d.rubrique_id)} · ${tr("vérifiez les photos et validez")}`, lien, action: tr("Valider") });
    else if (!fermees && ACTIVES.includes(d.statut) && !d.sur_devis && (!d.paiement_statut || ["EN_ATTENTE", "ECHEC"].includes(d.paiement_statut)))
      l.push({ espace: "client", rang: 2, icone: "paiement", titre: tr(d.paiement_statut === "ECHEC" ? "Paiement refusé" : "Paiement à finaliser"), texte: `${nom(d.rubrique_id)} · ${tr("sans paiement, la demande sera annulée sans frais")}`, lien, action: tr("Payer") });
    else if (EN_ROUTE.includes(d.statut) && d.creneau && jourParis(d.creneau) === auj && Date.parse(d.creneau) > maintenant - 6 * H)
      l.push({ espace: "client", rang: 3, icone: "horloge", titre: `${tr("Votre Cleaneur arrive aujourd'hui à")} ${heureParis(d.creneau)}`, texte: nom(d.rubrique_id), lien, action: tr("Suivre") });
  }
  for (const a of attentes || []) if (a.prevenu_le && a.priorite_jusqu && Date.parse(a.priorite_jusqu) > maintenant)
    l.push({ espace: "client", rang: 2, icone: "cloche", titre: tr("Votre demande peut être réservée"), texte: `${esc(a.libelle || nom(a.rubrique_id))} · ${tr("priorité de 24 h en cours")}`, lien: `#/reprendre/${encodeURIComponent(a.jeton)}`, action: tr("Reprendre") });
  return l.sort((a, b) => a.rang - b.rang);
}

/** Choses à faire côté Cleaneur : mission du jour (« Démarrer » à moins de 2 h), missions proposées. Fonction pure (testée). */
export function aFaireCleaneur(missions, proposees = [], maintenant = Date.now()) {
  const l = [], auj = jourParis(maintenant);
  for (const m of (missions || []).filter(m => EN_ROUTE.includes(m.statut) && m.creneau && jourParis(m.creneau) === auj).sort((a, b) => Date.parse(a.creneau) - Date.parse(b.creneau))) {
    const bientot = Date.parse(m.creneau) - maintenant <= 2 * H || m.statut !== "CONFIRMEE";
    l.push({ espace: "cleaneur", rang: bientot ? 1 : 2, icone: "horloge", titre: m.statut === "CONFIRMEE" ? `${tr("Mission aujourd'hui à")} ${heureParis(m.creneau)}` : tr("Mission en cours"),
      texte: `${nom(m.rubrique_id)}${m.ville ? ` · ${esc(m.ville)}` : ""}`, lien: "#/compte/cleaneur", sous: "aujourdhui", action: tr(bientot && m.statut === "CONFIRMEE" ? "Démarrer" : "Ouvrir") });
  }
  const n = (proposees || []).length;
  if (n) l.push({ espace: "cleaneur", rang: 3, icone: "calendrier", titre: `${n} ${tr(n > 1 ? "missions proposées près de chez vous" : "mission proposée près de chez vous")}`, texte: tr("Choisissez celles qui vous conviennent"), lien: "#/compte/cleaneur", sous: "missions", action: tr("Voir") });
  return l.sort((a, b) => a.rang - b.rang);
}

/** Calcul pour le compte connecté (mis en cache 90 s). */
let cache = { le: 0, cle: "", val: null };
export async function calculerAFaire(p) {
  const x = profilsDe(p), cle = `${p?.id}|${x.client}|${x.cleaneur}`;
  if (cache.val && cache.cle === cle && Date.now() - cache.le < 90e3) return cache.val;
  const [demandes, attentes, missions, proposees] = await Promise.all([
    x.client ? demandesDuCompte().catch(() => []) : [], x.client ? mesAttentes().catch(() => []) : [],
    x.cleaneur ? mesMissions().catch(() => []) : [], x.cleaneur ? missionsDisponibles().catch(() => []) : []]);
  const val = { client: x.client ? aFaireClient(demandes, attentes, Date.now(), reservationsFermees()) : [], cleaneur: x.cleaneur ? aFaireCleaneur(missions, proposees) : [] };
  cache = { le: Date.now(), cle, val };
  return val;
}

const blocAFaire = items => `<div class="carte a-faire" role="region" aria-label="${tr("Ce qui vous attend")}">
  <h2 class="titre-a-faire">${icone("cloche")} ${tr("Ce qui vous attend")}</h2>
  ${items.slice(0, 4).map(i => `<a class="a-faire-ligne" href="${esc(i.lien)}"${i.sous ? ` data-sous-cleaneur="${esc(i.sous)}"` : ""}>${icone(i.icone, { tuile: true })}
    <span class="a-faire-texte"><b>${i.titre}</b><small>${i.texte}</small></span><span class="bouton petit">${i.action}</span></a>`).join("")}</div>`;

const moi = () => { try { return JSON.parse(localStorage.getItem("cleaneroo-moi") || "null"); } catch { return null; } };
/** Tableaux de bord : l'accueil de chaque espace. */
const estTableau = (h, cleaneur) => cleaneur ? h === "#/compte/cleaneur" : /^#\/(tableau|compte\/(particulier|entreprise|pro|hotellerie))$/.test(h);

/** Met « Ce qui vous attend » en tête du tableau de bord affiché, et la pastille de l'autre espace sur l'interrupteur. */
export async function majAFaire() {
  const p = moi();
  if (!p || p.role === "admin" || !(await session().catch(() => null))) return;
  const v = await calculerAFaire(p).catch(() => null);
  if (!v) return;
  const cleaneur = modeCleaneur(), x = profilsDe(p);
  fixerAttenteAutre(x.client && x.cleaneur ? (cleaneur ? v.client : v.cleaneur).length : 0);
  const vue = document.getElementById("vue");
  if (!vue || !estTableau(location.hash, cleaneur)) return;
  vue.querySelector(".a-faire")?.remove();
  const items = cleaneur ? v.cleaneur : v.client;
  if (!items.length) return;
  const zone = vue.querySelector(".conteneur, .etroit") || vue;
  zone.insertAdjacentHTML("afterbegin", blocAFaire(items));
  traduire(zone.querySelector(".a-faire"));
}

// Le tableau de bord est redessiné à chaque navigation : on remet le bloc dès que la vue change.
let attente = null;
export function brancherAFaire() {
  const vue = document.getElementById("vue");
  if (!vue || vue.dataset.aFaire) return;
  vue.dataset.aFaire = "1";
  new MutationObserver(() => {
    if (vue.querySelector(".a-faire") || !moi()) return;
    clearTimeout(attente); attente = setTimeout(() => majAFaire().catch(() => null), 250);
  }).observe(vue, { childList: true });
  document.addEventListener("click", e => {
    const a = e.target.closest?.("[data-sous-cleaneur]");
    if (!a) return;
    try { localStorage.setItem("cleaneroo-sous-onglet-cleaneur", a.dataset.sousCleaneur); } catch { /* rien */ }
    if (!modeCleaneur()) fixerMode(true);
  });
  majAFaire().catch(() => null);
}
