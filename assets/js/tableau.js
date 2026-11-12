// Accueil « vivant » du compte connecté (Particulier, Pro, administrateur) : la prochaine prestation en direct
// et la boîte « À faire » (tout ce qui attend le client). Se met à jour en temps réel. Même écran dans l'appli (AccueilVivant.kt).
import { badgeNiveau } from "./niveaux.js";
import { decorTableau } from "./commun.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr } from "./langue.js";
import { supabase, session, monProfil, demandesDuCompte, synchroniserBiens, ecouterDemandes } from "./donnees.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Étapes affichées sur la frise de la prochaine prestation. */
export const ETAPES_VIVANT = [["PUBLIEE", "En ligne"], ["CONFIRMEE", "Confirmée"], ["EN_ROUTE", "En route"], ["SUR_PLACE", "Sur place"], ["EN_COURS", "Ménage"], ["A_VALIDER", "À valider"]];
const RANG = { VERIFICATION: 0, PUBLIEE: 0, CONFIRMEE: 1, EN_ROUTE: 2, SUR_PLACE: 3, EN_COURS: 4, A_VALIDER: 5 };
const FINIES = ["TERMINEE", "ANNULEE"];
/** Ordre de priorité : ce qui se passe maintenant d'abord, puis la date la plus proche. */
const PRIORITE = { EN_ROUTE: 0, SUR_PLACE: 0, EN_COURS: 0, A_VALIDER: 1, CONFIRMEE: 2, PUBLIEE: 3, VERIFICATION: 3 };

/** Prochaine prestation : en cours d'abord, sinon la plus proche. */
export function prochaine(demandes) {
  const quand = d => new Date(d.creneau || d.cree_le).getTime();
  return demandes.filter(d => !FINIES.includes(d.statut))
    .sort((a, b) => (PRIORITE[a.statut] ?? 4) - (PRIORITE[b.statut] ?? 4) || quand(a) - quand(b))[0] || null;
}

/** « dans 2 j 5 h », « dans 3 h 10 », « dans 12 min », ou "" si passé. */
export function compteARebours(dateIso, maintenant = Date.now()) {
  if (!dateIso) return "";
  const min = Math.round((new Date(dateIso).getTime() - maintenant) / 60000);
  if (min <= 0) return "";
  if (min < 60) return `${tr("dans")} ${min} min`;
  const h = Math.floor(min / 60), j = Math.floor(h / 24);
  if (j >= 1) return `${tr("dans")} ${j} ${tr("j")} ${h % 24} h`;
  return `${tr("dans")} ${h} h ${String(min % 60).padStart(2, "0")}`;
}

/** Phrase principale selon l'étape (avec le prénom du Cleaneur quand il est connu). */
function phrase(d, prenom) {
  const qui = prenom || tr("Votre Cleaneur");
  return {
    VERIFICATION: tr("Nous vérifions votre demande"),
    PUBLIEE: tr("En ligne : les Cleaneurs vérifiés de votre secteur sont prévenus"),
    CONFIRMEE: prenom ? `${prenom} ${tr("interviendra chez vous")}` : tr("Votre Cleaneur est confirmé"),
    EN_ROUTE: `${qui} ${tr("est en route")}`,
    SUR_PLACE: `${qui} ${tr("est arrivé(e)")}`,
    EN_COURS: tr("Ménage en cours"),
    A_VALIDER: tr("Ménage terminé : validez-le"),
  }[d.statut] || tr("Votre prestation");
}

/**
 * Boîte « À faire » : tout ce qui attend le client, du plus urgent au moins urgent.
 * Chaque élément : { urgent, icone, titre, detail, lien }.
 */
