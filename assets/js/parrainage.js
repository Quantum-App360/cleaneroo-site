// Parrainage et cagnottes (7 novembre 2026) : code et lien à partager, cagnotte de l'espace ouvert, filleuls, saisie d'un code.
// Même écran dans l'appli (Parrainage.kt). Base : outils/base-parrainage.sql (récompenses versées par la base, jamais par l'écran).
import { REGLES, euros, dateCourte } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { supabase } from "./donnees.js";
import { icone } from "./icones.js";

const CLE = "cleaneroo-parrain";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Code reçu par un lien (?parrain=CODE), gardé sur l'appareil jusqu'à l'inscription. */
export function memoriserCodeParrain() {
  const m = (location.search + location.hash).match(/[?&]parrain=([A-Za-z0-9-]{4,20})/);
  if (m) try { localStorage.setItem(CLE, m[1].toUpperCase()); } catch { /* rien */ }
}
export function codeParrainMemorise() { try { return localStorage.getItem(CLE) || ""; } catch { return ""; } }
export function oublierCodeParrain() { try { localStorage.removeItem(CLE); } catch { /* rien */ } }
export const lienParrainage = code => `${location.origin}/?parrain=${encodeURIComponent(code)}`;

/** Champ « Code de parrainage (facultatif) » des formulaires d'inscription, prérempli par le lien reçu. */
export const champCodeParrain = () => `<label class="champ">Code de parrainage (facultatif)
  <input name="code_parrain" maxlength="20" autocapitalize="characters" autocomplete="off" value="${esc(codeParrainMemorise())}"></label>`;

export async function monParrainage() {
  const { data, error } = await supabase.rpc("mon_parrainage");
  if (error) throw new Error(error.message);
  return data;
}
const utiliserCode = async code => {
  const { data, error } = await supabase.rpc("utiliser_code_parrainage", { p_code: code });
  if (error) throw new Error(error.message);
  return data;
};

/** Ligne de texte avec montants : morceaux traduits, montants laissés tels quels. */
const ligne = parts => parts.map(x => (typeof x === "string" ? tr(x) : x.v)).join(" ");
const m = v => ({ v });

/** Ce que rapporte un parrainage, selon l'espace ouvert. */
function gains(espace) {
  const N = REGLES.PARRAINAGE_MISSIONS_CLEANEUR;
  if (espace === "cleaneur") return [
    ["Cleaneur parrainé :", m(euros(REGLES.PARRAINAGE_PRIME_CLEANEUR_C)), "de prime pour vous, après", m(N), "missions terminées"],
    ["Client parrainé :", m(euros(REGLES.PARRAINAGE_FILLEUL_C)), "de remise pour lui sur sa 1re prestation, dès", m(euros(REGLES.PARRAINAGE_MIN_COMMANDE_C))],
  ];
  const base = [
    ["Votre filleul :", m(euros(REGLES.PARRAINAGE_FILLEUL_C)), "de remise sur sa 1re prestation, dès", m(euros(REGLES.PARRAINAGE_MIN_COMMANDE_C))],
    ["Vous :", m(euros(REGLES.PARRAINAGE_PARRAIN_C)), "dans votre cagnotte quand sa prestation est terminée"],
  ];
  if (espace === "pro") base.push(["Conciergerie parrainée :", m(REGLES.PARRAINAGE_MOIS_CONCIERGERIE), "mois d'abonnement offert à chacune, après sa 1re prestation"]);
  base.push(["Vous faites venir un Cleaneur :", m(euros(REGLES.PARRAINAGE_PARRAIN_C)), "dans votre cagnotte, après", m(N), "missions terminées"]);
  return base;
}

const STATUTS = { en_attente: ["En attente", ""], recompense: ["Récompensé", " vert"], refuse: ["Refusé", " gris"], plafond: ["Plafond annuel atteint", " gris"] };
const MOTIFS = { parrainage: "Parrainage", prime_parrainage: "Prime de parrainage", utilisation: "Utilisée pour une prestation", remboursement: "Rendue après annulation" };

/** Bloc complet pour l'espace ouvert (« particulier », « pro » ou « cleaneur »). d : réponse de mon_parrainage (null = indisponible). */
export function blocParrainage(d, espace) {
  if (!d?.code) return "";
  const solde = d.soldes?.[espace] || 0;
  const mouvements = (d.mouvements || []).filter(x => x.espace === espace).slice(0, 5);
  return `<h2 class="titre-section">${icone("cadeau", { tuile: true })}${tr("Parrainage et cagnotte")}</h2>
  <div class="parrainage" id="parrainage">
    ${d.remise_bienvenue_c > 0 && espace !== "cleaneur" ? `<div class="note bienvenue-parrain"><span>${ligne(["Bienvenue ! Vous avez", m(euros(d.remise_bienvenue_c)), "de remise sur votre 1re prestation, dès", m(euros(REGLES.PARRAINAGE_MIN_COMMANDE_C))])}</span></div>` : ""}
    <div class="cartes-parrainage">
      <div class="carte cagnotte">
        <span class="petit">${tr(espace === "cleaneur" ? "Mes primes de parrainage" : "Ma cagnotte")}</span>
        <b class="solde">${euros(solde)}</b>
        <span class="petit">${espace === "cleaneur" ? tr("Versées avec vos gains")
          : ligne(["Utilisable sur vos prochaines prestations · valable", m(REGLES.CAGNOTTE_VALIDITE_MOIS), "mois · non convertible en argent"])}</span>
        ${espace === "pro" && d.mois_offerts > 0 ? `<span class="tampon vert">${d.mois_offerts} ${tr("mois d'abonnement offerts")}</span>` : ""}
      </div>
      <div class="carte code-parrain">
        <span class="petit">${tr("Votre code de parrainage")}</span>
        <b class="code">${esc(d.code)}</b>
        <div class="actions-code"><button type="button" class="bouton" data-partager>${tr("Partager")}</button>
          <button type="button" class="bouton secondaire" data-copier>${tr("Copier le lien")}</button></div>
        <span class="petit" data-copie-ok></span>
      </div>
    </div>
    <ul class="gains-parrainage">${gains(espace).map(g => `<li>${ligne(g)}</li>`).join("")}</ul>
    <p class="petit">${ligne(["Récompense versée une fois la prestation terminée ·", m(REGLES.PARRAINAGE_MAX_PAR_AN), "filleuls récompensés par an au maximum · pas de parrainage dans un même foyer"])}</p>
    <details class="carte"><summary>${tr("Mes filleuls")} (${(d.filleuls || []).length})</summary>
      ${(d.filleuls || []).length ? `<ul class="liste-filleuls">${d.filleuls.map(f => `<li><span>${esc(f.prenom || "—")} <span class="petit">${dateCourte(new Date(f.cree_le))}</span></span>
        <span class="tampon${STATUTS[f.statut]?.[1] || ""}">${tr(STATUTS[f.statut]?.[0] || f.statut)}</span></li>`).join("")}</ul>`
        : `<p class="petit">${tr("Aucun filleul pour l'instant : partagez votre code !")}</p>`}
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
  const message = `${tr("Je t'offre")} ${euros(REGLES.PARRAINAGE_FILLEUL_C)} ${tr("sur ta 1re prestation Cleaneroo avec mon code")} ${d.code} : ${lien}`;
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
