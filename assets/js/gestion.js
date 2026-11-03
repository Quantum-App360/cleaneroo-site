// Écran de gestion Cleaneroo : réservé aux comptes « admin » (règles de sécurité de la base).
// Équivalent de « Administration (démo) » de l'application : vérifier, publier, confirmer, faire avancer ou refuser une demande.
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { euros, duree, heure, dateLongue } from "./regles.js";

const vue = document.getElementById("vue");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUTS = { VERIFICATION: "À vérifier", PUBLIEE: "En ligne", CONFIRMEE: "Confirmée", EN_ROUTE: "En route", SUR_PLACE: "Sur place",
  EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée", ANNULEE: "Annulée" };
const SUIVANT = { VERIFICATION: "PUBLIEE", PUBLIEE: "CONFIRMEE", CONFIRMEE: "EN_ROUTE", EN_ROUTE: "SUR_PLACE", SUR_PLACE: "EN_COURS", EN_COURS: "A_VALIDER", A_VALIDER: "TERMINEE" };
const ACCUEIL = { PRESENT: "Client présent", TIERS: "Concierge / tiers", BOITE: "Boîte à clés", AUTONOME: "Accès autonome" };
let filtre = "VERIFICATION";

async function demarrer() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return ecranConnexion();
  document.getElementById("deconnexion").classList.remove("masque");
  const { data: estAdmin } = await supabase.rpc("est_admin");
  if (!estAdmin) {
    vue.innerHTML = `<h1>Accès réservé</h1><div class="trait-corail"></div>
      <p class="muet">Votre compte (${esc(data.session.user.email)}) est bien créé, mais il n'a pas encore les droits d'administration Cleaneroo.</p>`;
    return;
  }
  liste();
}

function ecranConnexion(message = "") {
  vue.innerHTML = `<h1>Gestion Cleaneroo</h1><div class="trait-corail"></div>
    <p class="muet">Espace réservé à l'équipe Cleaneroo.</p>
    <form class="carte" id="connexion">
      <label class="champ">E-mail<input type="email" name="email" required autocomplete="username"></label>
      <label class="champ">Mot de passe<input type="password" name="mdp" required minlength="10" autocomplete="current-password"></label>
      ${message ? `<p class="erreur">${esc(message)}</p>` : ""}
      <button class="bouton plein" type="submit">Se connecter</button>
      <button class="lien-bouton" type="button" id="creer">Première fois ? Créer le compte administrateur</button>
    </form>`;
  const f = document.getElementById("connexion");
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.value.trim(), password: f.mdp.value });
    if (error) return ecranConnexion(error.message.includes("Email not confirmed") ? "Confirmez d'abord votre e-mail (lien reçu par e-mail)." : "E-mail ou mot de passe incorrect.");
    demarrer();
  });
  document.getElementById("creer").addEventListener("click", async () => {
    if (!f.reportValidity()) return;
    const { error } = await supabase.auth.signUp({ email: f.email.value.trim(), password: f.mdp.value });
    ecranConnexion(error ? error.message : "Compte créé. Ouvrez l'e-mail de confirmation reçu, cliquez sur le lien, puis revenez vous connecter.");
  });
}

const TYPES_INSCRIPTION = { client: "Client", cleaneur: "Cleaneur", conciergerie: "Conciergerie" };
let onglet = "demandes";

const ongletsHtml = () => `<div class="segments" style="margin:6px 0 4px">
  <button type="button" data-onglet="demandes" class="${onglet === "demandes" ? "choisi" : ""}">Demandes</button>
  <button type="button" data-onglet="inscriptions" class="${onglet === "inscriptions" ? "choisi" : ""}">Inscriptions au lancement</button></div>`;
const brancherOnglets = () => vue.querySelectorAll("[data-onglet]").forEach(bt => bt.onclick = () => { onglet = bt.dataset.onglet; liste(); });

