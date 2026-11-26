// Cleaneroo AI, « Décrire mon besoin » (26/11/2026) : le client décrit librement son besoin (texte, dictée, jusqu'à 4 photos),
// l'IA (fonction serveur besoin-ia) pose au besoin une ou deux questions, puis renvoie une proposition faite d'identifiants du catalogue.
// Cette fenêtre en fait une FICHE : diagnostic, prestation, options (obligatoire / recommandée / facultative, avec leur raison),
// ce qu'on peut attendre du résultat, et le prix calculé par le MÊME moteur que la réservation (reserver.js › estimerBrouillon).
// Le client coche ou décoche ; retirer une option recommandée affiche un avertissement (base de connaissances) à confirmer.
// « Continuer » ouvre le parcours de réservation existant, prérempli (adresse, créneau, Cleaneur, paiement inchangés).
// Cas hors catalogue ou incertain : demande transmise à l'équipe (demandes_support, comme l'assistant du support).
import { supabase, session, monProfil, reduirePhoto } from "./donnees.js";
import { rubrique, ELEMENTS_TEXTILES, TAILLES_CANAPE, DERNIERS_NETTOYAGES, libelleLigne } from "./catalogue.js";
import { tachesChiffrees } from "./estimation.js";
import { euros } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire, langue } from "./langue.js";
import { esc } from "./commun.js";
import { brouillonPour, estimerBrouillon, totalAffiche } from "./reserver.js";

const CLE = "cleaneroo-assistant-ia";
const PHOTOS_MAX = 4;
const NIVEAUX = [["obligatoire", "Nécessaire"], ["recommandee", "Recommandé"], ["facultative", "Facultatif"]];

/* ------------------------------------------------------------------ Logique (pure, testée dans tests.html) */

/** Champs du brouillon de réservation pour un objet de la fiche (mêmes champs que le parcours de réservation). */
export function champsDepuisObjet(o, cochees) {
  const c = o.champs || {}, champs = { taches: [...cochees] };
  if (o.formule_id) champs.formuleId = o.formule_id;
  if (o.type_lieu_id) champs.typeLieuId = o.type_lieu_id;
  if (o.rubrique_id === "textiles") {
    champs.panier = (o.elements || []).filter(e => ELEMENTS_TEXTILES.some(x => x.id === e.element_id)).map(e => {
      const el = ELEMENTS_TEXTILES.find(x => x.id === e.element_id);
      return { elementId: e.element_id, tailleId: el.avecTaille ? (TAILLES_CANAPE.some(t => t.id === e.taille_id) ? e.taille_id : "t15") : "",
        quantite: Math.min(20, Math.max(1, Math.round(e.quantite || 1))), surfaceM2: el.parM2 ? Math.max(1, Math.round(e.surface_m2 || 0)) : 0 };
    });
    if (!champs.formuleId && champs.panier[0]) champs.formuleId = ELEMENTS_TEXTILES.find(x => x.id === champs.panier[0].elementId).formuleId;
  }
  if (c.surface > 0) champs.surface = Math.min(5000, Math.round(c.surface));
  if (c.chambres > 0) champs.chambres = Math.min(20, c.chambres);
  if (c.sdb > 0) champs.sdb = Math.min(10, c.sdb);
  if (c.fenetres > 0) champs.fenetres = Math.min(200, c.fenetres);
  if (o.rubrique_id === "car" && c.nombre_vehicules > 0) champs.nombreVehicules = c.nombre_vehicules;
  const dn = DERNIERS_NETTOYAGES.find(d => d.id === c.dernier_nettoyage);
  if (dn) { champs.dernierNettoyage = dn.id; champs.salissure = dn.salissure; }
  return champs;
}

/** Options cochées au départ : nécessaires et recommandées. */
export const cocheesDepart = o => (o.options || []).filter(x => x.niveau !== "facultative").map(x => x.tache_id);

