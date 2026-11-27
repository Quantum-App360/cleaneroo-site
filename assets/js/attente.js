// « Ma demande compte » (26/11/2026, validé par Michael) : la demande en attente est gardée complète, avec sa place dans la file
// du secteur ; un compteur de quartier anonyme se partage aux voisins ; les demandes qui attendent sont montrées aux futurs
// Cleaneurs ; à l'ouverture, les inscrits ont 24 h de priorité et reprennent leur demande en un clic (lien #/reprendre/<jeton>).
// Base : outils/base-ma-demande-compte.sql. E-mails : fonction serveur « attente ». Rien n'est payé ni bloqué avant l'ouverture.
import { supabase, session } from "./donnees.js";
import { traduire, tr, langue, LOCALE } from "./langue.js";
import { icone } from "./icones.js";
import { esc } from "./commun.js";
import { rubrique } from "./catalogue.js";
import { chercherAdresse } from "./cartes.js";
import { passagesPlanifies } from "./estimation.js";
import { lienParrainage } from "./parrainage.js";

const CLE = "cleaneroo-attentes";   // rubrique → jeton de la demande en attente, sur cet appareil
const lireJetons = () => { try { return JSON.parse(localStorage.getItem(CLE) || "{}") || {}; } catch { return {}; } };
const garderJeton = (rubriqueId, jeton) => { try { localStorage.setItem(CLE, JSON.stringify({ ...lireJetons(), [rubriqueId]: jeton })); } catch { /* rien */ } };
export const jetonAttente = rubriqueId => lireJetons()[rubriqueId] || "";
export function oublierJeton(jeton) {
  const l = lireJetons();
  for (const k of Object.keys(l)) if (l[k] === jeton) delete l[k];
  try { localStorage.setItem(CLE, JSON.stringify(l)); } catch { /* rien */ }
}

/** Position de la demande : l'adresse, le véhicule, sinon le centre de la commune (code postal et ville). */
async function positionDe(b) {
  if (Number.isFinite(b.lat) && Number.isFinite(b.lon)) return { lat: b.lat, lon: b.lon };
  if (Number.isFinite(b.vehLat) && Number.isFinite(b.vehLon)) return { lat: b.vehLat, lon: b.vehLon };
  const a = await chercherAdresse([b.port, b.codePostal, b.ville].filter(Boolean).join(" "), b.codePostal).catch(() => null)
    || await chercherAdresse(`${b.codePostal || ""} ${b.ville || ""}`.trim(), b.codePostal).catch(() => null);
  return a ? { lat: a.lat, lon: a.lon, ville: a.ville } : null;
}

/** Met la demande complète en attente. motif : "ouverture" (réservations fermées) ou "secteur" (pas encore de Cleaneur).
 *  Renvoie { jeton, rang, total, ville }. */
export async function mettreEnAttente(b, motif) {
  const p = await positionDe(b);
  if (!p) throw new Error("position");
  const r = rubrique(b.rubriqueId);
  let regulier = false;
  try { regulier = passagesPlanifies(b) > 1; } catch { /* brouillon partiel */ }
  const { data, error } = await supabase.rpc("mettre_en_attente", { p_rubrique: b.rubriqueId, p_code_postal: b.codePostal || "",
    p_ville: (b.ville || p.ville || "").trim() || "—", p_lat: p.lat, p_lon: p.lon, p_prenom: b.prenom || "", p_email: b.email || "", p_telephone: b.telephone || "",
    p_motif: motif, p_regulier: regulier, p_libelle: r ? tr(r.nom) : "", p_langue: langue, p_brouillon: b.etape ? { ...b, etape: 5 } : null, p_source: "site" });
  if (error) throw new Error(error.message);
  if (data?.jeton) garderJeton(b.rubriqueId, data.jeton);
  return data;
}