async function listeInscriptions() {
  const { data, error } = await supabase.from("inscriptions").select("*").order("cree_le", { ascending: false }).limit(1000);
  if (error) { vue.innerHTML = `<p class="erreur">${esc(error.message)}</p>`; return; }
  const n = t => data.filter(i => i.type === t).length;
  const csv = () => {
    const lignes = [["type", "prenom", "nom", "email", "telephone", "code_postal", "ville", "message", "inscrit_le"],
      ...data.map(i => [i.type, i.prenom, i.nom, i.email, i.telephone, i.code_postal, i.ville, i.message, i.cree_le])];
    const texte = lignes.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + texte], { type: "text/csv;charset=utf-8" }));
    a.download = "inscriptions-cleaneroo.csv"; a.click();
  };
  vue.innerHTML = `<h1>Gestion</h1><div class="trait-corail"></div>${ongletsHtml()}
    <p class="muet">${data.length} inscrits · ${n("client")} clients · ${n("cleaneur")} Cleaneurs · ${n("conciergerie")} conciergeries</p>
    <button class="bouton secondaire" id="export">Télécharger la liste (Excel)</button>
    <div style="margin-top:14px">${data.map(i => `<div class="carte" style="margin-bottom:10px">
      <b>${esc(i.prenom)} ${esc(i.nom)}</b> <span class="tampon">${TYPES_INSCRIPTION[i.type]}</span>
      <div class="petit"><a href="mailto:${esc(i.email)}">${esc(i.email)}</a>${i.telephone ? ` · <a href="tel:${esc(i.telephone)}">${esc(i.telephone)}</a>` : ""} · ${esc(i.code_postal)} ${esc(i.ville)} · ${dateLongue(new Date(i.cree_le))}</div>
      ${i.message ? `<p class="muet" style="margin:6px 0 0">${esc(i.message)}</p>` : ""}</div>`).join("") || `<p class="muet">Aucune inscription pour l'instant.</p>`}</div>`;
  brancherOnglets();
  document.getElementById("export").onclick = csv;
}

async function liste() {
  if (onglet === "inscriptions") return listeInscriptions();
  const { data, error } = await supabase.from("demandes").select("*").order("cree_le", { ascending: false }).limit(300);
  if (error) { vue.innerHTML = `<p class="erreur">${esc(error.message)}</p>`; return; }
  const compte = s => data.filter(d => d.statut === s).length;
  const affichees = filtre === "TOUTES" ? data : data.filter(d => d.statut === filtre);
  vue.innerHTML = `<h1>Gestion</h1><div class="trait-corail"></div>${ongletsHtml()}
    <div class="filtres">${["VERIFICATION", "PUBLIEE", "CONFIRMEE", "EN_COURS", "A_VALIDER", "TERMINEE", "ANNULEE", "TOUTES"].map(s =>
      `<button type="button" data-filtre="${s}" class="${filtre === s ? "choisi" : ""}">${s === "TOUTES" ? `Toutes (${data.length})` : `${STATUTS[s]} (${compte(s)})`}</button>`).join("")}</div>
    ${affichees.length ? affichees.map(d => {
      const r = rubrique(d.rubrique_id);
      return `<div class="carte ligne-demande" data-id="${d.id}">
        <div><b>${r.emoji} ${r.nom}</b> · ${esc(d.ville)}${d.prelancement ? ` <span class="tampon">Pré-réservation</span>` : ""}<div class="petit">${esc(d.reference)} · ${esc(d.prenom)} ${esc(d.nom)} · ${d.creneau ? `${dateLongue(new Date(d.creneau))} ${heure(new Date(d.creneau).getHours())}` : "flexible"}</div></div>
        <div style="text-align:right"><span class="tampon">${STATUTS[d.statut]}</span><div class="petit">${d.sur_devis ? "Sur devis" : euros(d.estimation_c)}</div></div></div>`;
    }).join("") : `<p class="muet">Aucune demande dans cette liste.</p>`}`;
  brancherOnglets();
  vue.querySelectorAll("[data-filtre]").forEach(bt => bt.onclick = () => { filtre = bt.dataset.filtre; liste(); });
  vue.querySelectorAll("[data-id]").forEach(c => c.onclick = () => detail(data.find(d => d.id === c.dataset.id)));
}

