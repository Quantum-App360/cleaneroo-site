// Formations et qualifications des Cleaneurs (12 novembre 2026, reprises de l'appli iPhone de Vincent).
// 20 modules : 14 se valident par un quiz (corrigé par le serveur, qui seul connaît les bonnes réponses),
// 6 réglementés se valident sur attestation (document vérifié par l'administration).
// Une mission n'est proposée qu'aux Cleaneurs qualifiés pour sa prestation, son type de lieu et ses tâches (qualificationsRequises).
// Textes en 4 langues : assets/data/formations.json, fabriqué par outils/formations/generer.py (même fichier dans l'appli).
// Même écran dans l'appli (Formations.kt). Base : outils/base-formations.sql.
import { supabase, deposerDocument } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { qualificationsRequises } from "./regles.js";
import { tr, traduire, langue } from "./langue.js";
import { esc } from "./commun.js";

const CATEGORIES = [["obligatoire", "Obligatoire pour tous"], ["prestations", "Prestations"], ["techniques", "Techniques et équipements"], ["attestation", "Sur attestation"]];
const ICONES = { socle: "🛡️", domicile: "🏠", location: "🔑", vitres: "🪟", hauteur: "🪜", "remise-etat": "🔨", "cuisine-pro": "🍳", haccp: "📋",
  auto: "🚗", polissage: "✨", textiles: "🛋️", "locaux-pro": "🏢", machines: "⚙️", bionettoyage: "⚕️", exterieurs: "💧", evenementiel: "🎉",
  biocides: "🧪", nuisibles: "🐞", electrique: "⚡", specialise: "🦺" };
const RUBRIQUES_TOUTES = ["home", "rental", "moving", "car", "textiles", "construction", "kitchen", "office", "commerce", "communal", "windows", "outdoor", "event", "special"];

let catalogue = null;
/** Catalogue des formations (une seule lecture par page). */
export async function chargerFormations() {
  if (!catalogue) catalogue = fetch(new URL("../data/formations.json", import.meta.url)).then(r => r.json()).catch(() => { catalogue = null; return []; });
  return catalogue;
}
/** Textes d'un module dans la langue choisie (français si absent). */
export const textes = m => m[langue] || m.fr;

/** Rubriques que débloque un module (noms traduits par le catalogue). */
export function debloque(id) {
  // Types de lieu qui changent les formations exigées (cuisine de particulier ou d'établissement, cabinet médical, nuisibles).
  const types = { kitchen: ["particulier", "restaurant"], office: ["bureaux", "medical"], special: ["rats", "desinfection"] };
  const noms = RUBRIQUES_TOUTES.filter(r => (types[r] || [""]).some(t => qualificationsRequises(r, t).includes(id)))
    .map(r => rubrique(r)?.nom).filter(Boolean);
  return id === "socle" ? [tr("Toutes les missions")] : noms;
}

const STATUTS = { VALIDEE: ["Validée", "ok"], A_VERIFIER: ["En vérification", "attente"], REFUSEE: ["Refusée", "non"], ECHOUEE: ["À refaire", "non"] };
const pastille = s => { const [t, c] = STATUTS[s] || ["À faire", ""]; return `<span class="pastille-formation ${c}">${tr(t)}</span>`; };

/** Section « Mes formations » du tableau de bord du Cleaneur. */
export async function blocFormations(boite) {
  if (!boite) return;
  styles();
  const [cat, etats, manquantes] = await Promise.all([chargerFormations(), supabase.rpc("mes_formations").then(r => r.data || []),
    supabase.rpc("formations_manquantes").then(r => r.data || [])]);
  if (!boite.isConnected || !cat.length) return;
  const statut = Object.fromEntries(etats.map(e => [e.module, e.statut]));
  const validees = cat.filter(m => statut[m.id] === "VALIDEE").length;
  const aFaire = cat.filter(m => manquantes.includes(m.id));
  boite.innerHTML = `<h2 class="titre-section">🎓 ${tr("Mes formations")}</h2>
    <div class="carte teintee">
      <b>${validees} ${tr(validees > 1 ? "formations validées sur" : "formation validée sur")} ${cat.length}</b>
      <div class="jauge-formation"><i style="width:${Math.round(100 * validees / cat.length)}%"></i></div>
      <p class="petit" style="margin:6px 0 0">${tr("Chaque formation débloque des missions. Sans elle, les missions concernées ne vous sont pas proposées.")}</p>
      ${aFaire.length ? `<p class="petit" style="margin:10px 0 6px"><b>${tr("À faire pour les prestations de votre profil :")}</b></p>
        <div class="formations-a-faire">${aFaire.map(m => `<button type="button" class="bouton" data-formation="${m.id}">${ICONES[m.id] || ""} ${esc(textes(m).titre)}</button>`).join("")}</div>` : ""}
    </div>
    ${CATEGORIES.map(([c, nom]) => `<h3 class="sous-titre-formation">${tr(nom)}</h3>
      <div class="grille-formations">${cat.filter(m => m.categorie === c).map(m => `<button type="button" class="carte carte-formation" data-formation="${m.id}">
        <span class="icone-formation" aria-hidden="true">${ICONES[m.id] || "🎓"}</span>
        <span class="nom-formation"><b>${esc(textes(m).titre)}</b><small>${tr("Débloque :")} ${esc(debloque(m.id).join(" · ") || tr("missions avec cet équipement"))}</small></span>
        ${pastille(statut[m.id])}</button>`).join("")}</div>`).join("")}
    <dialog class="fenetre-formation" aria-labelledby="titre-formation"></dialog>`;
  traduire(boite);
  const fenetre = boite.querySelector(".fenetre-formation");
  boite.querySelectorAll("[data-formation]").forEach(b => b.onclick = () => ouvrir(fenetre, cat.find(m => m.id === b.dataset.formation), statut[b.dataset.formation], () => blocFormations(boite)));
}