/** Chiffrage d'un objet : brouillon, estimation, et prix de chaque option (tâche chiffrée comme dans la réservation). */
export function chiffrer(o, cochees) {
  const br = brouillonPour(o.rubrique_id, champsDepuisObjet(o, cochees));
  const est = estimerBrouillon(br);
  const prixTaches = new Map(tachesChiffrees(br).map(t => [t.id, t.prixC * (o.rubrique_id === "car" ? Math.max(1, br.nombreVehicules || 1) : 1)]));
  return { br, est, total: totalAffiche(est), prixTaches };
}

/* ------------------------------------------------------------------ État (gardé sur l'appareil : la conversation se reprend) */

let etat = null;          // { conversation, objets, cochees: {i: [ids]}, retirees: [{objet, tache, texte}], analyseId, etatIa, questions }
let photos = [];          // { blob, url } (en mémoire seulement)
let consentement = false;
let avertissements = null;
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || "null"); } catch { return null; } };
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* rien */ } };
const vierge = () => ({ conversation: [], objets: [], cochees: {}, retirees: [], analyseId: null, etatIa: "", questions: [], raison: "" });

let noms = new Map();      // « matiere:polyester » → « Polyester » (base de connaissances)
let fiches = new Map();    // « objet:canape_tissu » → entrée complète (matériel), « matiere:lin » → précautions
async function chargerAvertissements() {
  if (avertissements) return avertissements;
  const { data } = await supabase.from("connaissances_ia").select("type, donnees").in("type", ["avertissement", "matiere", "salissure", "objet", "equipement"]).eq("actif", true).then(r => r, () => ({ data: [] }));
  avertissements = new Map((data || []).filter(x => x.type === "avertissement").map(x => [x.donnees.tache, x.donnees.texte]));
  noms = new Map((data || []).filter(x => x.type !== "avertissement").map(x => [`${x.type}:${x.donnees.id}`, x.donnees.nom]));
  fiches = new Map((data || []).filter(x => x.type === "objet" || x.type === "matiere").map(x => [`${x.type}:${x.donnees.id}`, x.donnees]));
  if (fenetre && !fenetre.hidden) rendre();
  return avertissements;
}
/** Ce que la base de connaissances dit d'un objet de la fiche : matériel requis, noms, précautions (pour la demande et le Cleaneur). */
export function connaissancesObjet(o) {
  const obj = fiches.get(`objet:${o.objet_id}`) || {}, mat = fiches.get(`matiere:${o.matiere}`);
  const requis = (obj.equipements || []).filter(id => noms.has(`equipement:${id}`));
  return { equipementsRequis: requis, equipementsNoms: requis.map(id => noms.get(`equipement:${id}`)),
    matiereNom: mat?.nom || "", precautions: mat?.note ? [mat.note] : [],
    salissures: (o.salissures || []).map(x => ({ id: x.id, source: x.source, nom: noms.get(`salissure:${x.id}`) || x.id })) };
}
const nomDe = (type, id) => tr(noms.get(`${type}:${id}`) || String(id || "").replace(/_/g, " "));
const texteAvertissement = (rubriqueId, tacheId) => avertissements?.get(`${rubriqueId}:${tacheId}`)
  || "Sans cette option, le résultat peut être moins complet sur ce point.";

/* ------------------------------------------------------------------ Fenêtre */

let fenetre = null;
/** Ouvre l'assistant. Depuis le centre de réservation : { nouveau, envoyer, photos (fichiers), consentement } — le besoin écrit
 *  sur la page part tout de suite à l'analyse, avec ses photos. */