export function aFaire({ profil, demandes, biens }) {
  const l = [];
  const date = d => d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : tr("Date à fixer");
  const lien = d => `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton)}`;
  demandes.filter(d => d.statut === "A_VALIDER").forEach(d => l.push({ urgent: true, icone: "valide",
    titre: `${tr("Validez le ménage")} · ${rubrique(d.rubrique_id).nom}`, detail: `${date(d)} · ${tr("le paiement ne part qu'après votre accord")}`, lien: lien(d) }));
  demandes.filter(d => !FINIES.includes(d.statut) && ["BOITE", "AUTONOME"].includes(d.accueil) && !(d.acces && d.acces.code)).forEach(d => l.push({ urgent: true, icone: "cle",
    titre: `${tr("Indiquez le code d'accès")} · ${rubrique(d.rubrique_id).nom}`, detail: date(d), lien: lien(d) }));
  if (profil && !(profil.telephone || "").trim()) l.push({ urgent: false, icone: "telephone",
    titre: tr("Ajoutez votre numéro de téléphone"), detail: tr("Votre Cleaneur peut vous joindre le jour J."), lien: "#/compte" });
  const statuts = profil?.statuts || [];
  if (!biens.length && (statuts.includes("particulier") || statuts.includes("pro"))) l.push({ urgent: false, icone: "logement",
    titre: tr("Enregistrez votre logement"), detail: tr("Vos prochaines réservations iront deux fois plus vite."), lien: "#/mes-biens" });
  if (statuts.includes("pro")) biens.filter(b => !(b.calendriers || []).some(c => c.url)).slice(0, 3).forEach(b => l.push({ urgent: false, icone: "calendrier",
    titre: `${tr("Reliez le calendrier Airbnb ou Booking")} · ${b.nom || b.ville}`, detail: tr("Les ménages entre deux voyageurs apparaîtront tout seuls."), lien: "#/compte/pro" }));
  if (statuts.includes("cleaneur") && profil.dossier !== "VALIDE" && profil.role !== "admin") l.push({ urgent: false, icone: "garantie",
    titre: tr("Complétez votre dossier Cleaneur"), detail: tr("Pièce d'identité, SIRET, assurance et URSSAF."), lien: "#/compte/cleaneur" });
  return l;
}

/* ------------------------------------------------------------------ Écran */
let minuterie = null, arret = null;
export function arreterTableau() { clearInterval(minuterie); minuterie = null; if (arret) arret(); arret = null; }

