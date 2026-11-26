// Parrainage et cagnottes (7 novembre 2026) : code et lien à partager, cagnotte de l'espace ouvert, filleuls, saisie d'un code.
// Même écran dans l'appli (Parrainage.kt). Base : outils/base-parrainage.sql (récompenses versées par la base, jamais par l'écran).
import { REGLES, euros, dateCourte } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { supabase } from "./donnees.js";
import { icone } from "./icones.js";

const CLE = "cleaneroo-parrain";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Code reçu par un lien, gardé sur l'appareil jusqu'à l'inscription : ?parrain=CODE (parrainage), ?code=CODE (partenaire, plan de
 *  démarchage du 22/11/2026) ou ?client=CODE (« Inviter mon client » d'un Cleaneur). La base reconnaît lequel (origine_profil).
 *  ?utm_source=… : canal d'origine (publicité, réseau social…). */
export function memoriserCodeParrain() {
  const q = location.search + location.hash;
  const m = q.match(/[?&](?:parrain|code|client)=([A-Za-z0-9-]{3,20})/);
  if (m) try { localStorage.setItem(CLE, m[1].toUpperCase()); } catch { /* rien */ }
  const c = q.match(/[?&]utm_source=([A-Za-z0-9_.-]{2,40})/);
  if (c) try { localStorage.setItem("cleaneroo-canal", c[1].toLowerCase()); } catch { /* rien */ }
}
/** Lien « Inviter mon client » d'un Cleaneur : son client arrive sur la création de compte avec le code déjà rempli. */
export const lienInviterClient = code => `${location.origin}/?client=${encodeURIComponent(code)}#/compte/creer`;
export function codeParrainMemorise() { try { return localStorage.getItem(CLE) || ""; } catch { return ""; } }
export function oublierCodeParrain() { try { localStorage.removeItem(CLE); } catch { /* rien */ } }
export const lienParrainage = code => `${location.origin}/?parrain=${encodeURIComponent(code)}`;

/** Champ « Code de parrainage (facultatif) » des formulaires d'inscription, prérempli par le lien reçu. */
export const champCodeParrain = () => `<label class="champ">Code de parrainage (facultatif)
  <input name="code_parrain" maxlength="20" autocapitalize="characters" autocomplete="off" value="${esc(codeParrainMemorise())}"></label>`;

export async function monParrainage() {
  const { data, error } = await supabase.rpc("mon_parrainage");
  if (error) throw new Error(error.message);
  // Parrainage sans trésorerie (26/11/2026) : avantages en frais de service ou commission offerts (base-parrainage-sans-tresorerie.sql).
  const av = await supabase.rpc("mes_avantages").then(r => r.data, () => null);
  return data ? { ...data, avantages: av || {} } : data;
}
const utiliserCode = async code => {
  const { data, error } = await supabase.rpc("utiliser_code_parrainage", { p_code: code });
  if (error) throw new Error(error.message);
  return data;
};

/** Ligne de texte avec montants : morceaux traduits, montants laissés tels quels. */
const ligne = parts => parts.map(x => (typeof x === "string" ? tr(x) : x.v)).join(" ");
const m = v => ({ v });

/** Ce que rapporte un parrainage, selon l'espace ouvert (26/11/2026 : jamais d'argent, des frais ou une commission offerts). */
function gains(espace) {
  const N = REGLES.PARRAINAGE_MISSIONS_CLEANEUR;
  if (espace === "cleaneur") return [
    ["Cleaneur parrainé : après ses", m(N), "premières missions, vous gagnez", m(3), "missions sans commission et vous voyez les nouvelles missions 10 minutes avant les autres pendant 1 mois"],
    ["Client parrainé : ses", m(3), "premières réservations sans frais de service"],
  ];
  const base = [
    ["Votre filleul : ses", m(3), "premières réservations sans frais de service"],
    ["Vous : 1 réservation sans frais de service à sa 1re prestation, puis", m(2), "de plus à sa 3e"],
    ["Ambassadeur : 3 filleuls récompensés, plus aucuns frais de service pendant 3 mois ; 10 filleuls, pendant 12 mois"],
  ];
  if (espace === "pro") base.push(["Conciergerie parrainée :", m(REGLES.PARRAINAGE_MOIS_CONCIERGERIE), "mois d'abonnement offert à chacune, après sa 1re prestation"]);
  base.push(["Vous faites venir un Cleaneur :", m(3), "réservations sans frais de service, après ses", m(N), "missions terminées"]);
  base.push(["Un voisin à parrainer ? Réservez le même jour : vos créneaux ressortent en « tournée », et un même Cleaneur peut enchaîner"]);
  return base;
}
/** Carte « Mes avantages » : ce qui reste à utiliser (frais offerts, missions sans commission, Ambassadeur, avance). */
function carteAvantages(d, espace) {
  const a = d.avantages || {};
  const lignes = [];
  if (espace === "cleaneur") {
    lignes.push(`<b class="solde">${a.commission || 0}</b><span class="petit">${tr((a.commission || 0) > 1 ? "missions sans commission" : "mission sans commission")}</span>`);
    if (a.avance_jusqu) lignes.push(`<span class="tampon vert">${tr("10 min d'avance sur les nouvelles missions jusqu'au")} ${dateCourte(new Date(a.avance_jusqu))}</span>`);
  } else if (a.ambassadeur_jusqu) {
    lignes.push(`<b class="solde">${tr("Ambassadeur")}</b><span class="petit">${tr("Aucuns frais de service jusqu'au")} ${dateCourte(new Date(a.ambassadeur_jusqu))}</span>`);
  } else {
    lignes.push(`<b class="solde">${a.frais || 0}</b><span class="petit">${tr((a.frais || 0) > 1 ? "réservations sans frais de service" : "réservation sans frais de service")}</span>`);
  }
  if (a.abonne && espace !== "cleaneur") lignes.push(`<span class="petit">${tr("Vous êtes déjà à 0 % de frais de service : vos avantages sont gardés pour plus tard.")}</span>`);
  if (a.expire_le) lignes.push(`<span class="petit">${tr("Valables 12 mois · prochaine échéance le")} ${dateCourte(new Date(a.expire_le))}</span>`);
  if (espace === "pro" && d.mois_offerts > 0) lignes.push(`<span class="tampon vert">${d.mois_offerts} ${tr("mois d'abonnement offerts")}</span>`);
  return `<div class="carte cagnotte"><span class="petit">${tr("Mes avantages")}</span>${lignes.join("")}</div>`;
}

const STATUTS = { en_attente: ["En attente", ""], recompense: ["Récompensé", " vert"], refuse: ["Refusé", " gris"], plafond: ["Plafond annuel atteint", " gris"] };
const MOTIFS = { parrainage: "Parrainage", prime_parrainage: "Prime de parrainage", utilisation: "Utilisée pour une prestation", remboursement: "Rendue après annulation" };

/** Bloc complet pour l'espace ouvert (« particulier », « pro » ou « cleaneur »). d : réponse de mon_parrainage (null = indisponible). */
export function blocParrainage(d, espace) {
  if (!d?.code) return "";
  const solde = d.soldes?.[espace] || 0;
  const mouvements = (d.mouvements || []).filter(x => x.espace === espace).slice(0, 5);
  return `<h2 class="titre-section">${icone("cadeau", { tuile: true })}${tr("Parrainage")}</h2>
  <div class="parrainage" id="parrainage">
    ${espace !== "cleaneur" && (d.avantages?.frais || 0) > 0 && d.a_un_parrain ? `<div class="note bienvenue-parrain"><span>${ligne(["Bienvenue. Vos", m(d.avantages.frais), "prochaines réservations sont sans frais de service"])}</span></div>` : ""}
    <div class="cartes-parrainage">
      ${carteAvantages(d, espace)}
      <div class="carte code-parrain">
        <span class="petit">${tr("Votre code de parrainage")}</span>
        <b class="code">${esc(d.code)}</b>
        <div class="actions-code"><button type="button" class="bouton" data-partager>${tr("Partager")}</button>
          <a class="bouton secondaire" data-whatsapp target="_blank" rel="noopener">${tr("WhatsApp")}</a>
          <button type="button" class="bouton secondaire" data-copier>${tr("Copier le lien")}</button></div>
        <span class="petit" data-copie-ok></span>
      </div>
    </div>
    <ul class="gains-parrainage">${gains(espace).map(g => `<li>${ligne(g)}</li>`).join("")}</ul>
    <p class="petit">${ligne(["Avantages gagnés une fois la prestation terminée, valables 12 mois, jamais convertibles en argent ·", m(REGLES.PARRAINAGE_MAX_PAR_AN), "filleuls récompensés par an au maximum · pas de parrainage dans un même foyer"])}</p>
    <details class="carte"><summary>${tr("Mes filleuls")} (${(d.filleuls || []).length})</summary>
      ${(d.filleuls || []).length ? `<ul class="liste-filleuls">${d.filleuls.map(f => `<li><span>${esc(f.prenom || "—")} <span class="petit">${dateCourte(new Date(f.cree_le))}</span></span>
        <span class="tampon${STATUTS[f.statut]?.[1] || ""}">${tr(STATUTS[f.statut]?.[0] || f.statut)}</span></li>`).join("")}</ul>`
        : `<p class="petit">${tr("Aucun filleul pour l'instant. Partagez votre code pour en parrainer.")}</p>`}
      ${mouvements.length ? `<p class="titre-liste">${tr("Historique")}</p><ul class="liste-filleuls">${mouvements.map(x => `<li><span>${tr(MOTIFS[x.motif] || x.motif)} <span class="petit">${dateCourte(new Date(x.cree_le))}</span></span>
        <b class="${x.montant_c < 0 ? "" : "positif"}">${x.montant_c < 0 ? "−" : "+"}${euros(Math.abs(x.montant_c))}</b></li>`).join("")}</ul>` : ""}
    </details>
    ${d.peut_saisir_code ? `<form class="carte saisie-code" data-saisie-code novalidate>
      <label class="champ">${tr("Vous avez un code de parrainage ?")}<input name="code" maxlength="20" autocapitalize="characters" autocomplete="off" value="${esc(codeParrainMemorise())}"></label>
      <button class="bouton secondaire" type="submit">${tr("Valider le code")}</button><p class="erreur" data-erreur-code></p></form>` : ""}
  </div>`;
}

const ERREURS_CODE = {
  introuvable: "Ce code n'existe pas.",
  soi_meme: "Vous ne pouvez pas utiliser votre propre code.",
  deja: "Un code de parrainage est déjà enregistré sur votre compte.",
  trop_tard: "Le code se saisit dans les 30 jours après l'inscription, avant votre première demande.",
};

export function brancherParrainage(racine, d, recharger = () => {}) {
  const bloc = racine.querySelector("#parrainage");
  if (!bloc || !d?.code) return;
  const lien = lienParrainage(d.code);
  const message = `${tr("Avec mon code")} ${d.code}${tr(", tes 3 premières réservations Cleaneroo sont sans frais de service :")} ${lien}`;
  const wa = bloc.querySelector("[data-whatsapp]");
  if (wa) wa.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const copier = async () => {
    try { await navigator.clipboard.writeText(message); bloc.querySelector("[data-copie-ok]").textContent = tr("Lien copié ✓"); }
    catch { prompt(tr("Copiez ce lien :"), lien); }
  };
  bloc.querySelector("[data-copier]").onclick = copier;
  bloc.querySelector("[data-partager]").onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Cleaneroo", text: message, url: lien }); return; } catch { return; } }
    copier();
  };
  const f = bloc.querySelector("[data-saisie-code]");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("[data-erreur-code]"), code = f.code.value.trim().toUpperCase();
    if (!code) return;
    f.querySelector("[type=submit]").disabled = true;
    const r = await utiliserCode(code).catch(() => "erreur");
    if (r === "ok") { oublierCodeParrain(); recharger(); return; }
    f.querySelector("[type=submit]").disabled = false;
    err.textContent = tr(ERREURS_CODE[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
  traduire(bloc);
}