export async function ouvrirAssistantIA(texteDepart = "", options = {}) {
  etat = options.nouveau ? vierge() : (lire() || vierge());
  if (options.nouveau) { photos.forEach(p => URL.revokeObjectURL(p.url)); photos = []; consentement = false; sauver(); }
  if (options.consentement) consentement = true;
  if (options.bien !== undefined) { etat.bienId = options.bien || ""; sauver(); }
  if (!fenetre) {
    fenetre = document.createElement("div");
    fenetre.className = "fenetre-ia";
    fenetre.setAttribute("role", "dialog"); fenetre.setAttribute("aria-modal", "true"); fenetre.setAttribute("aria-labelledby", "titre-ia");
    document.body.appendChild(fenetre);
    fenetre.addEventListener("click", e => { if (e.target === fenetre) fermer(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && fenetre && !fenetre.hidden) fermer(); });
  }
  fenetre.hidden = false;
  document.body.classList.add("sans-defilement");
  chargerAvertissements().catch(() => null);
  rendre();
  const zone = fenetre.querySelector("[data-saisie]");
  if (texteDepart && zone) zone.value = texteDepart;
  zone?.focus();
  if (options.photos?.length) {
    for (const fichier of options.photos.slice(0, PHOTOS_MAX - photos.length)) {
      const blob = await reduirePhoto(fichier, 1280, 0.7).catch(() => null);
      if (blob) photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    rendre();
  }
  if (options.envoyer && texteDepart) envoyer(texteDepart);
}
function fermer() { if (!fenetre) return; fenetre.hidden = true; document.body.classList.remove("sans-defilement"); }

function bulle(m) {
  return `<div class="bulle-ia ${m.role === "assistant" ? "de-ia" : "du-client"}">${m.role === "assistant" ? `<span class="pastille-ia">${icone("instantane")}</span>` : ""}<p>${esc(m.texte)}</p></div>`;
}

function rendre() {
  const saisie = fenetre.querySelector("[data-saisie]")?.value || "";
  const avecFiche = etat.etatIa === "fiche" && etat.objets.length;
  fenetre.innerHTML = `<div class="panneau-ia${avecFiche ? " avec-fiche" : ""}">
    <header class="tete-ia"><span class="tuile-ia">${icone("instantane")}</span><div><h2 id="titre-ia">${tr("Décrire mon besoin")}</h2>
      <p class="petit muet">${tr("Notre assistant prépare une proposition avec les prestations et les prix réels de Cleaneroo.")}</p></div>
      ${etat.conversation.length ? `<button type="button" class="lien-bouton" data-recommencer>${tr("Recommencer")}</button>` : ""}
      <button type="button" class="fermer-ia" data-fermer aria-label="${tr("Fermer")}">×</button></header>
    <div class="corps-ia">
      <section class="colonne-conversation" aria-label="${tr("Conversation")}">
        <div class="fil-ia" data-fil>${etat.conversation.length ? etat.conversation.map(bulle).join("")
          : `<div class="accueil-ia"><p><b>${tr("Que faut-il nettoyer ?")}</b></p><p class="petit">${tr("Décrivez votre besoin avec vos mots, même sans connaître le nom de la prestation. Ajoutez des photos si vous le pouvez : l'analyse sera plus précise.")}</p>
            <div class="exemples-ia">${["Mon canapé en tissu a plusieurs taches", "Les sièges de ma voiture sont très sales", "Je viens de récupérer une maison à nettoyer entièrement", "Je souhaite faire nettoyer un matelas"].map(x => `<button type="button" class="puce-exemple" data-exemple="${esc(tr(x))}">${tr(x)}</button>`).join("")}</div></div>`}
          ${etat.etatIa === "questions" && etat.questions.length ? `<div class="questions-ia">${etat.questions.map(q => `<div class="question-ia"><p>${esc(q.texte)}</p>
            ${q.choix?.length ? `<div class="choix-rapides">${q.choix.map(c => `<button type="button" class="puce-exemple" data-reponse="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}</div>`).join("")}</div>` : ""}
          ${etat.etatIa === "validation_humaine" ? blocValidationHumaine() : ""}
          <div class="attente-ia" data-attente hidden><span class="point"></span><span class="point"></span><span class="point"></span><span class="petit">${tr("Analyse en cours…")}</span></div>
        </div>
        <form class="saisie-ia" data-formulaire>
          ${photos.length ? `<div class="vignettes-ia">${photos.map((p, i) => `<span class="vignette-ia"><img src="${p.url}" alt=""><button type="button" data-retirer-photo="${i}" aria-label="${tr("Retirer la photo")}">×</button></span>`).join("")}</div>
            <label class="consentement-ia"><input type="checkbox" data-consentement ${consentement ? "checked" : ""}> <span class="petit">${tr("J'accepte que mes photos soient analysées par l'assistant pour préparer ma proposition. Elles ne sont conservées qu'avec ma réservation.")}</span></label>` : ""}
          <textarea data-saisie rows="3" maxlength="2000" placeholder="${esc(tr("Ex. : mon canapé d'angle en tissu a des taches de café…"))}" aria-label="${esc(tr("Décrivez votre besoin"))}"></textarea>
          <div class="actions-saisie">
            <label class="bouton secondaire petit${photos.length >= PHOTOS_MAX ? " desactive" : ""}">${icone("photo")} ${tr("Photos")}<input type="file" accept="image/*" multiple hidden data-photos ${photos.length >= PHOTOS_MAX ? "disabled" : ""}></label>
            ${"webkitSpeechRecognition" in window || "SpeechRecognition" in window ? `<button type="button" class="bouton secondaire petit" data-dicter>${icone("message")} ${tr("Dicter")}</button>` : ""}
            <button type="submit" class="bouton petit" data-envoyer>${tr("Envoyer")}</button>
          </div>
          <p class="erreur" data-erreur-ia></p>
        </form>
      </section>
      ${avecFiche ? `<section class="colonne-fiche" aria-label="${tr("Votre proposition")}">${ficheHtml()}</section>` : ""}
    </div></div>`;
  traduire(fenetre);
  if (saisie) fenetre.querySelector("[data-saisie]").value = saisie;
  brancher();
  const fil = fenetre.querySelector("[data-fil]"); if (fil) fil.scrollTop = fil.scrollHeight;
}

function blocValidationHumaine() {
  return `<div class="carte validation-ia"><b>${icone("equipe")} ${tr("Notre équipe prend le relais")}</b>
    <p class="petit">${esc(etat.raison || tr("Votre demande mérite l'avis d'un spécialiste avant une proposition."))}</p>
    ${etat.supportEnvoye ? `<p>${icone("valide")} ${tr("Demande envoyée")} · <b>${esc(etat.supportEnvoye)}</b></p><p class="petit">${tr("L'équipe vous répond sous 48 h, par e-mail et dans vos notifications.")}</p>`
      : `<form data-support><label class="champ">${tr("Votre e-mail")}<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <button type="submit" class="bouton petit">${tr("Envoyer ma demande à l'équipe")}</button></form>`}</div>`;
}

/* ------------------------------------------------------------------ Fiche */

function ficheHtml() {
  let totalGeneral = 0, devis = false;
  const blocs = etat.objets.map((o, i) => {
    const cochees = etat.cochees[i] || cocheesDepart(o);
    const { est, total, prixTaches } = chiffrer(o, cochees);
    if (total == null) devis = true; else totalGeneral += total;
    const r = rubrique(o.rubrique_id);
    const sources = { photo: "vu sur photo", client: "indiqué par vous", inconnue: "à confirmer" };
    const options = NIVEAUX.map(([niv, nom]) => {
      const liste = (o.options || []).filter(x => x.niveau === niv);
      if (!liste.length) return "";
      return `<div class="groupe-options"><h4>${tr(nom)}</h4>${liste.map(x => {
        const t = r.taches.find(t => t.id === x.tache_id), coche = cochees.includes(x.tache_id), prix = prixTaches.get(x.tache_id);
        const attente = etat.aConfirmer?.objet === i && etat.aConfirmer?.tache === x.tache_id;
        return `<div class="option-ia${coche ? " cochee" : ""}"><label><input type="checkbox" data-option="${i}:${esc(x.tache_id)}" ${coche ? "checked" : ""} ${niv === "obligatoire" ? "disabled" : ""}>
          <span class="nom-option"><b>${esc(tr(t?.nom || x.tache_id))}</b><small>${esc(x.raison)}</small></span><span class="prix-option">${prix != null ? euros(prix) : ""}</span></label>
          ${niv === "obligatoire" ? `<p class="petit muet note-obligatoire">${tr("Nécessaire pour réaliser la prestation en sécurité : à revoir avec l'assistant si vous ne la souhaitez pas.")}</p>` : ""}
          ${attente ? `<div class="avertissement-ia" role="alert"><p>${esc(tr(texteAvertissement(o.rubrique_id, x.tache_id)))}</p>
            <div class="boutons-avertissement"><button type="button" class="bouton petit" data-garder>${tr("Conserver l'option")}</button>
            <button type="button" class="bouton secondaire petit" data-retirer>${tr("Retirer quand même")}</button></div></div>` : ""}</div>`;
      }).join("")}</div>`;
    }).join("");
    const elements = o.rubrique_id === "textiles" ? champsDepuisObjet(o, cochees).panier.map(l => `<li>${esc(tr(libelleLigne(l)))}</li>`).join("") : "";
    return `<article class="carte objet-ia">
      <header>${icone(r.icone, { tuile: true })}<div><h3>${esc(o.libelle)}</h3><p class="petit muet">${esc(tr(r.nom))}</p></div>
        <b class="prix-objet">${total == null ? tr("Sur devis") : euros(total)}</b></header>
      <dl class="diagnostic-ia">
        <div><dt>${tr("Matière")}</dt><dd>${esc(o.matiere && o.matiere !== "inconnue" ? nomDe("matiere", o.matiere) : tr("Non identifiée"))} <span class="source-ia ${o.matiere_source}">${tr(sources[o.matiere_source] || "")}</span></dd></div>
        ${o.salissures?.length ? `<div><dt>${tr("Salissures")}</dt><dd>${o.salissures.map(s => `${esc(nomDe("salissure", s.id))} <span class="source-ia ${s.source}">${tr(sources[s.source] || "")}</span>`).join(", ")}</dd></div>` : ""}
        ${o.vu_sur_photo?.length ? `<div><dt>${tr("Vu sur vos photos")}</dt><dd>${o.vu_sur_photo.map(esc).join(" · ")}</dd></div>` : ""}
        ${o.confirme_par_client?.length ? `<div><dt>${tr("Ce que vous avez indiqué")}</dt><dd>${o.confirme_par_client.map(esc).join(" · ")}</dd></div>` : ""}
      </dl>
      ${elements ? `<ul class="elements-ia">${elements}</ul>` : ""}
      ${options}
      <div class="attendre-ia"><h4>${tr("À quoi vous attendre")}</h4><ul>
        ${o.resultat?.probable ? `<li class="probable">${esc(o.resultat.probable)}</li>` : ""}${o.resultat?.attenue ? `<li class="attenue">${esc(o.resultat.attenue)}</li>` : ""}${o.resultat?.limite ? `<li class="limite">${esc(o.resultat.limite)}</li>` : ""}</ul>
        <p class="petit muet">${tr("Le résultat dépend de l'ancienneté et de la nature des taches : aucune disparition ne peut être garantie.")}</p></div>
      ${est.lignes?.length ? `<details class="detail-prix"><summary>${tr("Détail du prix")}</summary><ul>${est.lignes.map(l => `<li><span>${esc(tr(l.libelle))}</span><span>${euros(l.montantC)}</span></li>`).join("")}</ul></details>` : ""}
    </article>`;
  }).join("");
  const plusieurs = etat.objets.length > 1;
  return `<h3 class="titre-fiche">${icone("document")} ${tr("Votre proposition")}</h3>${blocs}
    <div class="total-ia"><span>${tr(plusieurs ? "Total des prestations" : "Total à payer")}</span><b>${devis && !totalGeneral ? tr("Sur devis") : euros(totalGeneral)}${devis && totalGeneral ? ` + ${tr("devis")}` : ""}</b></div>
    <p class="petit muet">${tr("Prix calculés avec les tarifs Cleaneroo en vigueur, identiques à ceux de la réservation. Payé à la réservation, versé au Cleaneur seulement après votre validation.")}</p>
    <div class="suite-ia"><button type="button" class="bouton plein" data-continuer>${tr("Continuer la réservation")}</button>
      <button type="button" class="lien-bouton" data-modifier-description>${tr("Préciser ma description")}</button></div>`;
}

/* ------------------------------------------------------------------ Événements */

function brancher() {
  const f = fenetre;
  f.querySelector("[data-fermer]").onclick = fermer;
  f.querySelector("[data-recommencer]")?.addEventListener("click", () => { etat = vierge(); photos = []; consentement = false; sauver(); rendre(); });
  f.querySelectorAll("[data-exemple]").forEach(b => b.onclick = () => { const z = f.querySelector("[data-saisie]"); z.value = b.dataset.exemple; z.focus(); });
  // Une seule question : la réponse part tout de suite. Plusieurs : chaque choix s'ajoute à la réponse, envoyée avec « Envoyer ».
  f.querySelectorAll("[data-reponse]").forEach(b => b.onclick = () => {
    if (etat.questions.length < 2) return envoyer(b.dataset.reponse);
    const q = b.closest(".question-ia"), z = f.querySelector("[data-saisie]");
    q.querySelectorAll("[data-reponse]").forEach(x => x.classList.toggle("choisie", x === b));
    z.value = [...f.querySelectorAll(".question-ia")].map(x => { const c = x.querySelector(".choisie"); return c ? `${x.querySelector("p").textContent} ${c.dataset.reponse}` : ""; }).filter(Boolean).join("\n");
  });
  f.querySelector("[data-consentement]")?.addEventListener("change", e => { consentement = e.target.checked; });
  f.querySelectorAll("[data-retirer-photo]").forEach(b => b.onclick = () => { URL.revokeObjectURL(photos[+b.dataset.retirerPhoto].url); photos.splice(+b.dataset.retirerPhoto, 1); rendre(); });
  f.querySelector("[data-photos]")?.addEventListener("change", async e => {
    for (const fichier of [...e.target.files].slice(0, PHOTOS_MAX - photos.length)) {
      const blob = await reduirePhoto(fichier, 1280, 0.7).catch(() => null);
      if (blob) photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    rendre();
  });
  f.querySelector("[data-dicter]")?.addEventListener("click", dicter);
  f.querySelector("[data-formulaire]").onsubmit = e => { e.preventDefault(); envoyer(f.querySelector("[data-saisie]").value); };
  f.querySelector("[data-saisie]").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(e.target.value); } });
  f.querySelectorAll("[data-option]").forEach(c => c.onchange = () => {
    const [i, t] = c.dataset.option.split(":"), o = etat.objets[+i], x = o.options.find(y => y.tache_id === t);
    const liste = new Set(etat.cochees[i] || cocheesDepart(o));
    if (c.checked) { liste.add(t); etat.retirees = etat.retirees.filter(r => !(r.objet === +i && r.tache === t)); etat.aConfirmer = null; }
    else if (x?.niveau === "recommandee") { etat.aConfirmer = { objet: +i, tache: t }; sauver(); return rendre(); }
    else liste.delete(t);
    etat.cochees[i] = [...liste]; sauver(); rendre();
  });
  f.querySelector("[data-garder]")?.addEventListener("click", () => { etat.aConfirmer = null; sauver(); rendre(); });
  f.querySelector("[data-retirer]")?.addEventListener("click", () => {
    const { objet, tache } = etat.aConfirmer, o = etat.objets[objet];
    etat.cochees[objet] = (etat.cochees[objet] || cocheesDepart(o)).filter(t => t !== tache);
    etat.retirees.push({ objet, rubrique: o.rubrique_id, tache, avertissement: texteAvertissement(o.rubrique_id, tache), le: new Date().toISOString() });
    etat.aConfirmer = null; sauver(); rendre();
  });
  f.querySelector("[data-modifier-description]")?.addEventListener("click", () => f.querySelector("[data-saisie]").focus());
  f.querySelector("[data-continuer]")?.addEventListener("click", () => import("./assistant-ia-reservation.js").then(m => m.continuerVersReservation(etat, photos, fermer)));
  f.querySelector("[data-support]")?.addEventListener("submit", envoyerSupport);
  session().then(async s => { const p = s ? await monProfil().catch(() => null) : null; const champ = f.querySelector("[data-support] [name=email]"); if (champ && p?.email) champ.value = p.email; }).catch(() => null);
}

function dicter() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return;
  const rec = new R(), z = fenetre.querySelector("[data-saisie]"), b = fenetre.querySelector("[data-dicter]");
  rec.lang = { fr: "fr-FR", en: "en-GB", it: "it-IT", es: "es-ES" }[langue] || "fr-FR";
  rec.interimResults = true;
  const depart = z.value ? z.value.trim() + " " : "";
  rec.onresult = e => { z.value = depart + [...e.results].map(r => r[0].transcript).join(""); };
  rec.onend = () => { b.classList.remove("ecoute"); };
  b.classList.add("ecoute"); rec.start();
}