/** Compteur anonyme des demandes qui attendent près d'un point : { total, reguliers, km, prestations: [{ rubrique_id, n }] }. */
export async function attenteQuartier(lat, lon, km = null) {
  const { data, error } = await supabase.rpc("attente_quartier", { p_lat: lat, p_lon: lon, p_km: km });
  return error ? null : data;
}
/** Fin de la priorité des inscrits dans ce secteur (Date), ou null. */
export async function prioriteSecteur(rubriqueId, lat, lon) {
  if (!Number.isFinite(lat)) return null;
  const { data, error } = await supabase.rpc("priorite_secteur", { p_rubrique: rubriqueId, p_lat: lat, p_lon: lon, p_jeton: jetonAttente(rubriqueId) || null });
  return error || !data ? null : new Date(data);
}
/** Demandes en attente : celles de cet appareil (lien personnel) et celles du compte connecté, sans doublon. */
export async function mesAttentes() {
  const jetons = Object.values(lireJetons());
  const [locales, compte] = await Promise.all([
    Promise.all(jetons.map(j => supabase.rpc("attente_par_jeton", { p_jeton: j }).then(r => r.data, () => null))),
    session().then(s => s ? supabase.rpc("mes_attentes").then(r => r.data || [], () => []) : []).catch(() => []),
  ]);
  const vus = new Set(), liste = [];
  for (const a of [...(compte || []), ...locales]) {
    if (!a?.jeton || vus.has(a.jeton) || a.reprise_le) continue;
    vus.add(a.jeton); liste.push(a);
  }
  // Jetons d'appareil disparus (demande réservée ou retirée de la liste) : oubliés.
  jetons.forEach((j, i) => { if (!locales[i] || locales[i].reprise_le) oublierJeton(j); });
  return liste;
}

const dateHeure = d => new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const nomRubrique = id => tr(rubrique(id)?.nom || "");
/** « 4 demandes de Ménage attendent près de Fréjus » et le détail par prestation. */
function phraseQuartier(q, ville, rubriqueId) {
  if (!q || !q.total) return "";
  const n = (q.prestations || []).find(x => x.rubrique_id === rubriqueId)?.n || 0;
  return `${icone("equipe")} <b>${q.total} ${tr(q.total > 1 ? "demandes attendent" : "demande attend")}</b> ${tr("un Cleaneur près de")} ${esc(ville)}${n && n < q.total ? `, ${tr("dont")} ${n} ${tr("pour")} ${esc(nomRubrique(rubriqueId))}` : ""}.`;
}

/** Message à partager aux voisins (avec le code de parrainage s'il y en a un). */
function messageVoisins(rubriqueId, ville, code) {
  const lien = code ? `${lienParrainage(code)}#/reserver/${rubriqueId}` : `${location.origin}/#/reserver/${rubriqueId}`;
  return `${tr("J'attends un Cleaneur à")} ${ville} ${tr("pour")} ${nomRubrique(rubriqueId).toLowerCase()} ${tr("sur Cleaneroo. Plus il y a de demandes dans le quartier, plus il passe en priorité pour le recrutement. Inscrivez-vous :")} ${lien}`
    + (code ? ` ${tr("Avec mon code")} ${code}${tr(", tes 3 premières réservations Cleaneroo sont sans frais de service.")}` : "");
}

