// Espace « Ma société » (16 novembre 2026, validé par l'utilisateur) : une société de nettoyage avec des salariés.
// La société est un compte Cleaneur vérifié. Elle invite ses salariés par un lien ; Cleaneroo vérifie leur pièce d'identité ;
// elle prend les missions puis les attribue à un chef d'équipe (et des équipiers). Le salarié fait son selfie du jour, son trajet
// et son compte rendu comme un Cleaneur ; la société reçoit le paiement et les factures à son nom.
// Cinq rubriques : Tableau de bord · Planning · Missions · Équipe · Activité. Même espace dans l'appli (Societe.kt).
// Base : outils/base-societe-equipe.sql.
import { supabase, majProfil, deposerDocument } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure, duree, sirenSiretValide, cleaneursRotation } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { esc, chargeur } from "./commun.js";
import { chargerFormations, textes } from "./formations.js";
import { MODULES_EXIGES_PAR_LA_LOI } from "./regles.js";
import { TYPES_PERIODE, aujourdhuiParis, bornesActivite, decalerActivite, joursDe, resumeActivite, evolutionPct, parMois, jourParis, heureParis } from "./activite-societe.js";

const appel = (nom, args) => supabase.rpc(nom, args).then(r => { if (r.error) throw new Error(r.error.message); return r.data; });
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ACTIVES = ["CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS"];
const ETATS = { CONFIRMEE: "Confirmée", EN_ROUTE: "En route", SUR_PLACE: "Sur place", EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée" };
const STATUTS_SALARIE = { INVITE: ["Invité", "gris"], A_VERIFIER: ["Identité à vérifier", ""], ACTIF: ["Actif", "vert"], REFUSE: ["Identité refusée", "rouge"] };
const LIEN = code => `https://cleaneroo.fr/#/rejoindre/${code}`;
/** Cleaneurs nécessaires pour une mission : 2 au-delà de 6 h, plus pour une rotation d'hôtel ou de camping. */
const besoin = m => Math.max(m.nombre_cleaneurs || 1, m.rubrique_id === "hospitality" ? cleaneursRotation(m.duree_min || 0) : 1);
let rubriqueSociete = "tableau";
/** Période affichée dans « Activité » : par défaut la semaine en cours (jour de référence null = aujourd'hui). */
const periodeActivite = { type: "semaine", jour: null };

/* ------------------------------------------------------------------ Activation (Cleaneur indépendant → société) */
export function blocActiverSociete(p) {
  if (p.role !== "cleaneur" || p.employeur_id || p.societe_equipe) return "";
  return `<details class="carte" id="activer-societe"><summary><b>${tr("Vous êtes une société de nettoyage avec des salariés ?")}</b></summary>
    <p class="petit">${tr("Activez l'espace « Ma société » : invitez vos salariés, attribuez-leur les missions, suivez leur planning. Les factures sont émises au nom de votre société.")}</p>
    <form id="form-activer-societe" novalidate>
      <label class="champ">Raison sociale<input name="societe" maxlength="120" value="${esc(p.societe || "")}" autocomplete="organization"></label>
      <label class="champ">SIRET de la société<input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret_societe || p.siret || "")}"></label>
      <label class="case"><input type="checkbox" name="engagement"><span>${tr("En tant qu'employeur, je forme mes salariés (hygiène, sécurité, gestes et produits, équipements de protection) et je réponds de leur formation. Une prestation réglementée n'est confiée qu'à un salarié qui a l'attestation exigée par la loi.")}</span></label>
      <p class="erreur" id="erreur-activer-societe"></p>
      <button class="bouton plein" type="submit">${tr("Activer l'espace Ma société")}</button></form></details>`;
}
export function brancherActiverSociete(vue, recharger) {
  const f = vue.querySelector("#form-activer-societe");
  if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("#erreur-activer-societe"), siret = f.siret.value.replace(/\D/g, "");
    if (!f.societe.value.trim() || !sirenSiretValide(siret)) { err.textContent = tr("Indiquez la raison sociale et un SIRET (14 chiffres) ou un SIREN (9 chiffres) valable."); return; }
    if (!f.engagement.checked) { err.textContent = tr("Cochez l'engagement de formation de vos salariés pour continuer."); return; }
    try {
      await majProfil({ societe: f.societe.value.trim(), siret_societe: siret });
      const r = await appel("activer_societe_equipe", { p_oui: true });
      if (r !== "ok") throw new Error(r);
      try { localStorage.setItem("cleaneroo-sous-onglet-cleaneur", "societe"); } catch { /* rien */ }
      recharger();
    } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
}

/* ------------------------------------------------------------------ Espace « Ma société » */
export function blocSociete(p) {
  if (!p.societe_equipe) return "";
  return `<div id="espace-societe" class="espace-societe">${chargeur("Chargement de votre société…", { petit: true })}</div>`;
}

export async function brancherEspaceSociete(vue, p) {
  const boite = vue.querySelector("#espace-societe");
  if (!boite) return;
  let [salaries, missions, tableau, portefeuille, catalogue] = await Promise.all([appel("mes_salaries").catch(() => []), appel("missions_societe").catch(() => []),
    appel("tableau_cleaneur").catch(() => null), appel("mon_portefeuille").catch(() => null), chargerFormations().catch(() => [])]);
  const titreModule = id => { const m = catalogue.find(x => x.id === id); return m ? textes(m).titre : id; };
  const formationsDe = s => (s.formations || []).filter(id => id !== "socle");
  const recharger = () => brancherEspaceSociete(vue, p);
  if (!boite.isConnected) return;
  const actifs = salaries.filter(s => s.statut === "ACTIF");
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const duJour = m => m.creneau && iso(new Date(m.creneau)) === iso(auj);
  const aAttribuer = missions.filter(m => m.statut === "CONFIRMEE" && !m.chef_id);
  const aVenir = missions.filter(m => ACTIVES.includes(m.statut));
  const debutMois = new Date(auj.getFullYear(), auj.getMonth(), 1);
  const caMois = missions.filter(m => ["TERMINEE", "A_VALIDER"].includes(m.statut) && m.creneau && new Date(m.creneau) >= debutMois).reduce((s, m) => s + (m.estimation_c || 0), 0);
  const quand = m => m.creneau ? `${dateLongue(new Date(m.creneau))} · ${heure(new Date(m.creneau).getHours())}` : tr("Date à fixer");
  const qui = m => m.chef_id ? `${esc(m.chef_prenom || "")}${(m.equipiers_prenoms || []).length ? ` + ${esc(m.equipiers_prenoms.join(", "))}` : ""}` : `<span class="a-attribuer">${tr("À attribuer")}</span>`;
  const ligneMission = (m, attribuer = true) => { const r = rubrique(m.rubrique_id) || {};
    return `<div class="carte ligne-compte mission-societe">${icone(r.icone || "termine", { tuile: true })}
      <div class="corps"><div class="haut"><h3>${esc(r.nom || "")}</h3><span class="tampon ${m.chef_id ? "vert" : ""}">${tr(ETATS[m.statut] || m.statut)}</span></div>
        <p class="muet">${quand(m)} · ${esc(m.ville)}${m.duree_min ? ` · ${duree(m.duree_min)}` : ""}</p>
        <p class="petit">${icone("cleaneurs")} ${qui(m)} · ${tr("Besoin")} : ${besoin(m)} ${tr(besoin(m) > 1 ? "Cleaneurs" : "Cleaneur")}</p></div>
      ${attribuer && m.statut === "CONFIRMEE" ? `<button type="button" class="bouton petit" data-attribuer="${esc(m.reference)}">${tr(m.chef_id ? "Modifier" : "Attribuer")}</button>` : ""}</div>`; };

  const RUBRIQUES = [["tableau", "Tableau de bord", "instantane"], ["planning", "Planning", "calendrier"], ["missions", "Missions", "termine"], ["equipe", "Équipe", "cleaneurs"], ["activite", "Activité", "paiement"]];
  const tableauDeBord = () => `
    <div class="tuiles-chiffres tuiles-societe">
      <div class="tuile-chiffre"><b>${missions.filter(m => duJour(m) && ACTIVES.includes(m.statut)).length}</b><span>${tr("Missions aujourd'hui")}</span></div>
      <div class="tuile-chiffre ${aAttribuer.length ? "alerte" : "succes"}"><b>${aAttribuer.length}</b><span>${tr("À attribuer")}</span></div>
      <div class="tuile-chiffre"><b>${actifs.length}</b><span>${tr(actifs.length > 1 ? "Salariés actifs" : "Salarié actif")}</span></div>
      <div class="tuile-chiffre"><b>${actifs.filter(s => ["A_VERIFIER", "VALIDE"].includes(s.selfie_du_jour)).length}/${actifs.length}</b><span>${tr("Selfies du jour")}</span></div>
      <div class="tuile-chiffre"><b>${euros(caMois)}</b><span>${tr("Chiffre d'affaires du mois")}</span></div>
      <div class="tuile-chiffre"><b>${tableau?.note_moyenne ? `★ ${String(tableau.note_moyenne).replace(".", ",")}` : "—"}</b><span>${tr("Note de l'équipe")}</span></div>
    </div>
    ${alertes()}
    <h3 class="sous-titre-societe">${tr("Aujourd'hui")}</h3>
    ${missions.filter(m => duJour(m) && ACTIVES.includes(m.statut)).map(m => ligneMission(m)).join("") || `<p class="muet">${tr("Aucune mission aujourd'hui.")}</p>`}
    <h3 class="sous-titre-societe">${tr("Prochaines missions")}</h3>
    ${aVenir.filter(m => !duJour(m)).slice(0, 6).map(m => ligneMission(m)).join("") || `<p class="muet">${tr("Aucune mission à venir. Prenez des missions dans l'onglet « Missions » de votre espace.")}</p>`}`;
  const alertes = () => {
    const l = [];
    const demain = iso(plusJours(auj, 1));
    aAttribuer.filter(m => m.creneau && iso(new Date(m.creneau)) <= demain).forEach(m => l.push(`${tr("Mission sans intervenant")} : ${esc(rubrique(m.rubrique_id)?.nom || "")} · ${quand(m)}`));
    const aVerifier = salaries.filter(s => s.statut === "A_VERIFIER");
    if (aVerifier.length) l.push(`${aVerifier.length} ${tr(aVerifier.length > 1 ? "salariés en attente de vérification d'identité" : "salarié en attente de vérification d'identité")}`);
    salaries.filter(s => s.statut === "A_VERIFIER" && !s.identite).forEach(s => l.push(`${esc(s.prenom)} : ${tr("pièce d'identité à envoyer depuis son accès")}`));
    return l.length ? `<div class="carte alerte-societe">${l.map(x => `<p>⚠️ ${x}</p>`).join("")}</div>` : "";
  };
  const planning = () => {
    const jours = [...Array(7)].map((_, i) => plusJours(auj, i));
    const lignes = [{ membre_id: p.id, prenom: tr("Moi (gérant)") }, ...actifs];
    const cellule = (membre, j) => missions.filter(m => ACTIVES.concat(["A_VALIDER", "TERMINEE"]).includes(m.statut) && m.creneau && iso(new Date(m.creneau)) === iso(j)
        && ((membre.membre_id === p.id && !m.chef_id) || m.chef_id === membre.membre_id || (m.equipiers || []).includes(membre.membre_id)))
      .map(m => `<span class="creneau-societe ${m.chef_id === membre.membre_id || (!m.chef_id && membre.membre_id === p.id) ? "chef" : ""}" title="${esc(rubrique(m.rubrique_id)?.nom || "")} · ${esc(m.ville)}">${heure(new Date(m.creneau).getHours())} ${icone(rubrique(m.rubrique_id)?.icone || "termine")}</span>`).join("");
    return `<p class="petit" style="margin-top:0">${tr("Chaque salarié, jour par jour, sur 7 jours. En couleur pleine : chef d'équipe ; en contour : équipier.")}</p>
      <div class="planning-societe"><table><thead><tr><th></th>${jours.map(j => `<th>${esc(j.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" }))}</th>`).join("")}</tr></thead>
      <tbody>${lignes.map(s => `<tr><th>${esc(s.prenom)}</th>${jours.map(j => `<td>${cellule(s, j)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  };
  const missionsOnglet = () => `
    <p class="petit" style="margin-top:0">${tr("Prenez une mission (onglet « Missions » de votre espace), puis attribuez-la ici : le chef d'équipe fait le selfie, le trajet et le compte rendu ; les équipiers l'accompagnent.")}</p>
    <h3 class="sous-titre-societe">${tr("À attribuer")} (${aAttribuer.length})</h3>
    ${aAttribuer.map(m => ligneMission(m)).join("") || `<p class="muet">${tr("Toutes vos missions ont un intervenant.")}</p>`}
    <h3 class="sous-titre-societe">${tr("Attribuées")}</h3>
    ${aVenir.filter(m => m.chef_id).map(m => ligneMission(m)).join("") || `<p class="muet">${tr("Aucune mission attribuée.")}</p>`}
    <h3 class="sous-titre-societe">${tr("Terminées (45 derniers jours)")}</h3>
    ${missions.filter(m => ["A_VALIDER", "TERMINEE"].includes(m.statut)).slice(-10).reverse().map(m => ligneMission(m, false)).join("") || `<p class="muet">${tr("Aucune mission terminée.")}</p>`}`;
  const equipe = () => `
    <div class="carte"><b>${tr("Inviter un salarié")}</b>
      <p class="petit" style="margin:4px 0 8px">${tr("Il reçoit un lien pour créer son accès, puis envoie sa pièce d'identité : Cleaneroo la vérifie avant sa première mission.")}</p>
      <form id="form-inviter-salarie" novalidate><div class="grille-2"><label class="champ">Prénom<input name="prenom" maxlength="80" required></label>
        <label class="champ">Nom<input name="nom" maxlength="80"></label></div>
        <label class="champ">Téléphone ou e-mail (facultatif)<input name="contact" maxlength="120"></label>
        <p class="erreur" id="erreur-inviter"></p><button class="bouton plein" type="submit">${tr("Créer le lien d'invitation")}</button></form>
      <div id="lien-invitation"></div></div>
    <p class="petit">${tr("Vous êtes garant de la formation de vos salariés. Chacun peut suivre les formations Cleaneroo depuis son accès et y déposer ses attestations ; une prestation réglementée (Certibiocide) n'est attribuée qu'à un salarié qui l'a.")}</p>
    <h3 class="sous-titre-societe">${tr("Mon équipe")} (${salaries.length})</h3>
    ${salaries.map(s => { const [lib, teinte] = STATUTS_SALARIE[s.statut] || [s.statut, ""];
      return `<div class="carte ligne-compte salarie">${`<span class="avatar-favori grand">${esc((s.prenom || "?").charAt(0).toUpperCase())}</span>`}
        <div class="corps"><div class="haut"><h3>${esc(s.prenom)} ${esc(s.nom)}</h3><span class="tampon ${teinte}">${tr(lib)}</span></div>
          <p class="petit">${s.statut === "INVITE" ? tr("N'a pas encore ouvert son lien.") : `${s.identite ? "✓" : "✗"} ${tr("Pièce d'identité")} · ${["A_VERIFIER", "VALIDE"].includes(s.selfie_du_jour) ? "✓" : "—"} ${tr("Selfie du jour")}`}
            · ${s.missions_a_venir} ${tr(s.missions_a_venir > 1 ? "missions à venir" : "mission à venir")} · ${s.missions_terminees} ${tr(s.missions_terminees > 1 ? "terminées" : "terminée")}${s.note ? ` · ★ ${String(s.note).replace(".", ",")} (${s.nb_avis})` : ""}</p>
          ${s.statut !== "INVITE" ? `<p class="petit formations-salarie">🎓 ${(s.formations || []).includes("socle") ? `✓ ${tr("Socle Cleaneroo")}` : `<span class="muet">${tr("Socle Cleaneroo à suivre")}</span>`}
            ${formationsDe(s).map(id => `<span class="tampon ${MODULES_EXIGES_PAR_LA_LOI.includes(id) ? "" : "vert"}">${esc(titreModule(id))}</span>`).join(" ")}</p>` : ""}
          ${s.statut === "REFUSE" && s.motif ? `<p class="petit erreur">${esc(s.motif)}</p>` : ""}
          <div class="actions-bien">${s.statut === "INVITE" ? `<button type="button" class="lien-bouton" data-renvoyer="${esc(s.code)}" data-prenom="${esc(s.prenom)}">${tr("Renvoyer le lien")}</button>` : ""}
            <button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-salarie="${esc(s.id)}">${tr("Retirer de l'équipe")}</button></div></div></div>`; }).join("")
      || `<p class="muet">${tr("Aucun salarié pour l'instant : invitez le premier ci-dessus.")}</p>`}`;
  const activite = () => `
    <div id="activite-periode" class="activite-periode">${chargeur("Calcul de votre activité…", { petit: true })}</div>
    <h3 class="sous-titre-societe">${tr("Depuis le début de l'année")}</h3>
    <div class="tuiles-chiffres">
      <div class="tuile-chiffre"><b>${euros(portefeuille?.prestations_c || 0)}</b><span>${tr("Prestations facturées cette année")}</span></div>
      <div class="tuile-chiffre"><b>${euros(portefeuille?.commissions_c || 0)}</b><span>${tr("Commissions Cleaneroo")}</span></div>
      <div class="tuile-chiffre"><b>${euros((portefeuille?.pourboires_c || 0) + (portefeuille?.primes_c || 0))}</b><span>${tr("Pourboires et primes")}</span></div>
      <div class="tuile-chiffre"><b>${tableau?.missions_terminees ?? 0}</b><span>${tr("Missions terminées")}</span></div>
    </div>
    <h3 class="sous-titre-societe">${tr("Par salarié")}</h3>
    <div class="carte"><table class="tableau-simple"><thead><tr><th>${tr("Salarié")}</th><th>${tr("Terminées")}</th><th>${tr("À venir")}</th><th>${tr("Note")}</th></tr></thead>
      <tbody>${actifs.map(s => `<tr><td>${esc(s.prenom)} ${esc(s.nom)}</td><td>${s.missions_terminees}</td><td>${s.missions_a_venir}</td><td>${s.note ? `★ ${String(s.note).replace(".", ",")}` : "—"}</td></tr>`).join("") || `<tr><td colspan="4" class="muet">${tr("Aucun salarié actif.")}</td></tr>`}</tbody></table></div>
    <p class="petit">${tr("Les factures sont émises au nom de votre société (rubrique « Activité » de votre espace). Vous restez l'employeur de vos salariés : contrats, salaires et déclarations restent à votre charge.")}</p>`;
  const contenu = { tableau: tableauDeBord, planning, missions: missionsOnglet, equipe, activite };

  boite.innerHTML = `<div class="entete-pro carte entete-societe"><div><span class="surtitre">${tr("Ma société")}</span>
      <h2 style="margin:6px 0 2px">${esc(p.societe || tr("Votre société"))}</h2>
      <p class="petit" style="margin:0">${tr("Prenez les missions, attribuez-les à vos salariés et suivez votre équipe en direct.")}</p></div></div>
    <nav class="onglets-biens onglets-societe">${RUBRIQUES.map(([id, nom, ico]) => `<button type="button" class="${id === rubriqueSociete ? "actif" : ""}" data-rubrique-societe="${id}">${icone(ico)}<span>${tr(nom)}</span>${id === "missions" && aAttribuer.length ? `<em>${aAttribuer.length}</em>` : ""}</button>`).join("")}</nav>
    <div class="contenu-societe">${contenu[rubriqueSociete]()}</div>`;
  traduire(boite);
  if (rubriqueSociete === "activite") afficherActivitePeriode(boite.querySelector("#activite-periode"), { p, missions, salaries, tableau });
  boite.querySelectorAll("[data-rubrique-societe]").forEach(b => b.onclick = () => { rubriqueSociete = b.dataset.rubriqueSociete; brancherEspaceSociete(vue, p); });
  // Attribuer une mission : chef d'équipe et équipiers
  boite.querySelectorAll("[data-attribuer]").forEach(b => b.onclick = () => fenetreAttribution(missions.find(m => m.reference === b.dataset.attribuer), actifs, p, recharger, titreModule));
  // Inviter, renvoyer le lien, retirer
  const f = boite.querySelector("#form-inviter-salarie");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("#erreur-inviter");
    if (!f.prenom.value.trim()) { err.textContent = tr("Indiquez le prénom du salarié."); return; }
    try {
      const code = await appel("inviter_salarie", { p_prenom: f.prenom.value.trim(), p_nom: f.nom.value.trim(), p_contact: f.contact.value.trim() });
      if (!/^[A-Z0-9]{8}$/.test(code || "")) throw new Error(code);
      afficherLien(boite.querySelector("#lien-invitation"), code, f.prenom.value.trim(), p.societe);
      f.reset(); salaries = await appel("mes_salaries").catch(() => salaries);
    } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
  boite.querySelectorAll("[data-renvoyer]").forEach(b => b.onclick = () => { rubriqueSociete = "equipe"; afficherLien(boite.querySelector("#lien-invitation"), b.dataset.renvoyer, b.dataset.prenom, p.societe); boite.querySelector("#lien-invitation").scrollIntoView({ behavior: "smooth", block: "center" }); });
  boite.querySelectorAll("[data-retirer-salarie]").forEach(b => b.onclick = async () => {
    if (!confirm(tr("Retirer ce salarié de l'équipe ? Ses missions à venir reviennent à la société, à réattribuer."))) return;
    await appel("retirer_salarie", { p_id: b.dataset.retirerSalarie }).catch(() => null); recharger();
  });
}

/* ------------------------------------------------------------------ Activité : résumé par période (calculs dans activite-societe.js) */
const SUR_LA_PRECEDENTE = { jour: "sur la veille", semaine: "sur la semaine précédente", mois: "sur le mois précédent", annee: "sur l'année précédente" };
const dateCivile = (j, options) => new Date(`${j}T12:00:00Z`).toLocaleDateString(LOCALE, { timeZone: "UTC", ...options });
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);
function titrePeriode(type, { debut, fin }) {
  if (type === "jour") return majuscule(dateCivile(debut, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  if (type === "mois") return majuscule(dateCivile(debut, { month: "long", year: "numeric" }));
  if (type === "annee") return `${tr("Année")} ${debut.slice(0, 4)}`;
  const memeAn = debut.slice(0, 4) === fin.slice(0, 4), memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  const du = dateCivile(debut, memeMois ? { day: "numeric" } : memeAn ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  return `${tr("Semaine du")} ${du} ${tr("au")} ${dateCivile(fin, { day: "numeric", month: "long", year: "numeric" })}`;
}
const ligneBarre = (libelle, detail, valeurC, maxC) => `<div class="ligne-activite"><div class="nom-activite"><b>${libelle}</b>${detail ? `<span class="petit muet">${detail}</span>` : ""}</div>
  <div class="barre-activite" aria-hidden="true"><span style="width:${maxC > 0 ? Math.max(valeurC > 0 ? 2 : 0, Math.round(valeurC * 100 / maxC)) : 0}%"></span></div><b class="montant-activite">${euros(valeurC)}</b></div>`;

let calculActivite = 0;
async function afficherActivitePeriode(zone, { p, missions, salaries, tableau }) {
  if (!zone) return;
  stylesActivite();
  const numero = ++calculActivite;
  const auj = aujourdhuiParis(), jour = periodeActivite.jour || auj, type = periodeActivite.type;
  const b = bornesActivite(type, jour), precedente = bornesActivite(type, decalerActivite(type, jour, -1));
  // Toute la période (et la précédente, pour la comparaison) ; à défaut de la fonction en base, les 45 derniers jours déjà chargés.
  let lignes = null;
  try { lignes = await appel("activite_societe", { p_debut: precedente.debut, p_fin: b.fin }); } catch { lignes = null; }
  if (numero !== calculActivite || !zone.isConnected) return;
  const partiel = !lignes && precedente.debut < jourParis(Date.now() - 45 * 864e5);
  lignes = lignes || missions;
  const pro = tableau?.formule === "pro", tauxPb = pro ? REGLES.COMMISSION_PRO_PB : REGLES.COMMISSION_GRATUIT_PB;
  const noms = new Map(salaries.map(s => [s.membre_id, `${s.prenom || ""}${s.nom ? ` ${s.nom.charAt(0).toUpperCase()}.` : ""}`.trim()]));
  const options = { tauxCommissionPb: tauxPb, gerant: { id: p.id, nom: tr("Moi (gérant)") }, nomDe: (id, defaut) => noms.get(id) || defaut };
  const r = resumeActivite(lignes, b, options), avant = resumeActivite(lignes, precedente, options);
  const evo = evolutionPct(r.caC, avant.caC);
  const maxSal = Math.max(0, ...r.salaries.map(s => s.ca_c));
  const missionsMot = n => `${n} ${tr(n > 1 ? "missions" : "mission")}`;
  let detail = "";
  if (type === "jour") {
    const duJour = lignes.filter(m => m.statut === "TERMINEE" && m.creneau && jourParis(m.creneau) === b.debut);
    const max = Math.max(0, ...duJour.map(m => m.estimation_c || 0));
    detail = duJour.length ? duJour.map(m => ligneBarre(`${heure(...heureParis(m.creneau))} · ${esc(rubrique(m.rubrique_id)?.nom || "")}`,
      `${esc(m.chef_id ? (noms.get(m.chef_id) || m.chef_prenom || "") : tr("Moi (gérant)"))}${(m.equipiers || []).length ? ` + ${(m.equipiers || []).length}` : ""}${m.duree_min ? ` · ${duree(m.duree_min)}` : ""}`,
      m.estimation_c || 0, max)).join("") : "";
  } else {
    const cases = type === "annee" ? parMois(r.parJour, b.debut.slice(0, 4)).map(([mois, c]) => [majuscule(dateCivile(`${mois}-01`, { month: "long" })), c])
      : joursDe(b).filter(j => type === "semaine" || r.parJour.get(j)).map(j => [majuscule(dateCivile(j, { weekday: "long", day: "numeric" })), r.parJour.get(j) || 0]);
    const max = Math.max(0, ...cases.map(c => c[1]));
    detail = cases.length ? cases.map(([lib, c]) => ligneBarre(esc(lib), "", c, max)).join("") : "";
  }
  const vide = `<p class="muet" style="margin:4px 0">${tr("Aucune mission terminée sur cette période.")}</p>`;
  zone.innerHTML = `<div class="entete-activite">
      <div><span class="petit muet">${tr("Ma société")} · ${esc(p.societe || tr("Votre société"))} · ${tr("Activité")}</span><h3 style="margin:2px 0 0">${esc(titrePeriode(type, b))}</h3></div>
      <div class="choix-periode" role="group" aria-label="${tr("Période")}">${TYPES_PERIODE.map(([id, nom]) => `<button type="button" class="${id === type ? "actif" : ""}" aria-pressed="${id === type}" data-type-periode="${id}">${tr(nom)}</button>`).join("")}</div></div>
    <div class="navigation-periode"><button type="button" class="bouton petit secondaire" data-periode-sens="-1" aria-label="${tr("Période précédente")}">‹ ${tr("Précédent")}</button>
      <button type="button" class="bouton petit secondaire" data-periode-auj ${jour === auj ? "disabled" : ""}>${tr("Aujourd'hui")}</button>
      <button type="button" class="bouton petit secondaire" data-periode-sens="1" aria-label="${tr("Période suivante")}">${tr("Suivant")} ›</button></div>
    ${partiel ? `<p class="petit note alerte">${tr("Seuls les 45 derniers jours sont disponibles pour l'instant : les montants de cette période peuvent être incomplets.")}</p>` : ""}
    <div class="tuiles-activite">
      <div class="carte tuile-activite"><span>${tr("Chiffre d'affaires")}</span><b>${euros(r.caC)}</b>
        <small class="${evo === null ? "muet" : evo >= 0 ? "hausse" : "baisse"}">${evo === null ? tr("Pas de comparaison possible") : `${evo > 0 ? "+" : evo < 0 ? "−" : ""}${Math.abs(evo)} % ${tr(SUR_LA_PRECEDENTE[type])}`}</small></div>
      <div class="carte tuile-activite"><span>${tr("Net après commission")}</span><b>${euros(r.netC)}</b><small class="muet">${tr(pro ? "Formule Pro" : "Formule Gratuite")}, ${tauxPb / 100} %</small></div>
      <div class="carte tuile-activite"><span>${tr("Missions terminées")}</span><b>${r.missions}</b><small class="muet">${duree(r.minutes)} ${tr("travaillées")}</small></div>
      <div class="carte tuile-activite"><span>${tr("Par heure travaillée")}</span><b>${r.minutes ? euros(r.parHeureC) : "—"}</b><small class="muet">${tr("Moyenne de l'équipe")}</small></div>
    </div>
    ${r.aValider ? `<p class="petit">⏳ ${tr("En attente de validation")} : ${missionsMot(r.aValider)} · ${euros(r.aValiderC)} (${tr("comptées dans le chiffre d'affaires une fois validées")})</p>` : ""}
    <h3 class="sous-titre-societe">${tr("Par salarié")}</h3>
    <div class="carte liste-activite">${r.salaries.map(s => ligneBarre(esc(s.nom), `${missionsMot(s.missions)} · ${duree(s.minutes)} · ${euros(s.parHeureC)} ${tr("par heure")}`, s.ca_c, maxSal)).join("") || vide}</div>
    <h3 class="sous-titre-societe">${tr(type === "jour" ? "Missions du jour" : type === "annee" ? "Mois par mois" : "Jour par jour")}</h3>
    <div class="carte liste-activite">${detail || vide}</div>
    <p class="petit muet">${tr("Montant d'une mission partagé à parts égales entre le chef d'équipe et ses équipiers ; heures : durée prévue de chaque mission. Date retenue : jour de l'intervention, heure de Paris.")}</p>`;
  traduire(zone);
  const relancer = () => afficherActivitePeriode(zone, { p, missions, salaries, tableau });
  zone.querySelectorAll("[data-type-periode]").forEach(x => x.onclick = () => { periodeActivite.type = x.dataset.typePeriode; relancer(); });
  zone.querySelectorAll("[data-periode-sens]").forEach(x => x.onclick = () => { periodeActivite.jour = decalerActivite(type, jour, Number(x.dataset.periodeSens)); relancer(); });
  zone.querySelector("[data-periode-auj]").onclick = () => { periodeActivite.jour = null; relancer(); };
}
function stylesActivite() {
  if (document.getElementById("styles-activite-societe")) return;
  const s = document.createElement("style");
  s.id = "styles-activite-societe";
  s.textContent = `.entete-activite{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px}
    .choix-periode{display:flex;gap:6px;flex-wrap:wrap}
    .choix-periode button{border:1px solid var(--separateur);background:var(--surface);color:var(--texte);border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer}
    .choix-periode button.actif{background:var(--creux);border-color:var(--primaire);color:var(--primaire);font-weight:700}
    .navigation-periode{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .tuiles-activite{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
    .tuile-activite{display:flex;flex-direction:column;gap:4px;margin:0}
    .tuile-activite span{font-size:14px;color:var(--texte2)}
    .tuile-activite b{font-size:26px;font-weight:800;color:var(--texte)}
    .tuile-activite small{font-size:13px}
    .tuile-activite small.hausse{color:var(--succes)} .tuile-activite small.baisse{color:var(--corail-texte)}
    .liste-activite{padding-top:4px;padding-bottom:4px}
    .ligne-activite{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(80px,1fr) auto;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--separateur)}
    .ligne-activite:last-child{border-bottom:0}
    .nom-activite{display:flex;flex-direction:column;gap:2px;min-width:0}
    .barre-activite{height:8px;border-radius:8px;background:var(--creux);overflow:hidden}
    .barre-activite span{display:block;height:100%;border-radius:8px;background:var(--primaire)}
    .montant-activite{text-align:right;white-space:nowrap}
    @media (max-width:720px){.tuiles-activite{grid-template-columns:repeat(2,1fr)}}
    @media (max-width:480px){.ligne-activite{grid-template-columns:1fr auto}.barre-activite{grid-column:1/-1;grid-row:2}}`;
  document.head.appendChild(s);
}

/** Lien d'invitation : à copier ou à envoyer par SMS / WhatsApp. */
function afficherLien(boite, code, prenom, societe) {
  if (!boite) return;
  const lien = LIEN(code);
  const message = `${tr("Bonjour")} ${prenom}, ${societe || tr("votre employeur")} ${tr("vous invite à rejoindre son équipe sur Cleaneroo")} : ${lien}`;
  boite.innerHTML = `<div class="lien-salarie"><p class="petit" style="margin:10px 0 6px"><b>${tr("Lien d'invitation de")} ${esc(prenom)}</b></p>
    <input class="texte" readonly value="${esc(lien)}" onclick="this.select()">
    <div class="boutons"><button type="button" class="bouton petit" data-copier>${tr("Copier le lien")}</button>
      <a class="bouton petit secondaire" href="sms:?&body=${encodeURIComponent(message)}">SMS</a>
      <a class="bouton petit secondaire" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
  traduire(boite);
  boite.querySelector("[data-copier]").onclick = async e => { try { await navigator.clipboard.writeText(lien); e.target.textContent = tr("Lien copié ✓"); } catch { /* rien */ } };
}

/** Fenêtre d'attribution : un chef d'équipe (soi-même ou un salarié actif) et des équipiers. */
function fenetreAttribution(m, actifs, p, recharger, titreModule = id => id) {
  if (!m) return;
  const n = besoin(m);
  const exigees = m.formations_exigees || [];
  const forme = s => exigees.every(id => (s.formations || []).includes(id));
  const fond = document.createElement("div");
  fond.className = "fenetre-fond";
  fond.innerHTML = `<div class="fenetre carte" role="dialog" aria-modal="true">
    <h2 style="margin-top:0">${tr("Attribuer la mission")}</h2>
    <p class="muet" style="margin:0 0 8px">${esc(rubrique(m.rubrique_id)?.nom || "")} · ${m.creneau ? `${dateLongue(new Date(m.creneau))} · ${heure(new Date(m.creneau).getHours())}` : ""} · ${esc(m.ville)}</p>
    <p class="petit"><b>${tr("Besoin")} : ${n} ${tr(n > 1 ? "Cleaneurs" : "Cleaneur")}</b></p>
    ${exigees.length ? `<p class="petit note alerte">${tr("Formation exigée par la loi")} : <b>${esc(exigees.map(titreModule).join(", "))}</b>. ${tr("Seuls les salariés qui l'ont validée peuvent intervenir.")}</p>` : ""}
    <p class="petit" style="margin:12px 0 4px"><b>${tr("Chef d'équipe")}</b> · ${tr("selfie, trajet, étapes et compte rendu")}</p>
    ${[{ membre_id: p.id, prenom: tr("Moi-même"), formations: exigees }, ...actifs].map(s => `<label class="case ${forme(s) ? "" : "desactive"}"><input type="radio" name="chef" value="${esc(s.membre_id)}" ${forme(s) ? "" : "disabled"} ${(m.chef_id || p.id) === s.membre_id && forme(s) ? "checked" : ""}><span>${esc(s.prenom)} ${esc(s.nom || "")}${forme(s) ? "" : ` · <span class="petit">${tr("formation manquante")}</span>`}</span></label>`).join("")}
    ${actifs.length ? `<p class="petit" style="margin:12px 0 4px"><b>${tr("Équipiers")}</b></p>
      ${actifs.map(s => `<label class="case ${forme(s) ? "" : "desactive"}"><input type="checkbox" name="equipier" value="${esc(s.membre_id)}" ${forme(s) ? "" : "disabled"} ${(m.equipiers || []).includes(s.membre_id) ? "checked" : ""}><span>${esc(s.prenom)} ${esc(s.nom || "")}${forme(s) ? "" : ` · <span class="petit">${tr("formation manquante")}</span>`}</span></label>`).join("")}`
      : `<p class="petit">${tr("Invitez vos salariés dans l'onglet « Équipe » pour leur attribuer des missions.")}</p>`}
    <p class="erreur" id="erreur-attribution"></p>
    <div class="boutons"><button type="button" class="bouton plein" data-valider>${tr("Attribuer")}</button><button type="button" class="bouton secondaire" data-fermer>${tr("Annuler")}</button></div></div>`;
  document.body.appendChild(fond); traduire(fond);
  const fermer = () => fond.remove();
  fond.querySelector("[data-fermer]").onclick = fermer;
  fond.onclick = e => { if (e.target === fond) fermer(); };
  fond.querySelector("[data-valider]").onclick = async () => {
    const chef = fond.querySelector("[name=chef]:checked")?.value || p.id;
    const equipiers = [...fond.querySelectorAll("[name=equipier]:checked")].map(c => c.value).filter(id => id !== chef);
    const err = fond.querySelector("#erreur-attribution");
    const r = await appel("attribuer_mission", { p_reference: m.reference, p_chef: chef, p_equipiers: equipiers }).catch(() => "erreur");
    if (r === "ok") { fermer(); recharger(); return; }
    err.textContent = tr(r === "formation" ? "Un intervenant choisi n'a pas la formation exigée par la loi pour cette prestation." : r === "statut" ? "La mission a déjà commencé : elle ne peut plus être réattribuée." : r === "membre" ? "Un salarié choisi n'est pas encore vérifié." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}

/* ------------------------------------------------------------------ Salarié : son employeur, sa pièce d'identité */
export function blocSalarie(p) {
  if (!p.employeur_id) return "";
  return `<div id="espace-salarie">${chargeur("Chargement…", { petit: true })}</div>`;
}
export async function brancherSalarie(vue, p, recharger) {
  const boite = vue.querySelector("#espace-salarie");
  if (!boite) return;
  document.body.classList.add("salarie");
  const e = await appel("mon_employeur").catch(() => null);
  if (!boite.isConnected || !e) return;
  const [lib, teinte] = STATUTS_SALARIE[e.statut] || ["", ""];
  boite.innerHTML = `<div class="carte entete-societe"><span class="surtitre">${tr("Mon employeur")}</span>
      <h2 style="margin:6px 0 2px">${esc(e.societe || "")}</h2><p style="margin:0"><span class="tampon ${teinte}">${tr(lib)}</span></p>
      <p class="petit">${tr(e.statut === "ACTIF" ? "Vos missions apparaissent ici dès que votre employeur vous les attribue. Avant la première de la journée : votre selfie." : "Envoyez votre pièce d'identité : Cleaneroo la vérifie, puis votre employeur peut vous attribuer des missions.")}</p>
      ${e.statut === "REFUSE" && e.motif ? `<p class="petit erreur">${esc(e.motif)}</p>` : ""}
      ${e.identite && e.statut !== "REFUSE" ? `<p class="petit">✓ ${tr("Pièce d'identité envoyée")}</p>` : `<label class="bouton">${icone("photo")} ${tr("Envoyer ma pièce d'identité")}<input type="file" accept="image/*,application/pdf" hidden data-identite-salarie></label>
        <p class="erreur" id="erreur-identite"></p>`}
      <p class="petit"><a href="#/formation/socle">🎓 ${tr("Mes formations")}</a> · ${tr("conseillées par Cleaneroo ; votre employeur peut vous en demander d'autres.")}</p>
      ${e.telephone ? `<p class="petit">${tr("Une question ?")} <a href="tel:${esc(e.telephone)}">${tr("Appeler")} ${esc(e.prenom || "")}</a></p>` : ""}</div>`;
  traduire(boite);
  boite.querySelector("[data-identite-salarie]")?.addEventListener("change", async ev => {
    const fichier = ev.target.files?.[0]; if (!fichier) return;
    try { await deposerDocument("identite", fichier); recharger(); }
    catch { boite.querySelector("#erreur-identite").textContent = tr("Le document n'a pas pu être envoyé. Réessayez."); }
  });
}

/* ------------------------------------------------------------------ Page « Rejoindre l'équipe » (lien d'invitation) */
export const CLE_CODE_EQUIPE = "cleaneroo-code-equipe";
export async function pageRejoindre(vue, code, connecte) {
  const inv = await supabase.rpc("invitation_salarie", { p_code: code }).then(r => r.data, () => null);
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    ${inv ? `<h1>${tr("Rejoindre l'équipe")} ${esc(inv.societe)}</h1>
      <p class="muet">${tr("Bonjour")} ${esc(inv.prenom)}, ${esc(inv.societe)} ${tr("vous invite à intervenir avec Cleaneroo : vos missions, votre selfie du jour, le trajet et le compte rendu, depuis votre téléphone.")}</p>
      <ol class="petit"><li>${tr("Créez votre accès (ou connectez-vous)")}</li><li>${tr("Envoyez votre pièce d'identité")}</li><li>${tr("Votre employeur vous attribue vos missions")}</li></ol>
      ${connecte ? `<button type="button" class="bouton plein" data-rejoindre>${tr("Rejoindre l'équipe")}</button>`
        : `<a class="bouton plein" href="#/compte/salarie" data-garder-code>${tr("Créer mon accès")}</a> <a class="bouton secondaire" href="#/compte" data-garder-code>${tr("J'ai déjà un compte")}</a>`}
      <p class="erreur" id="erreur-rejoindre"></p>`
    : `<h1>${tr("Lien d'invitation non valable")}</h1><p class="muet">${tr("Ce lien a expiré ou a été retiré. Demandez un nouveau lien à votre employeur.")}</p>`}
  </div></section>`;
  traduire(vue);
  vue.querySelectorAll("[data-garder-code]").forEach(a => a.addEventListener("click", () => { try { localStorage.setItem(CLE_CODE_EQUIPE, code); } catch { /* rien */ } }));
  vue.querySelector("[data-rejoindre]")?.addEventListener("click", async () => {
    const r = await appel("rejoindre_equipe", { p_code: code }).catch(() => "erreur");
    if (r === "ok") { try { localStorage.removeItem(CLE_CODE_EQUIPE); } catch { /* rien */ } location.hash = "#/compte/cleaneur"; return; }
    vue.querySelector("#erreur-rejoindre").textContent = tr(r === "independant" ? "Votre compte est celui d'un Cleaneur indépendant : utilisez un autre compte pour rejoindre une équipe."
      : r === "code" ? "Ce lien a expiré ou a été retiré. Demandez un nouveau lien à votre employeur." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
}
/** Après la connexion : un lien d'invitation gardé est utilisé automatiquement. */
export async function utiliserCodeEquipeGarde() {
  let code = null; try { code = localStorage.getItem(CLE_CODE_EQUIPE); } catch { /* rien */ }
  if (!code) return false;
  const r = await appel("rejoindre_equipe", { p_code: code }).catch(() => null);
  try { localStorage.removeItem(CLE_CODE_EQUIPE); } catch { /* rien */ }
  return r === "ok";
}
