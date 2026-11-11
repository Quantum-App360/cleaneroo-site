// « Invitez vos propres Cleaneurs » (11 novembre 2026, repris de l'appli iPhone de Vincent).
// Espace Pro : la conciergerie invite ses intervenants habituels avec un code de 6 caractères (sans 0, O, 1 ni I).
// Aucune dispense de vérification : dossier complet ; une fois validé, l'invité devient Cleaneur attitré de la conciergerie
// et voit ses missions tout de suite. Espace Cleaneur : « J'ai un code d'invitation ». Même écran dans l'appli (Invitations.kt).
// Base : outils/base-invitations-pro.sql.
import { supabase } from "./donnees.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { dateLongue } from "./regles.js";
import { esc } from "./commun.js";

export const INVITATION_EXPIRATION_JOURS = 30;
const STATUTS = { ENVOYEE: "Envoyée", DOSSIER: "Dossier en cours", ACTIF: "Actif", EXPIREE: "Expirée" };
const statutDe = i => i.statut !== "ACTIF" && Date.now() - new Date(i.envoyee_le) > INVITATION_EXPIRATION_JOURS * 864e5 ? "EXPIREE" : i.statut;
const lien = code => `https://cleaneroo.fr/?invitation=${code}#/compte/cleaneur`;
const message = i => `${i.societe} ${tr("vous invite sur Cleaneroo pour ses ménages. Code :")} ${i.code}\n${lien(i.code)}`;

/* ------------------------------------------------------------------ Espace Pro */
export function blocInvitationsPro() {
  return `<h2 class="titre-section">${icone("cleaneurs", { tuile: true })}Invitez vos propres Cleaneurs</h2>
    <p class="petit" style="margin-top:0">Vous travaillez déjà avec des intervenants ? Invitez-les : une fois leur dossier validé (SIRET, URSSAF, assurance), ils deviennent vos Cleaneurs attitrés et voient vos missions en priorité.</p>
    <div class="carte"><form id="form-invitation" novalidate>
      <label class="champ">Prénom<input name="prenom" maxlength="60" autocomplete="off"></label>
      <label class="champ">Nom<input name="nom" maxlength="60" autocomplete="off"></label>
      <label class="champ">Téléphone ou e-mail<input name="contact" maxlength="120" autocomplete="off"></label>
      <p class="erreur" id="erreur-invitation"></p><button class="bouton plein" type="submit">Créer l'invitation</button></form></div>
    <div id="liste-invitations" style="margin-top:10px"></div>`;
}

async function listeInvitations(boite) {
  const { data, error } = await supabase.from("invitations_pro").select("*").order("envoyee_le", { ascending: false });
  if (error) { boite.innerHTML = `<p class="erreur">${esc(tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."))}</p>`; return; }
  const s = (await supabase.auth.getSession()).data.session;
  const miennes = (data || []).filter(i => i.pro_id === s?.user.id);
  boite.innerHTML = miennes.map(i => {
    const st = statutDe(i);
    return `<div class="carte" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(i.prenom)} ${esc(i.nom)}</b><span class="tampon">${STATUTS[st]}</span></div>
      <div class="petit">Code <b style="letter-spacing:.12em">${esc(i.code)}</b>${i.contact ? ` · ${esc(i.contact)}` : ""}</div>
      ${st === "ACTIF" ? `<p class="petit" style="margin:6px 0 0;color:var(--succes)"><b>Cleaneur attitré</b></p>`
        : `<div class="boutons" style="margin-top:8px"><button type="button" class="bouton secondaire" data-partager="${esc(i.id)}">Envoyer l'invitation</button>
          ${st === "EXPIREE" || st === "ENVOYEE" ? `<button type="button" class="bouton secondaire" data-relancer="${esc(i.id)}">Relancer</button>` : ""}</div>`}</div>`;
  }).join("") || `<p class="petit">Aucune invitation pour l'instant.</p>`;
  traduire(boite);
  boite.querySelectorAll("[data-partager]").forEach(b => b.onclick = async () => {
    const i = miennes.find(x => x.id === b.dataset.partager);
    if (navigator.share) { try { await navigator.share({ text: message(i) }); } catch { /* partage annulé */ } return; }
    try { await navigator.clipboard.writeText(message(i)); b.textContent = tr("Message copié"); } catch { prompt(tr("Copiez ce message :"), message(i)); }
  });
  boite.querySelectorAll("[data-relancer]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    await supabase.rpc("relancer_invitation", { p_id: b.dataset.relancer });
    listeInvitations(boite);
  });
}

