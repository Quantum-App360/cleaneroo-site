// Écran de gestion Cleaneroo : réservé aux comptes « admin » (règles de sécurité de la base).
// Équivalent de « Administration (démo) » de l'application : vérifier, publier, confirmer, faire avancer ou refuser une demande.
import { decorTableau } from "./commun.js";
import { supabase, secteursARecruter, dossiersCleaneurs, documentsDe, deciderDossier, deciderDocument, lienDocument, DOCUMENTS_CLEANEUR } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { icone } from "./icones.js";
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
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>
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

/* Points de contrôle des documents (11 novembre 2026, règles reprises de l'appli iPhone de Vincent). */
const AIDE_CONTROLE = {
  identite: "À contrôler : pièce en cours de validité, recto et verso, numéro de 9 à 12 caractères. Hors Union européenne, EEE et Suisse : titre de séjour qui autorise à travailler. Cartes d'identité de majeurs délivrées entre 2004 et 2013 (date de fin imprimée entre 2014 et 2023) : valables 5 ans de plus que la date imprimée.",
  urssaf: `À contrôler : attestation de moins de 6 mois, même SIREN que le dossier, code de sécurité de 15 caractères à vérifier sur <a href="https://www.urssaf.fr/accueil/outils-documentation/outils/verification-attestation.html" target="_blank" rel="noopener">urssaf.fr</a> (micro-entrepreneur : <a href="https://www.autoentrepreneur.urssaf.fr/portail/accueil/verification-attestations.html" target="_blank" rel="noopener">autoentrepreneur.urssaf.fr</a>).`,
  siret: "À contrôler : avis de situation INSEE ou Kbis de moins de 3 mois, même SIRET que le dossier, établissement actif.",
  rc_pro: "À contrôler : assureur, numéro de contrat, date de fin, activités couvertes (ménage à domicile, locaux professionnels, vitres…).",
};

const TYPES_INSCRIPTION = { client: "Client", cleaneur: "Cleaneur", conciergerie: "Conciergerie", rappel: "À rappeler" };
const CRENEAUX_RAPPEL = { matin: "le matin", midi: "à midi", apres_midi: "l'après-midi", soir: "en soirée" };
let onglet = "demandes";

const ongletsHtml = () => `<div class="segments" style="margin:6px 0 4px;flex-wrap:wrap;border-radius:22px">
  <button type="button" data-onglet="demandes" class="${onglet === "demandes" ? "choisi" : ""}">Demandes</button>
  <button type="button" data-onglet="inscriptions" class="${onglet === "inscriptions" ? "choisi" : ""}">Inscriptions au lancement</button>
  <button type="button" data-onglet="dossiers" class="${onglet === "dossiers" ? "choisi" : ""}">Dossiers Cleaneurs</button>
  <button type="button" data-onglet="secteurs" class="${onglet === "secteurs" ? "choisi" : ""}">Secteurs à recruter</button>
  <button type="button" data-onglet="visites" class="${onglet === "visites" ? "choisi" : ""}">Visites</button></div>`;
const brancherOnglets = () => vue.querySelectorAll("[data-onglet]").forEach(bt => bt.onclick = () => { onglet = bt.dataset.onglet; liste(); });