const liste = (titre, icone, lignes, classe) => lignes.length ? `<div class="bloc-formation ${classe}"><b>${icone} ${tr(titre)}</b>
  <ul>${lignes.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>` : "";

/** Fiche d'un module : bons gestes, bons produits, sécurité, puis quiz ou attestation. */
function ouvrir(fenetre, m, statut, apres) {
  const t = textes(m);
  fenetre.innerHTML = `<form method="dialog" class="haut-formation"><h2 id="titre-formation">${ICONES[m.id] || ""} ${esc(t.titre)}</h2>
      <button class="fermer" aria-label="${tr("Fermer")}">✕</button></form>
    <div class="corps-formation">
      <p>${esc(t.resume)}</p>
      <p class="petit">🔓 ${tr("Débloque :")} ${esc(debloque(m.id).join(" · ") || tr("missions avec cet équipement"))} ${pastille(statut)}</p>
      ${liste("Les bons gestes", "✋", t.gestes, "gestes")}
      ${liste("Les bons produits", "🧴", t.produits, "produits")}
      ${liste("Sécurité", "⚠️", t.securite, "securite")}
      <div class="validation-formation"></div>
    </div>`;
  traduire(fenetre.querySelector(".haut-formation"));
  const zone = fenetre.querySelector(".validation-formation");
  if (m.externe) attestation(zone, m, t, statut, apres); else quiz(zone, m, t, statut, apres);
  fenetre.querySelector(".corps-formation").querySelectorAll(".bloc-formation b, .petit").forEach(e => traduire(e));
  fenetre.showModal();
  fenetre.scrollTop = 0;
}

