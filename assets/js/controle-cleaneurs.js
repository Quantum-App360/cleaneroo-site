// Contrôle des Cleaneurs (back-office, 13 novembre 2026) : selfies du jour à comparer à la pièce d'identité, avertissements et bannissement.
// Module à part, sans dépendance vers l'application, pour être chargé par gestion.html.
import { REGLES, dateLongue } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { avertissementsCleaneurs, avertirCleaneur, leverBannissement, selfiesAVerifier, lienSelfie, lienDocument, deciderSelfie } from "./donnees.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Administration : avertir un Cleaneur, lever un bannissement. */
export async function blocAvertissementsAdmin(boite) {
  const liste = await avertissementsCleaneurs().catch(() => []);
  if (!boite.isConnected) return;
  boite.innerHTML = `<h2 class="titre-section">⚠️ ${tr("Avertissements des Cleaneurs")}</h2>
    <p class="petit" style="margin-top:0">${tr("2 avertissements autorisés : au 3e, le Cleaneur est banni et ne peut plus prendre de missions.")}</p>
    ${liste.length ? liste.map(c => `<div class="carte ligne-compte" data-avert-admin="${esc(c.id)}"><div class="corps">
      <b>${esc(`${c.prenom || ""} ${c.nom || ""}`.trim() || "—")}</b> <span class="tampon${c.banni ? "" : c.nombre ? "" : " vert"}">${c.banni ? tr("Banni") : `${c.nombre} / ${REGLES.AVERTISSEMENTS_MAX}`}</span>
      <p class="petit" style="margin:2px 0 0">${esc(c.ville || "")}${c.dernier ? ` · ${esc(c.dernier)}` : ""}</p></div>
      ${c.banni ? `<button type="button" class="bouton secondaire" data-lever>${tr("Lever le bannissement")}</button>` : `<button type="button" class="bouton secondaire" data-avertir>${tr("Donner un avertissement")}</button>`}</div>`).join("")
      : `<div class="vide-compte"><p class="muet">${tr("Aucun Cleaneur inscrit pour l'instant.")}</p></div>`}`;
  traduire(boite);
  boite.querySelectorAll("[data-avertir]").forEach(b => b.onclick = async () => {
    const motif = (prompt(tr("Motif de l'avertissement (visible par le Cleaneur) :")) || "").trim();
    if (motif.length < 3) return;
    await avertirCleaneur(b.closest("[data-avert-admin]").dataset.avertAdmin, motif).catch(() => null);
    blocAvertissementsAdmin(boite);
  });
  boite.querySelectorAll("[data-lever]").forEach(b => b.onclick = async () => {
    if (!confirm(tr("Lever le bannissement et effacer les avertissements de ce Cleaneur ?"))) return;
    await leverBannissement(b.closest("[data-avert-admin]").dataset.avertAdmin).catch(() => null);
    blocAvertissementsAdmin(boite);
  });
}

/** Administration : selfies récents à côté de la pièce d'identité, pour confirmer que c'est la même personne. */
export async function blocSelfiesAdmin(boite) {
  const liste = await selfiesAVerifier().catch(() => []);
  if (!boite.isConnected) return;
  boite.innerHTML = `<h2 class="titre-section">🤳 ${tr("Selfies des Cleaneurs (7 derniers jours)")}</h2>
    ${liste.length ? liste.map(s => `<div class="carte" data-selfie-admin="${esc(s.id)}"><div class="paire">
      <img alt="${esc(tr("Selfie du jour"))}" data-lien-selfie="${esc(s.chemin)}"><img alt="${esc(tr("Pièce d'identité"))}" ${s.identite ? `data-lien-identite="${esc(s.identite)}"` : ""}>
      <div style="flex:1 1 180px"><b>${esc(`${s.prenom || ""} ${s.nom || ""}`.trim())}</b><p class="petit" style="margin:2px 0 6px">${esc(dateLongue(new Date(s.jour)))} · ${tr({ A_VERIFIER: "À vérifier", VALIDE: "Validé", REFUSE: "Refusé" }[s.statut])}</p>
        ${s.statut === "A_VERIFIER" ? `<div class="boutons" style="margin:0"><button type="button" class="bouton" data-decider="1">C'est bien la même personne</button>
          <button type="button" class="bouton secondaire" data-decider="0">Refuser</button></div>` : ""}</div></div></div>`).join("")
      : `<div class="vide-compte"><p class="muet">${tr("Aucun selfie pour l'instant.")}</p></div>`}`;
  traduire(boite);
  boite.querySelectorAll("[data-lien-selfie]").forEach(async i => { try { i.src = await lienSelfie(i.dataset.lienSelfie); } catch { /* rien */ } });
  boite.querySelectorAll("[data-lien-identite]").forEach(async i => { try { i.src = await lienDocument(i.dataset.lienIdentite); } catch { /* rien */ } });
  boite.querySelectorAll("[data-decider]").forEach(b => b.onclick = async () => {
    const id = b.closest("[data-selfie-admin]").dataset.selfieAdmin, ok = b.dataset.decider === "1";
    const motif = ok ? "" : (prompt(tr("Motif du refus (visible par le Cleaneur) :")) ?? "");
    await deciderSelfie(id, ok, motif).catch(() => null);
    blocSelfiesAdmin(boite);
  });
}

