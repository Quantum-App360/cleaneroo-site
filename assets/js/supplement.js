// Supplément pour imprévu (12 novembre 2026) : après un signalement à l'arrivée, le Cleaneur propose du temps en plus avec un curseur
// (REGLES.SUPPLEMENT_PAS_MIN à SUPPLEMENT_MAX_MIN) ; le prix suit le tarif de la prestation (prix / durée prévue), plafonné à
// SUPPLEMENT_MAX_PCT % du prix ; un seul par prestation. Le client accepte ou refuse ; sans réponse en SUPPLEMENT_REPONSE_MIN min,
// c'est un refus. Le calcul fait foi en base (proposer_supplement). Même écran dans l'appli (Supplement.kt).
import { supabase } from "./donnees.js";
import { REGLES, euros } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

/** Prix d'un supplément (même calcul que la base). */
export const prixSupplementC = (estimationC, dureeMin, minutes) =>
  Math.min(Math.round(estimationC * minutes / Math.max(dureeMin || 0, 30)), Math.floor(estimationC * REGLES.SUPPLEMENT_MAX_PCT / 100));

const STATUTS = { EN_ATTENTE: "En attente de la réponse du client", ACCEPTE: "Accepté par le client", REFUSE: "Refusé par le client", EXPIRE: "Sans réponse : prestation prévue" };

/** Cleaneur : proposer un supplément (après un signalement) ou voir sa réponse. */
export async function blocSupplementCleaneur(boite, m, aSignale) {
  if (!boite) return;
  const { data: s } = await supabase.rpc("supplement_de", { p_reference: m.reference, p_jeton: null });
  if (!boite.isConnected) return;
  if (s) { boite.innerHTML = `<div class="carte supplement"><b>⏱️ ${tr("Supplément")} : +${s.minutes} min · ${euros(s.montant_c)}</b><p class="petit" style="margin:4px 0 0">${tr(STATUTS[s.statut])}</p></div>`; traduire(boite); return; }
  if (!aSignale) { boite.innerHTML = ""; return; }
  const pas = REGLES.SUPPLEMENT_PAS_MIN, max = REGLES.SUPPLEMENT_MAX_MIN;
  boite.innerHTML = `<details class="carte supplement"><summary><b>⏱️ ${tr("Proposer un supplément pour imprévu")}</b></summary>
    <p class="petit">${tr("Pour un travail en plus dû au problème signalé. Le client reçoit la proposition et l'accepte ou la refuse ; sans réponse, vous faites la prestation prévue.")}</p>
    <label class="champ">${tr("Temps en plus")} : <b data-sup-minutes>${pas} min</b> · <b data-sup-prix>${euros(prixSupplementC(m.estimation_c, m.duree_min, pas))}</b>
      <input type="range" min="${pas}" max="${max}" step="${pas}" value="${pas}" data-sup-curseur></label>
    <p class="petit" style="margin:0">${tr("Au tarif de la prestation, plafonné à")} ${REGLES.SUPPLEMENT_MAX_PCT} % ${tr("du prix")}.</p>
    <label class="champ">${tr("Pourquoi ?")}<input maxlength="300" data-sup-motif placeholder="${esc(tr("Ex. : four très encrassé, 30 min de dégraissage"))}"></label>
    <p class="erreur" data-sup-erreur></p><button type="button" class="bouton" data-sup-envoyer>${tr("Envoyer au client")}</button></details>`;
  traduire(boite);
  const curseur = boite.querySelector("[data-sup-curseur]");
  curseur.oninput = () => { boite.querySelector("[data-sup-minutes]").textContent = `${curseur.value} min`; boite.querySelector("[data-sup-prix]").textContent = euros(prixSupplementC(m.estimation_c, m.duree_min, +curseur.value)); };
  boite.querySelector("[data-sup-envoyer]").onclick = async e => {
    const motif = boite.querySelector("[data-sup-motif]").value.trim(), err = boite.querySelector("[data-sup-erreur]");
    if (motif.length < 3) { err.textContent = tr("Expliquez en quelques mots pourquoi."); return; }
    e.target.disabled = true;
    const { data, error } = await supabase.rpc("proposer_supplement", { p_reference: m.reference, p_minutes: +curseur.value, p_motif: motif });
    const r = error ? "erreur" : data;
    if (r === "ok") return blocSupplementCleaneur(boite, m, aSignale);
    e.target.disabled = false;
    err.textContent = tr({ signalement: "Signalez d'abord le problème à l'arrivée.", deja: "Un supplément a déjà été proposé pour cette prestation." }[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}

/** Client : accepter ou refuser le supplément proposé (page de suivi). */
export async function blocSupplementClient(boite, ref, jeton) {
  if (!boite) return;
  const { data: s } = await supabase.rpc("supplement_de", { p_reference: ref, p_jeton: jeton || null });
  if (!s || !boite.isConnected) { if (boite) boite.innerHTML = ""; return; }
  const enAttente = s.statut === "EN_ATTENTE";
  const reste = Math.max(0, Math.ceil((new Date(s.limite) - Date.now()) / 60000));
  boite.innerHTML = `<div class="carte supplement" style="margin:12px 0;${enAttente ? "border:2px solid var(--alerte)" : ""}">
    <b>⏱️ ${tr("Supplément proposé par votre Cleaneur")}</b>
    <p style="margin:6px 0">+${s.minutes} min · <b>${euros(s.montant_c)}</b> — ${esc(s.motif)}</p>
    ${enAttente ? `<p class="petit">${tr("Le problème a été signalé à l'arrivée (voir le constat). Sans réponse dans")} ${reste} min, ${tr("le Cleaneur réalise la prestation prévue.")}</p>
      <div class="boutons"><button type="button" class="bouton" data-sup-oui>${tr("Accepter")}</button><button type="button" class="bouton secondaire" data-sup-non>${tr("Refuser")}</button></div>`
      : `<p class="petit">${tr(STATUTS[s.statut])}</p>`}</div>`;
  traduire(boite);
  boite.querySelectorAll("[data-sup-oui], [data-sup-non]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await supabase.rpc("repondre_supplement", { p_reference: ref, p_accepte: b.hasAttribute("data-sup-oui"), p_jeton: jeton || null });
    blocSupplementClient(boite, ref, jeton);
  });
}