/** Rend l'accueil du compte ; renvoie false si personne n'est connecté (la page d'accueil publique s'affiche alors). */
export async function pageTableau(vue) {
  const ici = location.hash;
  const s = await session();
  if (!s) return false;
  const [profil, demandes, biens, cleaneurs] = await Promise.all([monProfil().catch(() => null), demandesDuCompte().catch(() => []),
    synchroniserBiens().catch(() => []), supabase.rpc("cleaneurs_de_mes_demandes").then(r => r.data || []).catch(() => [])]);
  if (location.hash !== ici) return true;
  const prenoms = Object.fromEntries(cleaneurs.map(c => [c.reference, c.prenom]));
  const niveaux = Object.fromEntries(cleaneurs.map(c => [c.reference, c.niveau || 0]));
  const d = prochaine(demandes);
  const autres = demandes.filter(x => !FINIES.includes(x.statut) && x !== d).length;
  const taches = aFaire({ profil, demandes, biens });
  const rang = d ? RANG[d.statut] ?? 0 : -1;
  const enDirect = d && ["EN_ROUTE", "SUR_PLACE", "EN_COURS"].includes(d.statut);
  const r = d && rubrique(d.rubrique_id);
  const pro = (profil?.statuts || []).includes("pro") && profil?.espace === "pro";
  decorTableau(true);
  vue.innerHTML = `<section class="tableau"><div class="conteneur">
    <div class="tableau-entete">
      <div><span class="surtitre">${esc(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))}</span>
        <h1>${tr("Bonjour")} ${esc(profil?.prenom || "")}</h1></div>
      <a class="bouton" href="#/reserver" data-choisir-prestation>＋ ${tr("Réserver")}</a>
    </div>
    <div class="tableau-grille">
      <article class="carte vivant${enDirect ? " en-direct" : ""}${d ? "" : " vide"}" data-teinte="${d ? (enDirect ? "corail" : "turquoise") : "lilas"}">
        ${d ? `<div class="vivant-haut"><span class="pastille-etat">${enDirect ? `<i></i>${tr("En direct")}` : esc(tr("Ma prochaine prestation"))}</span>
            <span class="rebours" data-rebours="${esc(d.creneau || "")}">${compteARebours(d.creneau)}</span></div>
          <div class="vivant-corps">${icone(r.icone, { tuile: true })}
            <div><h2>${esc(phrase(d, prenoms[d.reference]))}${badgeNiveau(niveaux[d.reference])}</h2>
              <p class="muet">${r.nom} · ${d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : tr("Date à fixer")} · ${esc(d.ville)}</p></div></div>
          <ol class="frise">${ETAPES_VIVANT.map(([, nom], i) => `<li class="${i < rang ? "fait" : i === rang ? "actif" : ""}"><span></span><b>${tr(nom)}</b></li>`).join("")}</ol>
          <div class="boutons"><a class="bouton" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">${enDirect ? tr("Suivre en direct") : tr("Voir ma prestation")}</a>
            ${autres ? `<a class="bouton secondaire" href="#/mes-demandes/a-venir">+${autres} ${tr(autres > 1 ? "autres prestations" : "autre prestation")}</a>` : ""}</div>`
        : `<div class="vivant-corps">${icone("instantane", { tuile: true })}<div><h2>${tr("Aucune prestation prévue")}</h2>
            <p class="muet">${tr("Décrivez votre besoin : le prix s'affiche tout de suite.")}</p></div></div>
          <div class="boutons"><a class="bouton" href="#/reserver" data-choisir-prestation>${tr("Réserver une prestation")}</a></div>`}
      </article>
      <article class="carte a-faire">
        <div class="a-faire-titre"><h2>${tr("À faire")}</h2>${taches.length ? `<em>${taches.length}</em>` : ""}</div>
        ${taches.length ? `<ul>${taches.map(t => `<li><a href="${t.lien}" class="${t.urgent ? "urgent" : ""}">${icone(t.icone, { tuile: true })}
            <span><b>${esc(t.titre)}</b><small>${esc(t.detail)}</small></span><i aria-hidden="true">›</i></a></li>`).join("")}</ul>`
          : `<div class="tout-va-bien">${icone("valide", { tuile: true })}<p><b>${tr("Tout est à jour")}</b><br><span class="muet">${tr("Rien ne vous attend pour l'instant.")}</span></p></div>`}
      </article>
    </div>
    <div class="grille-raccourcis tableau-raccourcis">
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>${tr("Mes demandes")}</b><span class="petit">${tr("En cours, à venir, passées")}</span></a>
      <a class="carte raccourci" href="#/mes-biens">${icone("logement", { tuile: true })}<b>${tr("Mes biens")}</b><span class="petit">${biens.length} ${tr(biens.length > 1 ? "adresses" : "adresse")}</span></a>
      <a class="carte raccourci" href="${pro ? "#/compte/pro" : "#/compte"}">${icone(pro ? "location" : "avis", { tuile: true })}<b>${tr(pro ? "Agenda" : "Mon compte")}</b><span class="petit">${tr(pro ? "Séjours et ménages à programmer" : "Profil et espaces")}</span></a>
    </div>
    <p class="petit direct" style="margin-top:14px"><i></i>${tr("Mis à jour en temps réel")} · <a href="#/vitrine">${tr("Voir la page d'accueil du site")}</a></p>
  </div></section>`;
  traduire(vue);
  // Compte à rebours rafraîchi chaque minute ; écran redessiné à chaque changement d'une demande.
  arreterTableau();
  minuterie = setInterval(() => vue.querySelectorAll("[data-rebours]").forEach(e => { e.textContent = compteARebours(e.dataset.rebours); }), 30000);
  let attente = null;
  ecouterDemandes(() => { clearTimeout(attente); attente = setTimeout(() => { if (location.hash === ici) pageTableau(vue); }, 400); })
    .then(f => { if (location.hash === ici) arret = f; else f(); });
  return true;
}