/** Bloc après l'inscription : place dans la file, compteur du quartier, partage aux voisins, ce qui se passe ensuite. */
export function blocInscrit(res, rubriqueId, motif, q = null, code = "") {
  const rang = res?.rang || 1, total = Math.max(res?.total || 1, rang), ville = res?.ville || "";
  const message = messageVoisins(rubriqueId, ville, code);
  return `<div class="carte attente-inscrit" style="margin-top:14px;border-color:var(--primaire)">
    <h3 style="margin:0 0 6px">${icone("valide")} ${tr("Votre demande est enregistrée")}</h3>
    <p class="attente-rang"><b>${tr("n°")} ${rang}</b> <span>${tr("sur la liste à")} ${esc(ville)} · ${total} ${tr(total > 1 ? "demandes" : "demande")} · ${esc(nomRubrique(rubriqueId))}</span></p>
    <p class="muet" style="margin:0 0 8px">${tr(motif === "ouverture"
      ? "Dès l'ouverture des réservations, si un Cleaneur couvre votre adresse, vous recevrez un e-mail pour reprendre votre demande en un clic, sans rien ressaisir. Vous aurez alors 24 h de priorité pour choisir votre créneau, avant tout le monde dans votre secteur."
      : "Dès qu'un Cleaneur vérifié s'installe dans votre secteur, vous recevrez un e-mail pour reprendre votre demande en un clic, sans rien ressaisir. Vous aurez alors 24 h de priorité pour choisir votre créneau, avant tout le monde dans votre secteur.")}</p>
    <p class="petit muet" style="margin:0 0 10px">${tr("Rien n'est payé ni bloqué. Le prix sera recalculé selon les tarifs en vigueur et affiché avant le paiement.")}</p>
    ${q && q.total ? `<p class="attente-quartier">${phraseQuartier(q, ville, rubriqueId)}</p>` : ""}
    <div class="attente-partage"><b>${tr("Faites avancer votre quartier")}</b>
      <p class="petit" style="margin:4px 0 8px">${tr("Plus il y a de demandes près de chez vous, plus votre secteur passe en priorité pour le recrutement des Cleaneurs.")}${code ? ` ${tr("Avec votre code de parrainage, vos voisins ont 3 réservations sans frais de service, et vous gagnez vos récompenses de parrainage.")}` : ""}</p>
      <div class="boutons" style="margin-top:0"><a class="bouton secondaire" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(message)}">${icone("message")} ${tr("Prévenir mes voisins sur WhatsApp")}</a>
        <button type="button" class="lien-bouton" data-copier-voisins="${esc(message)}">${icone("partager")} ${tr("Copier le message")}</button><span class="petit" data-copie-voisins aria-live="polite"></span></div></div>
  </div>`;
}

/** Vos demandes en attente (centre de réservation) : place dans la file, ou « à réserver » pendant la priorité. */
export function blocMesAttentes(liste) {
  if (!liste?.length) return "";
  return `<div class="centre-bloc"><h3 class="titre-centre">${tr("Vos demandes en attente")}</h3><div class="liste-en-cours">${liste.slice(0, 4).map(a => {
    const r = rubrique(a.rubrique_id);
    const prete = !!a.prevenu_le;
    const etat = prete
      ? (a.priorite_jusqu && new Date(a.priorite_jusqu) > new Date() ? `${tr("À réserver : priorité jusqu'au")} ${dateHeure(a.priorite_jusqu)}` : tr("Un Cleaneur couvre maintenant votre adresse"))
      : `${tr("n°")} ${a.rang} ${tr("sur la liste à")} ${esc(a.ville)} · ${a.total} ${tr(a.total > 1 ? "demandes" : "demande")}`;
    return `<div class="carte en-cours${prete ? " attente-prete" : ""}">${icone(r?.icone || "horloge", { tuile: true })}<div class="en-cours-texte"><b>${esc(a.libelle || nomRubrique(a.rubrique_id))}</b>
      <span class="petit muet">${etat}</span>${!prete && a.motif === "ouverture" ? `<span class="petit">${tr("En attente de l'ouverture des réservations")}</span>` : ""}</div>
      <div class="en-cours-actions">${prete ? `<a class="bouton petit" href="#/reprendre/${encodeURIComponent(a.jeton)}">${tr("Reprendre ma demande")}</a>` : `<a class="lien-bouton" href="#/reprendre/${encodeURIComponent(a.jeton)}">${tr("Voir")}</a>`}</div></div>`;
  }).join("")}</div></div>`;
}