async function listeInscriptions() {
  const { data, error } = await supabase.from("inscriptions").select("*").order("cree_le", { ascending: false }).limit(1000);
  if (error) { vue.innerHTML = `<p class="erreur">${esc(error.message)}</p>`; return; }
  const n = t => data.filter(i => i.type === t).length;
  const csv = () => {
    const lignes = [["type", "prenom", "nom", "email", "telephone", "code_postal", "ville", "profil", "creneau", "message", "inscrit_le"],
      ...data.map(i => [i.type, i.prenom, i.nom, i.email, i.telephone, i.code_postal, i.ville, i.profil, i.creneau, i.message, i.cree_le])];
    const texte = lignes.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + texte], { type: "text/csv;charset=utf-8" }));
    a.download = "inscriptions-cleaneroo.csv"; a.click();
  };
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}
    <p class="muet">${data.length} inscrits · ${n("client")} clients · ${n("cleaneur")} Cleaneurs · ${n("conciergerie")} conciergeries · ${n("rappel")} à rappeler</p>
    <p class="note">Offre de lancement : <b>${data.filter(i => i.type === "cleaneur" && i.valide_le).length}</b> dossier(s) Cleaneur validé(s) · 3 mois de formule Pro offerts aux Cleaneurs inscrits jusqu'au 31 janvier 2027 (sans limite de places).</p>
    <button class="bouton secondaire" id="export">Télécharger la liste (Excel)</button>
    <div style="margin-top:14px">${data.map(i => `<div class="carte" style="margin-bottom:10px">
      <b>${esc(i.prenom)} ${esc(i.nom)}</b> <span class="tampon">${TYPES_INSCRIPTION[i.type]}</span>
      <div class="petit">${i.type === "rappel" ? `${esc(i.profil)} · à rappeler ${CRENEAUX_RAPPEL[i.creneau] || ""}` : `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a>`}${i.telephone ? ` · <a href="tel:${esc(i.telephone)}">${esc(i.telephone)}</a>` : ""} · ${esc(i.code_postal)} ${esc(i.ville)} · ${dateLongue(new Date(i.cree_le))}</div>
      ${i.message ? `<p class="muet" style="margin:6px 0 0">${esc(i.message)}</p>` : ""}
      ${i.type === "cleaneur" ? (i.valide_le
        ? `<p class="petit" style="margin:8px 0 0;color:var(--succes)"><b>Dossier validé le ${dateLongue(new Date(i.valide_le))}</b> · <button type="button" class="lien-bouton" style="padding:0;min-height:0" data-valider="${i.id}" data-valeur="non">Annuler la validation</button></p>`
        : `<button type="button" class="bouton secondaire" style="margin-top:8px" data-valider="${i.id}" data-valeur="oui">Valider le dossier (offre de lancement)</button>`) : ""}</div>`).join("") || `<p class="muet">Aucune inscription pour l'instant.</p>`}</div>`;
  brancherOnglets();
  document.getElementById("export").onclick = csv;
  // Validation d'un dossier Cleaneur : une place de l'offre de lancement est attribuée (ordre de validation).
  vue.querySelectorAll("[data-valider]").forEach(bt => bt.onclick = async () => {
    const oui = bt.dataset.valeur === "oui";
    if (!confirm(oui ? "Valider ce dossier ? Une place de l'offre de lancement lui est attribuée." : "Annuler la validation de ce dossier ?")) return;
    bt.disabled = true;
    const { error } = await supabase.rpc("valider_dossier_cleaneur", { inscription: bt.dataset.valider, valide: oui });
    if (error) { alert(error.message); bt.disabled = false; return; }
    listeInscriptions();
  });
}

/* Dossiers des Cleaneurs inscrits avec un compte : profil, documents scannés, validation (place de l'offre de lancement). */
const ETAT_DOSSIER = { BROUILLON: "À compléter", A_VERIFIER: "À vérifier", VALIDE: "Validé", REFUSE: "À corriger" };
const NOM_DOC = Object.fromEntries(DOCUMENTS_CLEANEUR.map(d => [d.type, d.nom]));
async function listeDossiers() {
  let data;
  try { data = await dossiersCleaneurs(); } catch (e) { vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}<p class="erreur">${esc(e.message)}</p>`; brancherOnglets(); return; }
  const n = e => data.filter(d => d.dossier === e).length;
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}
    <p class="muet">${data.length} compte(s) Cleaneur · ${n("A_VERIFIER")} à vérifier · ${n("VALIDE")} validé(s) · ${n("BROUILLON")} en préparation · ${n("REFUSE")} à corriger</p>
    ${data.map(d => `<div class="carte ligne-demande" data-dossier="${d.id}"><div><b>${esc(d.prenom)} ${esc(d.nom)}</b>
      <div class="petit">${esc(d.email)} · ${esc(d.code_postal)} ${esc(d.ville)}${d.dossier_soumis_le ? ` · envoyé le ${dateLongue(new Date(d.dossier_soumis_le))}` : ""}</div></div>
      <div style="text-align:right"><span class="tampon">${ETAT_DOSSIER[d.dossier]}</span></div></div>`).join("") || `<p class="muet">Aucun compte Cleaneur pour l'instant.</p>`}`;
  brancherOnglets();
  vue.querySelectorAll("[data-dossier]").forEach(c => c.onclick = () => detailDossier(data.find(d => d.id === c.dataset.dossier)));
}

async function detailDossier(d) {
  const docs = await documentsDe(d.id).catch(() => []);
  vue.innerHTML = `<button class="lien-bouton" id="retour">‹ Tous les dossiers</button>
    <h1>${esc(d.prenom)} ${esc(d.nom)}</h1><div class="trait-corail"></div>
    <p class="muet">Compte créé le ${dateLongue(new Date(d.cree_le))} · <span class="tampon">${ETAT_DOSSIER[d.dossier]}</span>${d.valide_le ? ` · validé le ${dateLongue(new Date(d.valide_le))}` : ""}</p>
    <div class="carte"><dl class="detail-demande" style="margin:0">
      <dt>Contact</dt><dd><a href="mailto:${esc(d.email)}">${esc(d.email)}</a>${d.telephone ? ` · <a href="tel:${esc(d.telephone)}">${esc(d.telephone)}</a>` : ""}</dd>
      <dt>Secteur</dt><dd>${esc(d.code_postal)} ${esc(d.ville)} · ${d.zone_km} km</dd>
      <dt>SIRET</dt><dd>${d.siret ? `${esc(d.siret)} · <a href="https://annuaire-entreprises.data.gouv.fr/etablissement/${esc(d.siret)}" target="_blank" rel="noopener">vérifier dans l'annuaire des entreprises</a>` : "—"}</dd>
      <dt>Prestations</dt><dd>${(d.prestations || []).map(id => esc(rubrique(id)?.nom || id)).join(", ") || "—"}</dd>
      ${d.dossier_motif ? `<dt>Motif envoyé</dt><dd>${esc(d.dossier_motif)}</dd>` : ""}
    </dl></div>
    <h2 style="margin-top:20px">Documents</h2>
    ${docs.map(x => `<div class="carte" style="margin-bottom:10px"><b>${NOM_DOC[x.type] || x.type}</b> <span class="tampon">${{ A_VERIFIER: "À vérifier", ACCEPTE: "Accepté", REFUSE: "Refusé" }[x.statut]}</span>
      <div class="petit">déposé le ${dateLongue(new Date(x.cree_le))}${x.motif ? ` · ${esc(x.motif)}` : ""}</div>
      ${AIDE_CONTROLE[x.type] ? `<p class="petit" style="margin:6px 0 0">${AIDE_CONTROLE[x.type]}</p>` : ""}
      <div class="boutons" style="margin-top:8px"><button class="bouton secondaire" data-voir="${esc(x.chemin)}">Voir</button>
        ${x.statut !== "ACCEPTE" ? `<button class="bouton secondaire" data-doc-ok="${x.id}">Accepter</button>` : ""}
        ${x.statut !== "REFUSE" ? `<button class="bouton danger" data-doc-non="${x.id}">Refuser</button>` : ""}</div></div>`).join("") || `<p class="muet">Aucun document déposé.</p>`}
    <div class="boutons" style="margin-top:14px">
      ${d.dossier !== "VALIDE" ? `<button class="bouton" id="valider">Valider le dossier (offre de lancement)</button>` : `<button class="bouton secondaire" id="invalider">Annuler la validation</button>`}
      ${d.dossier !== "REFUSE" ? `<button class="bouton danger" id="refuser">Demander une correction</button>` : ""}
    </div>`;
  const recharger = async () => { const liste = await dossiersCleaneurs().catch(() => []); const n = liste.find(x => x.id === d.id); n ? detailDossier(n) : listeDossiers(); };
  document.getElementById("retour").onclick = listeDossiers;
  vue.querySelectorAll("[data-voir]").forEach(b => b.onclick = async () => { const f = window.open("", "_blank"); try { f.location = await lienDocument(b.dataset.voir); } catch { f?.close(); } });
  vue.querySelectorAll("[data-doc-ok]").forEach(b => b.onclick = async () => { await deciderDocument(b.dataset.docOk, true).catch(e => alert(e.message)); recharger(); });
  vue.querySelectorAll("[data-doc-non]").forEach(b => b.onclick = async () => {
    const motif = prompt("Motif du refus (visible par le Cleaneur) :", "Document illisible ou périmé");
    if (motif === null) return;
    await deciderDocument(b.dataset.docNon, false, motif).catch(e => alert(e.message)); recharger();
  });
  document.getElementById("valider")?.addEventListener("click", async () => {
    if (!confirm("Valider ce dossier ? Tous ses documents sont acceptés et une place de l'offre de lancement lui est attribuée.")) return;
    await deciderDossier(d.id, true).catch(e => alert(e.message)); recharger();
  });
  document.getElementById("invalider")?.addEventListener("click", async () => {
    if (!confirm("Annuler la validation ? Le dossier repasse « À corriger ».")) return;
    await deciderDossier(d.id, false, "Validation annulée par l'équipe Cleaneroo.").catch(e => alert(e.message)); recharger();
  });
  document.getElementById("refuser")?.addEventListener("click", async () => {
    const motif = prompt("Que doit corriger le Cleaneur ? (visible dans son espace)", "");
    if (!motif) return;
    await deciderDossier(d.id, false, motif).catch(e => alert(e.message)); recharger();
  });
}

/* Visites du site et ouvertures de l'appli (table « visites », sans donnée personnelle). */
const APPAREILS = { mobile: "Téléphone", tablette: "Tablette", ordinateur: "Ordinateur" };
async function listeVisites() {
  const { data: st, error } = await supabase.rpc("statistiques_visites");
  if (error) { vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}<p class="erreur">${esc(error.message)}</p>`; brancherOnglets(); return; }
  const [jour, semaine, mois, total] = st.periodes;
  const tuile = (titre, p) => `<div class="carte" style="text-align:center"><div class="petit">${titre}</div>
    <div style="font-size:30px;font-weight:800;color:var(--primaire)">${p.visites}</div><div class="petit">visiteurs uniques · ${p.pages} pages vues</div>
    <div class="petit">${p.appli} ouverture(s) de l'appli</div></div>`;
  const max = Math.max(1, ...st.par_jour.map(d => d.visites + d.appli));
  const barres = st.par_jour.map(d => {
    const date = new Date(d.jour + "T12:00:00");
    return `<div title="${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} : ${d.visites} visiteur(s), ${d.appli} appareil(s) sur l’appli de l'appli"
      style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;height:140px">
      <span style="display:block;height:${Math.round(d.appli * 130 / max)}px;background:var(--corail);border-radius:3px 3px 0 0"></span>
      <span style="display:block;height:${Math.round(d.visites * 130 / max)}px;background:var(--turquoise);border-radius:${d.appli ? 0 : "3px 3px"} 0 0"></span></div>`;
  }).join("");
  const debut = new Date(st.par_jour[0].jour + "T12:00:00"), fin = new Date(st.par_jour.at(-1).jour + "T12:00:00");
  const appareils = Object.entries(st.appareils);
  const totalApp = appareils.reduce((a, [, n]) => a + n, 0) || 1;
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}
    <p class="muet">Compteur sans cookie ni donnée personnelle. Une même adresse IP compte une seule visite par jour, même avec plusieurs onglets, rechargements ou connexions (l’adresse n’est jamais enregistrée : seule une empreinte qui change chaque jour est gardée).</p>
    <div class="grille-3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${tuile("Aujourd'hui", jour)}${tuile("7 derniers jours", semaine)}${tuile("30 derniers jours", mois)}${tuile("Depuis le début", total)}</div>
    <div class="carte" style="margin-top:14px"><b>30 derniers jours</b>
      <div style="display:flex;gap:3px;align-items:flex-end;margin-top:12px">${barres}</div>
      <div class="petit" style="display:flex;justify-content:space-between;margin-top:6px"><span>${debut.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span><span>${fin.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span></div>
      <div class="legende-creneaux petit"><span>Visites du site</span><span class="forte">Ouvertures de l'appli</span></div></div>
    <div class="grille-2" style="margin-top:14px">
      <div class="carte"><b>Pages les plus vues (30 jours)</b>${st.pages.map(p => `<div class="ligne-montant"><span>${esc(p.page)}</span><b>${p.n}</b></div>`).join("") || `<p class="muet">Aucune page vue pour l'instant.</p>`}</div>
      <div><div class="carte"><b>Appareils (30 jours)</b>${appareils.map(([a, n]) => `<div class="ligne-montant"><span>${APPAREILS[a] || a}</span><b>${Math.round(n * 100 / totalApp)} %</b></div>`).join("") || `<p class="muet">—</p>`}</div>
        <div class="carte" style="margin-top:14px"><b>D'où viennent les visiteurs (30 jours)</b>${st.origines.map(o => `<div class="ligne-montant"><span>${esc(o.origine)}</span><b>${o.n}</b></div>`).join("") || `<p class="muet">Accès direct uniquement pour l'instant.</p>`}</div></div>
    </div>`;
  brancherOnglets();
}

/* Secteurs à recruter (11 novembre 2026) : où des clients attendent une prestation (« Être prévenu ») et où arrivent
   les pré-réservations. Les plus demandés d'abord : c'est là qu'il faut trouver des Cleaneurs. */
async function listeSecteurs() {
  let lignes;
  try { lignes = await secteursARecruter(); } catch (e) { vue.innerHTML = `<p class="erreur">${esc(e.message)}</p>`; return; }
  const total = k => lignes.reduce((t, l) => t + (l[k] || 0), 0);
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}
    <p class="muet">${total("en_attente")} client(s) en attente · ${total("pre_reservations")} pré-réservation(s) · ${total("a_prevenir")} client(s) à prévenir (un Cleaneur couvre maintenant leur secteur)</p>
    <p class="note">Après le lancement, une prestation ne se réserve que si un Cleaneur validé la propose et couvre l'adresse. Sinon le client laisse ses coordonnées : recrutez en priorité dans les villes du haut de la liste.</p>
    <div style="margin-top:14px">${lignes.map(l => `<div class="carte" style="margin-bottom:10px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><b>${esc(l.ville || "—")}</b> · ${esc(rubrique(l.rubrique_id)?.nom || l.rubrique_id)}</div>
      <div class="petit">${l.en_attente} en attente · ${l.pre_reservations} pré-réservation(s)${l.a_prevenir ? ` · <b style="color:var(--succes)">${l.a_prevenir} à prévenir</b>` : ""}</div></div>`).join("")
      || `<p class="muet">Aucune demande pour l'instant.</p>`}</div>`;
  brancherOnglets();
}

async function liste() {
  if (onglet === "inscriptions") return listeInscriptions();
  if (onglet === "dossiers") return listeDossiers();
  if (onglet === "visites") return listeVisites();
  if (onglet === "secteurs") return listeSecteurs();
  const { data, error } = await supabase.from("demandes").select("*").order("cree_le", { ascending: false }).limit(300);
  if (error) { vue.innerHTML = `<p class="erreur">${esc(error.message)}</p>`; return; }
  const compte = s => data.filter(d => d.statut === s).length;
  const affichees = filtre === "TOUTES" ? data : data.filter(d => d.statut === filtre);
  vue.innerHTML = `<h1>Tableau de bord</h1><div class="trait-corail"></div>${ongletsHtml()}
    <div class="filtres">${["VERIFICATION", "PUBLIEE", "CONFIRMEE", "EN_COURS", "A_VALIDER", "TERMINEE", "ANNULEE", "TOUTES"].map(s =>
      `<button type="button" data-filtre="${s}" class="${filtre === s ? "choisi" : ""}">${s === "TOUTES" ? `Toutes (${data.length})` : `${STATUTS[s]} (${compte(s)})`}</button>`).join("")}</div>
    ${affichees.length ? affichees.map(d => {
      const r = rubrique(d.rubrique_id);
      return `<div class="carte ligne-demande" data-id="${d.id}">
        <div><b>${icone(r.icone)} ${r.nom}</b> · ${esc(d.ville)}${d.prelancement ? ` <span class="tampon">Pré-réservation</span>` : ""}<div class="petit">${esc(d.reference)} · ${esc(d.prenom)} ${esc(d.nom)} · ${d.creneau ? `${dateLongue(new Date(d.creneau))} ${heure(new Date(d.creneau).getHours())}` : "flexible"}</div></div>
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
    <h1>${icone(r.icone)} ${r.nom}</h1><div class="trait-corail"></div>
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

// Décor animé en fond (étoiles, bulles, éponge qui mousse), comme le tableau de bord du compte.
decorTableau(true);