function quiz(zone, m, t, statut, apres) {
  if (statut === "VALIDEE") { zone.innerHTML = `<p class="note succes-formation">✅ ${tr("Formation validée : les missions concernées vous sont proposées.")}</p>`; traduire(zone); return; }
  const choix = new Array(t.quiz.length).fill(null);
  zone.innerHTML = `<h3>❓ ${tr("Quiz de validation")} · ${t.quiz.length} ${tr("questions")}</h3>
    <p class="petit">${tr("Toutes les réponses doivent être justes. Vous pouvez recommencer autant de fois que nécessaire.")}</p>
    ${t.quiz.map((q, i) => `<fieldset class="question-formation" data-q="${i}"><legend>${i + 1}. ${esc(q.q)}</legend>
      ${q.options.map((o, k) => `<label><input type="radio" name="q${m.id}-${i}" value="${k}"> ${esc(o)}</label>`).join("")}
      <p class="explication-formation" hidden>✗ ${esc(q.explication)}</p></fieldset>`).join("")}
    <p class="erreur" data-erreur-quiz></p>
    <button type="button" class="bouton" data-valider-quiz disabled>${tr("Valider mes réponses")}</button>`;
  traduire(zone.querySelector("h3")); traduire(zone.querySelector(".petit")); traduire(zone.querySelector("[data-valider-quiz]"));
  const bouton = zone.querySelector("[data-valider-quiz]");
  zone.querySelectorAll("input[type=radio]").forEach(r => r.onchange = () => {
    choix[Number(r.closest("[data-q]").dataset.q)] = Number(r.value);
    bouton.disabled = choix.includes(null);
  });
  bouton.onclick = async () => {
    bouton.disabled = true;
    const err = zone.querySelector("[data-erreur-quiz]");
    const { data, error } = await supabase.rpc("passer_quiz", { p_module: m.id, p_reponses: choix });
    bouton.disabled = false;
    if (error || !data) { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    zone.querySelectorAll(".explication-formation").forEach((p, i) => { p.hidden = !data.fausses.includes(i); });
    zone.querySelectorAll("[data-q]").forEach((f, i) => f.classList.toggle("fausse", data.fausses.includes(i)));
    if (data.valide) {
      zone.innerHTML = `<p class="note succes-formation">🎉 <b>${tr("Bravo, formation validée !")}</b> ${tr("Les missions concernées vous sont maintenant proposées.")}</p>`;
      traduire(zone);
      apres();
    } else {
      err.textContent = `${data.fausses.length} ${tr(data.fausses.length > 1 ? "réponses à revoir. Relisez la fiche et réessayez." : "réponse à revoir. Relisez la fiche et réessayez.")}`;
      zone.querySelector(".fausse")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
}

function attestation(zone, m, t, statut, apres) {
  const etat = { VALIDEE: `<p class="note succes-formation">✅ ${tr("Attestation vérifiée par Cleaneroo.")}</p>`,
    A_VERIFIER: `<p class="note">⏳ ${tr("Attestation envoyée : vérification par l'équipe Cleaneroo sous 48 h ouvrées.")}</p>`,
    REFUSEE: `<p class="erreur">${tr("Attestation refusée : document illisible ou non conforme. Envoyez une nouvelle version.")}</p>` }[statut] || "";
  zone.innerHTML = `<h3>📄 ${tr("Justificatifs officiels à fournir")}</h3>
    <p class="petit">${tr("Cette qualification ne s'obtient pas par un quiz : la réglementation exige une formation reconnue.")}</p>
    <ul>${t.documents.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
    ${etat}
    ${statut === "VALIDEE" || statut === "A_VERIFIER" ? "" : `<label class="bouton">${tr("Ajouter mon attestation (PDF ou photo)")}
      <input type="file" accept="application/pdf,image/*" hidden data-attestation></label><p class="erreur" data-erreur-attestation></p>`}`;
  [...zone.querySelectorAll("h3, .petit, .note, .erreur, label.bouton")].forEach(e => traduire(e));
  zone.querySelector("[data-attestation]")?.addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    const err = zone.querySelector("[data-erreur-attestation]");
    err.textContent = tr("Envoi en cours…");
    try { await deposerDocument(m.document, f); attestation(zone, m, t, "A_VERIFIER", apres); apres(); }
    catch (x) { err.textContent = x.message; }
  });
}

/** Nom d'un document d'attestation (gestion) : « Attestation · Travail en hauteur ». */
export async function nomsAttestations() {
  const cat = await chargerFormations();
  return Object.fromEntries(cat.filter(m => m.document && m.document !== "certibiocide").map(m => [m.document, `Attestation · ${m.fr.titre}`]));
}

function styles() {
  if (document.getElementById("styles-formations")) return;
  const s = document.createElement("style");
  s.id = "styles-formations";
  s.textContent = `
    .jauge-formation{height:8px;border-radius:99px;background:var(--fond-doux,#E8F4F2);margin-top:8px;overflow:hidden}
    .jauge-formation i{display:block;height:100%;background:var(--succes,#1F8A80);border-radius:99px;transition:width .6s}
    .formations-a-faire{display:flex;flex-wrap:wrap;gap:8px}
    .sous-titre-formation{font-size:.95rem;margin:18px 0 8px;color:var(--texte-doux,#5B6B73)}
    .grille-formations{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
    .carte-formation{display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;width:100%;font:inherit;color:inherit;margin:0}
    .carte-formation:hover{border-color:var(--primaire,#1F8A80)}
    .icone-formation{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:1.3rem;background:rgba(31,138,128,.1)}
    .nom-formation{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .nom-formation small{color:var(--texte-doux,#5B6B73);font-size:.78rem;line-height:1.3}
    .pastille-formation{flex:none;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:99px;background:#EEF1F2;color:#5B6B73;white-space:nowrap}
    .pastille-formation.ok{background:#DDF3EE;color:#16756C}.pastille-formation.attente{background:#FFF1D6;color:#9A6200}.pastille-formation.non{background:#FDE3DE;color:#B3361F}
    .fenetre-formation{width:min(720px,calc(100vw - 24px));max-height:calc(100vh - 32px);padding:0;border:none;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .fenetre-formation::backdrop{background:rgba(16,40,44,.45)}
    .haut-formation{position:sticky;top:0;display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--fond,#fff);border-bottom:1px solid #E3E9EA;z-index:1}
    .haut-formation h2{flex:1;margin:0;font-size:1.15rem}
    .haut-formation .fermer{border:none;background:none;font-size:1.2rem;cursor:pointer;padding:6px}
    .corps-formation{padding:16px 18px 22px}
    .bloc-formation{border-radius:12px;padding:12px 14px;margin:10px 0;background:#F4F8F8}
    .bloc-formation ul{margin:6px 0 0;padding-left:20px}.bloc-formation li{margin:4px 0}
    .bloc-formation.securite{background:#FDF1EE}.bloc-formation.produits{background:#EEF4FB}
    .question-formation{border:1px solid #E3E9EA;border-radius:12px;padding:10px 14px;margin:10px 0}
    .question-formation legend{font-weight:700;padding:0 4px}
    .question-formation label{display:flex;gap:8px;align-items:flex-start;padding:6px 0;cursor:pointer}
    .question-formation.fausse{border-color:#E0654B;background:#FFF7F5}
    .explication-formation{color:#B3361F;font-size:.88rem;margin:6px 0 0}
    .succes-formation{color:#16756C}
    @media (prefers-color-scheme:dark){.bloc-formation{background:rgba(255,255,255,.06)}.bloc-formation.securite{background:rgba(224,101,75,.12)}
      .bloc-formation.produits{background:rgba(80,140,220,.12)}.question-formation.fausse{background:rgba(224,101,75,.1)}}`;
  document.head.appendChild(s);
}