/** #/reprendre/<jeton> : la demande gardée s'ouvre au choix du créneau (date passée : à choisir de nouveau), sans rien ressaisir. */
export async function pageReprendre(vue, jeton) {
  const { data: a } = await supabase.rpc("attente_par_jeton", { p_jeton: jeton }).then(r => r, () => ({ data: null }));
  const page = html => { vue.innerHTML = `<section class="bloc"><div class="etroit">${html}</div></section>`; traduire(vue); };
  if (!a) return page(`<h1>${tr("Demande introuvable")}</h1><p>${tr("Ce lien n'est plus valable : la demande a peut-être été retirée de la liste.")}</p>
    <div class="boutons"><a class="bouton" href="#/reserver">${tr("Faire une nouvelle demande")}</a></div>`);
  if (a.reprise_le) return page(`<h1>${tr("Demande déjà réservée")}</h1><p>${tr("Cette demande a déjà été envoyée. Retrouvez-la dans votre suivi.")}</p>
    <div class="boutons"><a class="bouton" href="#/mes-demandes">${tr("Mes demandes")}</a></div>`);
  garderJeton(a.rubrique_id, a.jeton);
  const br = a.brouillon && typeof a.brouillon === "object" ? a.brouillon : null;
  if (!a.prevenu_le || !br || !rubrique(a.rubrique_id)) {
    // Encore en attente (ou inscription sans demande détaillée) : sa place, et la possibilité de quitter la liste.
    return page(`<h1>${esc(a.libelle || nomRubrique(a.rubrique_id))}</h1>
      ${a.prevenu_le ? `<p>${tr("Un Cleaneur vérifié couvre maintenant votre secteur.")}${a.priorite_jusqu && new Date(a.priorite_jusqu) > new Date() ? ` ${tr("Vous avez la priorité jusqu'au")} ${dateHeure(a.priorite_jusqu)}.` : ""}</p>
        <div class="boutons"><a class="bouton" href="#/reserver/${encodeURIComponent(a.rubrique_id)}">${tr("Réserver")}</a></div>`
      : `<p class="attente-rang"><b>${tr("n°")} ${a.rang}</b> <span>${tr("sur la liste à")} ${esc(a.ville)} · ${a.total} ${tr(a.total > 1 ? "demandes" : "demande")}</span></p>
        <p class="muet">${tr(a.motif === "ouverture" ? "Votre demande est gardée. Vous serez prévenu dès l'ouverture des réservations dans votre secteur." : "Votre demande est gardée. Vous serez prévenu dès qu'un Cleaneur vérifié s'installe dans votre secteur.")}</p>`}
      <p style="margin-top:20px"><button type="button" class="lien-bouton" data-quitter-attente="${esc(a.jeton)}">${tr("Ne plus être prévenu")}</button> <span class="petit" data-quitter-ok aria-live="polite"></span></p>`);
  }
  // Prête : la demande s'ouvre à l'étape du créneau, avec le jour souhaité s'il est encore possible.
  const demain = new Date(Date.now() + 24 * 3600e3).toISOString().slice(0, 10);
  const jour = br.jour && br.jour >= demain ? br.jour : "";
  const reprise = { ...br, rubriqueId: a.rubrique_id, attenteJeton: a.jeton, etape: 4, jour, heure: -1, cgv: false,
    prenom: br.prenom || a.prenom || "", email: br.email || a.email || "", telephone: br.telephone || a.telephone || "" };
  try { localStorage.setItem("cleaneroo-brouillon", JSON.stringify(reprise)); } catch { /* rien */ }
  location.replace(`#/reserver/${encodeURIComponent(a.rubrique_id)}`);
}