export function brancherInvitationsPro(vue) {
  const f = vue.querySelector("#form-invitation"), boite = vue.querySelector("#liste-invitations");
  if (!f) return;
  listeInvitations(boite);
  f.onsubmit = async e => {
    e.preventDefault();
    const err = vue.querySelector("#erreur-invitation");
    if (!f.prenom.value.trim()) { err.textContent = tr("Indiquez au moins le prénom."); return; }
    f.querySelector("[type=submit]").disabled = true;
    const { error } = await supabase.rpc("creer_invitation", { p_prenom: f.prenom.value.trim(), p_nom: f.nom.value.trim(), p_contact: f.contact.value.trim() });
    f.querySelector("[type=submit]").disabled = false;
    if (error) { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    f.reset(); err.textContent = "";
    listeInvitations(boite);
  };
}

/* ------------------------------------------------------------------ Espace Cleaneur */
const REPONSES = {
  introuvable: "Code inconnu : vérifiez les 6 caractères reçus.",
  expiree: "Cette invitation a expiré : demandez à la conciergerie de vous la renvoyer.",
  deja: "Ce code a déjà été utilisé.",
  soi_meme: "Vous ne pouvez pas utiliser votre propre invitation.",
  ok_dossier: "Code reconnu ! Dès que votre dossier sera validé, vous deviendrez Cleaneur attitré de cette conciergerie.",
  ok_actif: "Code reconnu : vous êtes Cleaneur attitré de cette conciergerie et voyez ses missions en priorité.",
};
const codeEnAttente = () => { try { return sessionStorage.getItem("cleaneroo-invitation") || ""; } catch { return ""; } };

export function blocCodeInvitation() {
  return `<details class="carte" id="bloc-invitation" ${codeEnAttente() ? "open" : ""}><summary>J'ai un code d'invitation</summary>
    <form id="form-code-invitation" novalidate style="margin-top:10px">
      <p class="petit" style="margin-top:0">Une conciergerie vous a invité ? Saisissez son code : vous deviendrez son Cleaneur attitré une fois votre dossier validé.</p>
      <label class="champ">Code (6 caractères)<input name="code" maxlength="9" autocomplete="off" autocapitalize="characters" value="${esc(codeEnAttente())}" style="letter-spacing:.12em;text-transform:uppercase"></label>
      <p class="petit" id="reponse-invitation"></p><button class="bouton plein" type="submit">Valider le code</button></form>
    <div id="mes-invitations"></div></details>`;
}

export function brancherCodeInvitation(vue) {
  const f = vue.querySelector("#form-code-invitation");
  if (!f) return;
  const rep = vue.querySelector("#reponse-invitation");
  supabase.auth.getSession().then(({ data: { session: s } }) => s && supabase.from("invitations_pro").select("societe").eq("statut", "ACTIF").eq("cleaneur_id", s.user.id))
    .then(r => {
      const boite = vue.querySelector("#mes-invitations");
      if (boite && r?.data?.length) boite.innerHTML = `<p class="petit" style="color:var(--succes)">${esc(tr("Cleaneur attitré de"))} : <b>${r.data.map(i => esc(i.societe)).join(", ")}</b></p>`;
    }).catch(() => {});
  f.onsubmit = async e => {
    e.preventDefault();
    f.querySelector("[type=submit]").disabled = true;
    const { data, error } = await supabase.rpc("utiliser_invitation", { p_code: f.code.value });
    f.querySelector("[type=submit]").disabled = false;
    const r = error ? "" : data;
    rep.textContent = tr(REPONSES[r] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    rep.style.color = r?.startsWith("ok") ? "var(--succes)" : "var(--erreur)";
    if (r?.startsWith("ok")) { try { sessionStorage.removeItem("cleaneroo-invitation"); } catch { /* rien */ } brancherCodeInvitation(vue); }
  };
}

// Lien reçu (cleaneroo.fr/?invitation=CODE) : le code est gardé pour préremplir le champ.
try {
  const c = new URLSearchParams(location.search).get("invitation");
  if (c && /^[A-Za-z0-9-]{6,9}$/.test(c)) sessionStorage.setItem("cleaneroo-invitation", c.toUpperCase());
} catch { /* rien */ }
