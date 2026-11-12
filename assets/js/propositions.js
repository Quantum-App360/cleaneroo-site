// Propositions des Cleaneurs (12 novembre 2026, reprises de l'appli iPhone de Vincent) : en mode « candidatures », chaque
// Cleaneur propose un prix (remise ≤ 10 %, hausse ≤ 50 % toujours justifiée), un autre horaire s'il le faut, ses exclusions ;
// le client compare et choisit. Règles : REGLES.PROPOSITION_* et verifierProposition (regles.js, copie dans Regles.kt).
// Même écran dans l'appli (Propositions.kt). Base : outils/base-propositions.sql.
import { supabase } from "./donnees.js";
import { REGLES, euros, verifierProposition } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { badgeNiveau } from "./niveaux.js";

export const RAISONS_REMISE = [["PROXIMITE", "Remise de proximité"], ["LANCEMENT", "Tarif de lancement"], ["FIDELITE", "Remise fidélité"], ["AUTRE_REMISE", "Autre raison"]];
export const RAISONS_HAUSSE = [["TEMPS", "Temps de travail supplémentaire nécessaire"], ["ETAT", "État plus dégradé que déclaré (voir photos)"],
  ["ACCES", "Accès difficile (étage sans ascenseur, stationnement)"], ["MATERIEL", "Matériel spécifique nécessaire"], ["AUTRE_HAUSSE", "Autre raison"]];
const nomRaison = id => [...RAISONS_REMISE, ...RAISONS_HAUSSE].find(r => r[0] === id)?.[1] || "";
export const MESSAGES_PROPOSITION = {
  ok: "Proposition envoyée : le client est prévenu et choisit.", remise: "La remise ne peut pas dépasser 10 % de l'estimation.",
  devis: "Au-delà de 50 % de plus que l'estimation, la prestation passe sur devis.", justification: "Une hausse se justifie : choisissez une raison et écrivez au moins 20 caractères pour le client.",
  raison: "Choisissez la raison de votre remise.", complet: "Cette demande a déjà reçu 5 propositions.", ouverture: "Les missions commencent le 1er janvier 2027.",
  dossier: "Votre dossier doit être validé pour proposer.", indisponible: "Cette mission n'est plus disponible." };

/** Formulaire « Proposer » d'une mission en mode candidatures (Cleaneur). */
export function formulaireProposition(m, mienne) {
  const prix = (mienne?.prix_c ?? m.estimation_c) / 100;
  return `<details class="proposition-cleaneur"${mienne ? "" : ""}><summary class="bouton">${tr(mienne ? "Modifier ma proposition" : "Proposer mes conditions")}</summary>
    ${mienne ? `<p class="petit">${tr("Proposition envoyée")} : <b>${euros(mienne.prix_c)}</b> · ${tr(mienne.statut === "EN_ATTENTE" ? "en attente du client" : mienne.statut === "EXPIREE" ? "expirée" : "close")}</p>` : ""}
    <div class="grille-proposition">
      <label class="champ">${tr("Votre prix (€)")}<input type="number" min="1" step="1" inputmode="decimal" value="${prix}" data-prix></label>
      <label class="champ">${tr("Raison de l'écart")}<select data-raison><option value="">${tr("Aucun écart")}</option>
        <optgroup label="${tr("Remise")}">${RAISONS_REMISE.map(([v, t]) => `<option value="${v}">${tr(t)}</option>`).join("")}</optgroup>
        <optgroup label="${tr("Hausse")}">${RAISONS_HAUSSE.map(([v, t]) => `<option value="${v}">${tr(t)}</option>`).join("")}</optgroup></select></label>
      <label class="champ">${tr("Autre horaire (facultatif)")}<input type="datetime-local" data-horaire></label>
      <label class="champ">${tr("Temps en plus (minutes)")}<input type="number" min="0" max="240" step="15" value="0" data-temps></label>
    </div>
    <label class="champ">${tr("Note pour le client (obligatoire si vous demandez plus)")}<textarea rows="2" maxlength="500" data-note></textarea></label>
    <label class="champ">${tr("Ce que vous n'incluez pas (facultatif)")}<input maxlength="300" data-exclusions placeholder="${tr("ex. vitres au-delà de 3 m")}"></label>
    <p class="petit">${tr("Remise jusqu'à 10 % ; hausse jusqu'à 50 %, toujours justifiée. La commission Cleaneroo reste calculée sur l'estimation.")}</p>
    <div class="boutons"><button type="button" class="bouton" data-proposer="${esc(m.reference)}">${tr("Envoyer ma proposition")}</button>
      ${mienne?.statut === "EN_ATTENTE" ? `<button type="button" class="bouton secondaire" data-retirer-proposition="${esc(m.reference)}">${tr("Retirer ma proposition")}</button>` : ""}</div>
    <p class="petit" data-resultat-proposition></p></details>`;
}

export function brancherPropositions(boite, recharger) {
  boite.querySelectorAll("[data-proposer]").forEach(b => b.onclick = async () => {
    const f = b.closest(".proposition-cleaneur");
    const v = s => f.querySelector(s).value;
    const res = f.querySelector("[data-resultat-proposition]");
    const horaire = v("[data-horaire]");
    b.disabled = true;
    const { data } = await supabase.rpc("proposer", { p_reference: b.dataset.proposer, p_prix_c: Math.round(Number(String(v("[data-prix]")).replace(",", ".")) * 100),
      p_raison: v("[data-raison]"), p_note: v("[data-note]"), p_temps_sup_min: Number(v("[data-temps]")) || 0,
      p_autre_horaire: horaire ? new Date(horaire).toISOString() : null, p_exclusions: v("[data-exclusions]") });
    b.disabled = false;
    res.textContent = tr(MESSAGES_PROPOSITION[data] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    res.style.color = data === "ok" ? "var(--succes)" : "var(--erreur)";
    if (data === "ok") setTimeout(recharger, 1500);
  });
  boite.querySelectorAll("[data-retirer-proposition]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await supabase.rpc("retirer_proposition", { p_reference: b.dataset.retirerProposition });
    recharger();
  });
}