/** « Des clients vous attendent » (page Devenir Cleaneur) : les demandes qui attendent un Cleaneur autour d'une commune. */
export const blocQuiAttendent = () => `<div class="carte teintee qui-attendent" style="margin:0 0 18px">
  <h2 class="titre-section" style="margin-top:0">${icone("equipe", { tuile: true })}${tr("Des clients vous attendent")}</h2>
  <p class="petit" style="margin:0 0 10px">${tr("Voyez combien de demandes attendent déjà un Cleaneur près de chez vous : elles vous seront proposées dès votre dossier validé.")}</p>
  <form data-qui-attendent class="grille-2" novalidate><label class="champ"><span>${tr("Votre ville ou code postal")}</span><input name="lieu" autocomplete="address-level2" maxlength="80" placeholder="${tr("Ex. : Fréjus")}"></label>
    <div style="align-self:end"><button type="submit" class="bouton">${icone("recherche")} ${tr("Voir les demandes")}</button></div></form>
  <div data-resultat-attendent aria-live="polite"></div></div>`;

const KM_CLEANEUR = 20;
document.addEventListener("submit", async e => {
  const f = e.target.closest?.("[data-qui-attendent]");
  if (!f) return;
  e.preventDefault();
  const zone = f.parentElement.querySelector("[data-resultat-attendent]");
  const lieu = f.lieu.value.trim();
  if (lieu.length < 2) { zone.innerHTML = `<p class="erreur">${tr("Indiquez une ville ou un code postal.")}</p>`; return; }
  zone.innerHTML = `<p class="petit muet">${tr("Recherche…")}</p>`;
  const a = await chercherAdresse(lieu, /^\d{5}$/.test(lieu) ? lieu : "").catch(() => null);
  const q = a ? await attenteQuartier(a.lat, a.lon, KM_CLEANEUR) : null;
  if (!a || !q) { zone.innerHTML = `<p class="erreur">${tr(a ? "Le service est momentanément indisponible. Réessayez dans quelques minutes." : "Commune introuvable. Vérifiez l'orthographe ou essayez le code postal.")}</p>`; return; }
  const ville = esc(a.ville || lieu);
  zone.innerHTML = q.total
    ? `<p class="attente-quartier" style="margin-top:10px"><b>${q.total} ${tr(q.total > 1 ? "demandes attendent" : "demande attend")}</b> ${tr("un Cleaneur dans un rayon de")} ${q.km} km ${tr("autour de")} ${ville}${q.reguliers ? `, ${tr("dont")} ${q.reguliers} ${tr(q.reguliers > 1 ? "entretiens réguliers" : "entretien régulier")}` : ""}.</p>
       <ul class="petit liste-attendent">${(q.prestations || []).slice(0, 5).map(x => `<li>${esc(nomRubrique(x.rubrique_id) || x.rubrique_id)} : ${x.n}</li>`).join("")}</ul>
       <div class="boutons" style="margin-top:6px"><a class="bouton" href="#/compte/cleaneur">${tr("Créer mon compte Cleaneur")}</a></div>`
    : `<p style="margin-top:10px">${tr("Pas encore de demande en attente autour de")} ${ville}. ${tr("Inscrivez-vous : vous serez parmi les premiers Cleaneurs du secteur, et les demandes vous seront proposées dès qu'elles arrivent.")}</p>`;
  traduire(zone);
});

document.addEventListener("click", async e => {
  const c = e.target.closest?.("[data-copier-voisins]");
  if (c) {
    const ok = c.parentElement.querySelector("[data-copie-voisins]");
    try { await navigator.clipboard.writeText(c.dataset.copierVoisins); if (ok) ok.textContent = tr("Message copié"); } catch { if (ok) ok.textContent = c.dataset.copierVoisins; }
    return;
  }
  const q = e.target.closest?.("[data-quitter-attente]");
  if (q) {
    q.disabled = true;
    const { data } = await supabase.rpc("quitter_attente", { p_jeton: q.dataset.quitterAttente }).then(r => r, () => ({ data: null }));
    const ok = q.parentElement.querySelector("[data-quitter-ok]");
    if (data === "ok") { oublierJeton(q.dataset.quitterAttente); if (ok) ok.textContent = tr("C'est fait : vous ne serez plus prévenu."); q.remove(); }
    else { q.disabled = false; if (ok) ok.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  }
});