async function detail(d) {
  const r = rubrique(d.rubrique_id);
  const det = d.details || {};
  const acces = d.acces || {};
  const urls = await Promise.all((d.photos || []).map(async p => (await supabase.storage.from("photos-demandes").createSignedUrl(p, 3600)).data?.signedUrl));
  const taches = (r.taches || []).filter(t => (det.taches || []).includes(t.id)).map(t => t.nom);
  vue.innerHTML = `<button class="lien-bouton" id="retour">‹ Toutes les demandes</button>
    <h1>${r.emoji} ${r.nom}</h1><div class="trait-corail"></div>
    <p class="muet">${esc(d.reference)} · reçue le ${dateLongue(new Date(d.cree_le))} · <span class="tampon">${STATUTS[d.statut]}</span></p>
    <div class="carte"><dl class="detail-demande" style="margin:0">
      <dt>Client</dt><dd>${esc(d.prenom)} ${esc(d.nom)} · <a href="tel:${esc(d.telephone)}">${esc(d.telephone)}</a> · <a href="mailto:${esc(d.email)}">${esc(d.email)}</a> · espace ${esc(d.espace)}</dd>
      <dt>Adresse</dt><dd>${esc(d.rue)}, ${esc(d.code_postal)} ${esc(d.ville)}</dd>
      <dt>Créneau</dt><dd>${d.creneau ? `${dateLongue(new Date(d.creneau))} à ${heure(new Date(d.creneau).getHours())}` : "Flexible (7 jours)"} · ${d.choix_cleaneur === "directe" ? "réservation directe" : "candidatures"}</dd>
      <dt>Accès</dt><dd>${ACCUEIL[d.accueil] || d.accueil}${acces.nom ? ` · ${esc(acces.nom)} ${esc(acces.telephone)}` : ""}${acces.emplacement ? ` · ${esc(acces.emplacement)}` : ""}${acces.code ? ` · code : ${esc(acces.code)}` : ""}</dd>
      <dt>Estimation</dt><dd>${d.sur_devis ? "Sur devis" : euros(d.estimation_c)} · ${duree(d.duree_min)}${d.nombre_cleaneurs === 2 ? " · 2 Cleaneurs" : ""}${d.credit_impot_c ? ` · crédit d'impôt ${euros(d.credit_impot_c)}` : ""}</dd>
      <dt>Détail</dt><dd>${(det.lignes || []).map(l => `${esc(l.libelle)} : ${euros(l.montantC)}`).join("<br>") || "—"}</dd>
      ${taches.length ? `<dt>Tâches</dt><dd>${taches.map(esc).join(", ")}</dd>` : ""}
      ${(det.tachesPerso || []).length ? `<dt>Demandes particulières</dt><dd>${det.tachesPerso.map(esc).join(" · ")}</dd>` : ""}
      ${d.remarque ? `<dt>Précision du client</dt><dd>${esc(d.remarque)}</dd>` : ""}
      ${urls.length ? `<dt>Photos</dt><dd class="photos-admin">${urls.filter(Boolean).map(u => `<a href="${u}" target="_blank"><img src="${u}" alt=""></a>`).join("")}</dd>` : ""}
    </dl></div>
    <label class="champ" style="margin-top:14px">Notes internes<textarea id="notes" rows="3">${esc(d.notes_admin)}</textarea></label>
    <div class="boutons" style="margin-top:8px">
      ${SUIVANT[d.statut] ? `<button class="bouton" id="avancer">Passer à « ${STATUTS[SUIVANT[d.statut]]} »</button>` : ""}
      <button class="bouton secondaire" id="enregistrer">Enregistrer les notes</button>
      ${!["TERMINEE", "ANNULEE"].includes(d.statut) ? `<button class="bouton danger" id="annuler">Annuler la demande</button>` : ""}
    </div>
    <p class="petit">Prochainement : candidatures des Cleaneurs, messages et compte rendu photo (étape 2 du site).</p>`;
  const maj = async champs => {
    const { error } = await supabase.from("demandes").update(champs).eq("id", d.id);
    if (error) return alert(error.message);
    const { data } = await supabase.from("demandes").select("*").eq("id", d.id).single();
    detail(data);
  };
  document.getElementById("retour").onclick = liste;
  document.getElementById("enregistrer").onclick = () => maj({ notes_admin: document.getElementById("notes").value });
  document.getElementById("avancer")?.addEventListener("click", () => maj({ statut: SUIVANT[d.statut], notes_admin: document.getElementById("notes").value }));
  document.getElementById("annuler")?.addEventListener("click", () => confirm("Annuler cette demande ?") && maj({ statut: "ANNULEE" }));
}

document.getElementById("deconnexion").addEventListener("click", async e => { e.preventDefault(); await supabase.auth.signOut(); location.reload(); });
demarrer();
