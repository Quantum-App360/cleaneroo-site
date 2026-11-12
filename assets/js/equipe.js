// Équipe et propriétaires (12 novembre 2026, repris de l'appli iPhone de Vincent) : la conciergerie invite par e-mail un
// Gestionnaire, un Assistant ou un Propriétaire (limité à ses biens) ; l'invité accepte depuis son compte et voit les biens
// et les ménages concernés (jamais les codes d'accès). Base : outils/base-equipe.sql. Même écran dans l'appli (Equipe.kt).
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { dateLongue, euros } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { libelleStatut } from "./app.js";

export const ROLES_EQUIPE = { GESTIONNAIRE: "Gestionnaire", ASSISTANT: "Assistant", PROPRIETAIRE: "Propriétaire" };
const STATUTS = { INVITE: "Invitation envoyée", ACTIF: "Actif" };
const nomBien = l => l.nom || l.rue || "";

/** Section « Équipe et propriétaires » : gestion (espace Pro) et équipes dont on est membre. */
export async function blocEquipe(boite, pro, biens = []) {
  if (!boite) return;
  const [equipe, miennes] = await Promise.all([
    pro ? supabase.rpc("mon_equipe").then(r => r.data || []) : Promise.resolve([]),
    supabase.rpc("mes_equipes").then(r => r.data || [])]);
  if (!boite.isConnected || (!pro && !miennes.length)) { boite.innerHTML = ""; return; }
  boite.innerHTML = `<details class="carte" style="margin-top:16px" ${miennes.some(m => m.statut === "INVITE") ? "open" : ""}>
    <summary><b>👥 ${tr("Équipe et propriétaires")}</b></summary>
    ${pro ? `<p class="petit">${tr("Invitez vos collaborateurs et les propriétaires des biens que vous gérez. Un propriétaire ne voit que ses biens et leurs ménages, jamais les codes d'accès.")}</p>
      ${equipe.map(m => `<div class="ligne-equipe"><div><b>${esc(m.email)}</b><span class="petit"> · ${tr(ROLES_EQUIPE[m.role])} · ${tr(STATUTS[m.statut])}</span>
        ${m.role === "PROPRIETAIRE" ? `<div class="petit">${esc(m.biens.map(id => nomBien(biens.find(b => b.id === id) || {})).filter(Boolean).join(", "))}</div>` : ""}</div>
        <button type="button" class="lien-bouton" data-retirer-membre="${esc(m.id)}">${tr("Retirer")}</button></div>`).join("")}
      <form id="form-equipe" novalidate style="margin-top:10px">
        <label class="champ">${tr("E-mail")}<input name="email" type="email" autocomplete="off" maxlength="160"></label>
        <label class="champ">${tr("Rôle")}<select name="role">${Object.entries(ROLES_EQUIPE).map(([id, n]) => `<option value="${id}">${tr(n)}</option>`).join("")}</select></label>
        <fieldset class="biens-proprietaire masque"><legend class="petit">${tr("Biens de ce propriétaire")}</legend>
          ${biens.map(b => `<label class="case"><input type="checkbox" name="bien" value="${esc(b.id)}"> ${esc(nomBien(b))}</label>`).join("") || `<p class="petit">${tr("Ajoutez d'abord vos biens.")}</p>`}</fieldset>
        <p class="erreur" id="erreur-equipe"></p><button class="bouton secondaire" type="submit">${tr("Inviter")}</button></form>` : ""}
    ${miennes.length ? `<h3 style="margin-top:14px">${tr("Mes équipes")}</h3>${miennes.map(m => `<div class="ligne-equipe"><div><b>${esc(m.conciergerie)}</b>
      <span class="petit"> · ${tr(ROLES_EQUIPE[m.role])}</span></div>
      ${m.statut === "INVITE" ? `<button type="button" class="bouton" data-accepter-equipe="${esc(m.id)}">${tr("Accepter")}</button>`
        : `<button type="button" class="bouton secondaire" data-vue-equipe="${esc(m.id)}">${tr("Voir les biens et les ménages")}</button>`}
      <button type="button" class="lien-bouton" data-retirer-membre="${esc(m.id)}">${m.statut === "INVITE" ? tr("Refuser") : tr("Quitter")}</button></div>
      <div data-vue="${esc(m.id)}"></div>`).join("")}` : ""}</details>`;
  traduire(boite);
  styles();
  const recharger = () => blocEquipe(boite, pro, biens);
  const f = boite.querySelector("#form-equipe");
  if (f) {
    f.role.onchange = () => f.querySelector(".biens-proprietaire").classList.toggle("masque", f.role.value !== "PROPRIETAIRE");
    f.onsubmit = async e => {
      e.preventDefault();
      const choisis = [...f.querySelectorAll("[name=bien]:checked")].map(x => x.value), err = f.querySelector("#erreur-equipe");
      if (f.role.value === "PROPRIETAIRE" && !choisis.length) { err.textContent = tr("Choisissez au moins un bien."); return; }
      const { data, error } = await supabase.rpc("inviter_membre", { p_email: f.email.value.trim(), p_role: f.role.value, p_biens: choisis });
      const r = error ? "erreur" : data;
      if (r === "ok") return recharger();
      err.textContent = tr({ email: "Saisissez une adresse e-mail valide.", soi: "Vous ne pouvez pas vous inviter vous-même." }[r]
        || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    };
  }
  boite.querySelectorAll("[data-retirer-membre]").forEach(b => b.onclick = async () => { await supabase.rpc("retirer_membre", { p_id: b.dataset.retirerMembre }); recharger(); });
  boite.querySelectorAll("[data-accepter-equipe]").forEach(b => b.onclick = async () => { await supabase.rpc("accepter_equipe", { p_id: b.dataset.accepterEquipe }); recharger(); });
  boite.querySelectorAll("[data-vue-equipe]").forEach(b => b.onclick = async () => {
    const z = boite.querySelector(`[data-vue="${b.dataset.vueEquipe}"]`);
    const { data } = await supabase.rpc("vue_proprietaire", { p_id: b.dataset.vueEquipe });
    if (!data) { z.innerHTML = ""; return; }
    z.innerHTML = `<div class="carte teintee" style="margin:8px 0">
      <b>${tr("Biens")}</b>${data.biens.map(x => `<p class="petit" style="margin:4px 0">🏠 ${esc(nomBien(x))} · ${esc(x.rue)}, ${esc(x.code_postal)} ${esc(x.ville)}</p>`).join("") || `<p class="petit">—</p>`}
      <b>${tr("Ménages")}</b>${data.missions.map(x => `<p class="petit" style="margin:4px 0">${esc(rubrique(x.rubrique_id)?.nom || "")} · ${x.creneau ? esc(dateLongue(new Date(x.creneau))) : ""}
        · ${esc(x.ville)} · ${euros(x.estimation_c)} · <span class="tampon">${esc(tr(libelleStatut(x.statut)))}</span></p>`).join("") || `<p class="petit">${tr("Aucun ménage pour l'instant.")}</p>`}</div>`;
    traduire(z);
  });
}

function styles() {
  if (document.getElementById("styles-equipe")) return;
  const s = document.createElement("style"); s.id = "styles-equipe";
  s.textContent = `.ligne-equipe{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)}
    .ligne-equipe>div{flex:1 1 200px}.biens-proprietaire{border:0;padding:0;margin:0 0 10px}.biens-proprietaire .case{display:block;margin:4px 0}`;
  document.head.appendChild(s);
}