const enBase64 = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); });

async function envoyer(texte) {
  texte = String(texte || "").trim();
  const err = fenetre.querySelector("[data-erreur-ia]");
  if (texte.length < 3) { err.textContent = tr("Décrivez votre besoin en quelques mots."); return; }
  if (photos.length && !consentement) { err.textContent = tr("Cochez l'accord pour l'analyse des photos, ou retirez-les."); return; }
  etat.conversation.push({ role: "client", texte });
  fenetre.querySelector("[data-saisie]").value = "";
  etat.questions = []; sauver(); rendre();
  fenetre.querySelector("[data-attente]").hidden = false;
  fenetre.querySelectorAll("[data-envoyer], [data-saisie]").forEach(x => x.disabled = true);
  try {
    const corps = { langue, conversation: etat.conversation, consentement_photos: consentement,
      photos: photos.length ? await Promise.all(photos.map(p => enBase64(p.blob))) : [] };
    const { data, error } = await supabase.functions.invoke("besoin-ia", { body: corps });
    const rep = data || (error?.context ? await error.context.json().catch(() => null) : null) || {};
    if (rep.erreur === "limite") throw new Error(tr("Vous avez fait beaucoup d'analyses : réessayez dans une heure, ou réservez directement."));
    if (rep.etat === "indisponible" || rep.etat === "erreur" || !rep.etat) throw new Error(tr("L'assistant est momentanément indisponible. Réessayez dans quelques minutes, ou réservez directement."));
    etat.conversation.push({ role: "assistant", texte: rep.message || "" });
    etat.etatIa = rep.etat; etat.questions = rep.questions || []; etat.raison = rep.raison_validation_humaine || "";
    etat.analyseId = rep.analyse_id || etat.analyseId;
    if (rep.etat === "fiche") { etat.objets = rep.objets || []; etat.cochees = {}; etat.retirees = []; etat.aConfirmer = null; }
    sauver(); rendre();
  } catch (e) {
    etat.conversation.pop(); sauver(); rendre();
    const z = fenetre.querySelector("[data-saisie]"); z.value = texte;
    fenetre.querySelector("[data-erreur-ia]").textContent = e.message || tr("L'assistant est momentanément indisponible.");
  }
}

async function envoyerSupport(e) {
  e.preventDefault();
  const f = e.target, email = f.email.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return;
  const s = await session().catch(() => null), p = s ? await monProfil().catch(() => null) : null;
  const d = new Date(), numero = `SUP-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const ligne = { numero, email, prenom: p?.prenom || null, espace: s ? "client" : "visiteur", categorie: "Cleaneroo AI · avis de l'équipe",
    resume: `${etat.conversation.filter(m => m.role === "client").map(m => m.texte).join("\n")}\n\nRaison : ${etat.raison}${etat.analyseId ? `\nAnalyse : ${etat.analyseId}` : ""}`.slice(0, 4000),
    conversation: etat.conversation.slice(-30) };
  if (s) ligne.auteur = s.user.id;
  const { error } = await supabase.from("demandes_support").insert(ligne);
  if (error) { f.querySelector("button").textContent = tr("Réessayer"); return; }
  supabase.functions.invoke("support", { body: { numero } }).catch(() => null);
  etat.supportEnvoye = numero; sauver(); rendre();
}