/** Propositions reçues par le client sur sa demande (page de suivi), avec comparaison et choix. */
export async function blocPropositionsClient(boite, reference, jeton) {
  if (!boite) return;
  const { data: liste } = await supabase.rpc("propositions_de", { p_reference: reference, p_jeton: jeton || null });
  if (!boite.isConnected) return;
  if (!liste?.length) { boite.innerHTML = `<div class="carte" style="margin-bottom:14px"><b>⏳ ${tr("En attente des propositions des Cleaneurs")}</b>
    <p class="petit" style="margin:4px 0 0">${tr("Vous êtes prévenu à chaque proposition. Rien ne sera ajouté sans votre accord.")}</p></div>`; traduire(boite); return; }
  const heure = iso => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  boite.innerHTML = `<h2 class="titre-section">🙋 ${tr("Propositions des Cleaneurs")} (${liste.length})</h2>
    <p class="petit" style="margin-top:0">${tr("Comparez et choisissez. Aucun Cleaneur n'est accepté sans votre choix ; rien ne sera ajouté sans votre accord.")}</p>
    <div class="grille-propositions">${liste.map(p => {
      const ecart = p.prix_c - p.estimation_c;
      const minutes = Math.max(0, Math.round((new Date(p.expire_le) - Date.now()) / 60000));
      return `<div class="carte proposition-client" data-id="${esc(p.id)}">
        <div class="tete-prop"><b>${esc(p.prenom || "")}</b>${badgeNiveau(p.niveau)}</div>
        <p class="petit" style="margin:2px 0">${p.nb_avis ? `⭐ ${String(p.note).replace(".", ",")} · ${p.nb_avis} ${tr("avis")}` : tr("Nouveau sur Cleaneroo · aucun avis")}</p>
        <p class="prix-prop">${euros(p.prix_c)}</p>
        ${ecart ? `<p class="petit" style="margin:0;color:${ecart < 0 ? "var(--succes)" : "var(--corail-texte,#C2552F)"}">${ecart < 0 ? "−" : "+"}${euros(Math.abs(ecart))} ${tr("par rapport à l'estimation")} · ${tr(nomRaison(p.raison))}</p>` : `<p class="petit" style="margin:0">${tr("Au prix estimé")}</p>`}
        ${p.note_cleaneur ? `<p class="petit"><i>« ${esc(p.note_cleaneur)} »</i></p>` : ""}
        ${p.temps_sup_min ? `<p class="petit">⏱ +${p.temps_sup_min} min ${tr("prévues")}</p>` : ""}
        ${p.autre_horaire ? `<p class="petit">🕘 ${tr("Propose un autre horaire :")} <b>${heure(p.autre_horaire)}</b></p>` : ""}
        ${p.exclusions ? `<label class="petit case-prop"><input type="checkbox" data-exclusion> ${tr("J'accepte l'exclusion :")} ${esc(p.exclusions)}</label>` : ""}
        <label class="petit case-prop"><input type="checkbox" data-cgv> ${tr("J'accepte les conditions générales de vente et la politique d'annulation")}</label>
        <p class="petit muet">${tr("Répondez sous")} ${minutes} min</p>
        <div class="boutons"><button type="button" class="bouton" data-choisir="${esc(p.id)}">${tr("Oui, je choisis")} ${esc(p.prenom || "")}</button>
          <button type="button" class="bouton secondaire" data-refuser="${esc(p.id)}">${tr("Refuser l'offre")}</button></div>
        <p class="erreur" data-erreur-prop></p></div>`; }).join("")}</div>`;
  traduire(boite);
  styles();
  boite.querySelectorAll("[data-choisir]").forEach(b => b.onclick = async () => {
    const c = b.closest(".proposition-client"), err = c.querySelector("[data-erreur-prop]");
    if (!c.querySelector("[data-cgv]").checked || (c.querySelector("[data-exclusion]") && !c.querySelector("[data-exclusion]").checked)) {
      err.textContent = tr("Cochez les cases pour confirmer votre choix."); return; }
    b.disabled = true;
    const { data } = await supabase.rpc("accepter_proposition", { p_id: b.dataset.choisir, p_jeton: jeton || null });
    if (data === "ok") { location.reload(); return; }
    b.disabled = false;
    err.textContent = tr(data === "expiree" ? "Cette proposition a expiré." : data === "deja_prise" ? "Un Cleaneur est déjà confirmé." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
  boite.querySelectorAll("[data-refuser]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await supabase.rpc("refuser_proposition", { p_id: b.dataset.refuser, p_jeton: jeton || null });
    blocPropositionsClient(boite, reference, jeton);
  });
}

function styles() {
  if (document.getElementById("styles-propositions")) return;
  const s = document.createElement("style");
  s.id = "styles-propositions";
  s.textContent = `.grille-propositions{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:14px}
    .proposition-client{margin:0;display:flex;flex-direction:column;gap:4px}.tete-prop{display:flex;align-items:center;gap:6px;font-size:1.05rem}
    .prix-prop{font-size:1.5rem;font-weight:800;margin:4px 0;color:var(--primaire,#1F8A80)}.case-prop{display:flex;gap:6px;align-items:flex-start;cursor:pointer}
    .grille-proposition{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px}
    .proposition-cleaneur summary{list-style:none;display:inline-flex;cursor:pointer}.proposition-cleaneur summary::-webkit-details-marker{display:none}`;
  document.head.appendChild(s);
}
