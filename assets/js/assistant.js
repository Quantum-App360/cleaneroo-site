// Assistant du support Cleaneroo (20 novembre 2026) : un assistant guidé, sans IA, qui répond tout de suite aux questions les plus
// fréquentes (prestation, paiement, retard, litige, factures, compte, Cleaneur, conciergerie) et mène droit au bon écran.
// Ce qu'il ne peut pas régler seul devient une « demande à valider » : enregistrée (table demandes_support), envoyée par e-mail
// au support (fonction serveur « support », si l'envoi d'e-mails est configuré) et traitée sous 48 h ; la réponse arrive dans
// les notifications. Route #/aide. Même écran prévu dans l'appli (Assistant.kt).
// Les chiffres (délais, pourcentages) viennent de regles.js : l'assistant dit toujours la même chose que le site.
import { supabase, session, monProfil, demandesDuCompte } from "./donnees.js";
import { REGLES, euros } from "./regles.js";
import { rubrique } from "./catalogue.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

/* ------------------------------------------------------------------ Base de réponses */
// Chaque sujet : titre, mots-clés (recherche libre), réponse (texte simple, **gras** permis), liens [libellé, adresse], suite (sous-sujets).
const R = REGLES;
export const SUJETS = {
  racine: { titre: "Comment puis-je vous aider ?", suite: ["prestation", "paiement", "retard", "probleme", "factures", "compte", "cleaneur", "conciergerie"] },

  prestation: { titre: "Ma prestation (modifier, annuler)", cles: ["modifier", "changer", "date", "horaire", "annuler", "annulation", "reporter", "déplacer"],
    texte: `Vous pouvez **modifier la date ou annuler** depuis « Mes prestations » › votre prestation. Annulation **gratuite jusqu'à {annulH} h avant** ; après, {annulPct} % du prix restent dus pour dédommager le Cleaneur. Le montant exact s'affiche avant de confirmer.`,
    liens: [["Mes prestations", "#/mes-demandes"]], suite: ["annulation-cleaneur", "reserver"] },
  "annulation-cleaneur": { titre: "Mon Cleaneur a annulé", cles: ["cleaneur annule", "remplacement", "remplaçant"],
    texte: "Quand un Cleaneur se désiste, votre prestation est **remise en ligne aussitôt** pour un autre Cleaneur vérifié du secteur. Vous êtes prévenu dès qu'il est confirmé. Si personne n'est trouvé, la réservation bancaire est levée : vous ne payez rien.",
    liens: [["Suivre ma prestation", "#/tableau"]] },
  reserver: { titre: "Réserver, connaître le prix", cles: ["prix", "tarif", "combien", "devis", "réserver", "estimation"],
    texte: `Le prix s'affiche **tout de suite**, sans devis, à chaque choix. Réservation au plus tard {delaiH} h à l'avance.`,
    liens: [["Estimer mon prix", "#/estimer"], ["Réserver", "#/reserver"]] },

  paiement: { titre: "Paiement et remboursement", cles: ["payer", "paiement", "carte", "débit", "prélèvement", "rembourse", "remboursement", "empreinte", "stripe"],
    texte: "À la réservation, le montant est seulement **réservé** sur votre carte (page sécurisée Stripe). Il n'est **encaissé qu'après votre validation** de la prestation. Si la prestation est annulée dans les délais, la réservation est levée : rien n'est débité. Le délai d'affichage dépend de votre banque (souvent 2 à 7 jours).",
    liens: [["Mes prestations", "#/mes-demandes"]], suite: ["factures"] },

  retard: { titre: "Retard ou Cleaneur absent", cles: ["retard", "en retard", "absent", "pas venu", "personne", "attends"],
    texte: `Suivez votre Cleaneur **en direct** depuis votre prestation. Un retard annoncé est toléré jusqu'à **{retardMin} min** ; au-delà, vous pouvez **annuler sans frais** depuis la page de la prestation. Personne n'est venu ? Signalez-le sur la prestation : rien ne vous sera facturé.`,
    liens: [["Ma prochaine prestation", "#/tableau"]] },

  probleme: { titre: "Résultat insatisfaisant, casse ou dommage", cles: ["litige", "sale", "mal fait", "pas propre", "casse", "cassé", "dommage", "dégât", "vol", "abîmé", "réclamation", "insatisfait"],
    texte: "Avant de valider, vous pouvez **demander une reprise** au Cleaneur. Pour une casse ou un dommage, ouvrez un **litige** depuis la prestation (photos à l'appui) : Cleaneroo réunit les preuves (photos avant / après horodatées, compte rendu, signature) et vous prépare un **dossier prêt à envoyer à l'assurance**. L'indemnisation relève de l'assurance responsabilité civile professionnelle du Cleaneur ou de votre assurance habitation, selon le cas.",
    liens: [["Mes prestations", "#/mes-demandes"], ["Garantie et assurances", "#/garantie"]], humain: true },

  factures: { titre: "Factures et attestations", cles: ["facture", "factures", "attestation", "crédit d'impôt", "pdf", "factur-x", "comptable", "tva"],
    texte: "Une **facture PDF** est créée automatiquement à la fin de chaque prestation, dans l'onglet « Factures » de votre espace. Les professionnels reçoivent un PDF au format **Factur-X** (facture électronique lisible par les logiciels comptables et les plateformes agréées). Particuliers : l'attestation annuelle pour le **crédit d'impôt** est dans le même onglet.",
    liens: [["Mes factures", "#/compte"]] },

  compte: { titre: "Mon compte (connexion, e-mail, suppression)", cles: ["mot de passe", "connexion", "connecter", "email", "e-mail", "compte", "supprimer", "données"],
    texte: "Mot de passe oublié : « Se connecter » › « Mot de passe oublié ? », un lien vous est envoyé par e-mail. Vos informations se modifient dans « Mon espace » › « Compte ». La suppression du compte est au bas de « Mon espace » : immédiate et définitive (seules les factures sont gardées le temps exigé par la loi).",
    liens: [["Mon espace", "#/compte"]] },

  cleaneur: { titre: "Je suis Cleaneur", cles: ["cleaneur", "mission", "dossier", "siret", "urssaf", "versement", "virement", "rc pro", "document", "formation"],
    texte: `Votre dossier (pièce d'identité, SIRET, RC Pro, attestation URSSAF) se complète dans « Mon dossier ». Chaque document est vérifié avant activation. Vos gains sont **versés chaque vendredi** pour les missions validées au plus tard le mercredi.`,
    liens: [["Mon espace Cleaneur", "#/compte/cleaneur"]], suite: ["probleme"] },

  conciergerie: { titre: "Conciergerie : logements, calendriers", cles: ["import", "importer", "logements", "calendrier", "airbnb", "booking", "ical", "pilote", "abonnement", "conciergerie"],
    texte: "Importez tous vos logements d'un coup (Excel, CSV ou copier-coller) ou demandez la connexion à votre logiciel de gestion. Reliez le calendrier de chaque logement : avec le **pilote automatique**, chaque départ de voyageurs programme son ménage tout seul, dans la limite de votre plafond mensuel.",
    liens: [["Importer mes logements", "#/importer-biens"], ["Mon espace Conciergerie", "#/compte/pro"]] },
};

/** Recherche libre : le sujet dont les mots-clés correspondent le mieux (le plus long mot-clé trouvé gagne). */
export function chercherSujet(texte) {
  const t = ` ${String(texte || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")} `;
  let meilleur = null, score = 0;
  for (const [id, s] of Object.entries(SUJETS)) for (const c of s.cles || []) {
    const cc = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (t.includes(cc) && cc.length > score) { meilleur = id; score = cc.length; }
  }
  return meilleur;
}

// Les chiffres sont remis après la traduction : les textes sont traduits tels quels (avec {annulH}…), comme dans l'appli.
const remplir = s => s.replace("{annulH}", R.ANNULATION_GRATUITE_H).replace("{annulPct}", R.ANNULATION_TARDIVE_PCT)
  .replace("{delaiH}", R.DELAI_MIN_RESERVATION_H).replace("{retardMin}", R.RETARD_TOLERE_MIN);
const gras = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const numero = () => { const d = new Date(); return `SUP-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; };

/* ------------------------------------------------------------------ Écran */
export async function pageAssistant(vue, sujetDepart) {
  styles();
  const s = await session().catch(() => null);
  const [profil, demandes] = s ? await Promise.all([monProfil().catch(() => null), demandesDuCompte().catch(() => [])]) : [null, []];
  const historique = [];   // conversation, jointe à la demande s'il faut un humain
  vue.innerHTML = `<section class="bloc"><div class="etroit assistant">
    <h1>🛟 ${tr("Assistant Cleaneroo")}</h1><div class="trait-corail"></div>
    <p class="petit muet">${tr("Réponse immédiate aux questions les plus fréquentes. Si besoin, votre demande est transmise à l'équipe : réponse sous 48 h.")}</p>
    <div class="fil-assistant" aria-live="polite"></div>
    <form class="saisie-assistant" autocomplete="off"><input type="text" maxlength="300" placeholder="${esc(tr("Écrivez votre question (ex. : « mon Cleaneur est en retard »)"))}" aria-label="${esc(tr("Votre question"))}">
      <button class="bouton" type="submit">${tr("Envoyer")}</button></form>
  </div></section>`;
  traduire(vue);
  const fil = vue.querySelector(".fil-assistant");
  const bulle = (html, moi = false) => { const d = document.createElement("div"); d.className = `bulle-a ${moi ? "moi" : "bot"}`; d.innerHTML = html; fil.append(d); d.scrollIntoView({ block: "nearest", behavior: "smooth" }); return d; };
  const montrer = id => {
    const x = SUJETS[id]; if (!x) return;
    historique.push({ de: "assistant", sujet: id });
    const html = `${x.texte ? `<p>${gras(remplir(tr(x.texte)))}</p>` : `<p><b>${tr(x.titre)}</b></p>`}
      ${x.liens?.length ? `<div class="liens-a">${x.liens.map(([l, h]) => `<a class="bouton secondaire petit-bouton" href="${h}">${tr(l)} ›</a>`).join("")}</div>` : ""}
      ${x.suite?.length ? `<div class="choix-a">${x.suite.map(k => `<button type="button" data-sujet="${k}">${tr(SUJETS[k].titre)}</button>`).join("")}</div>` : ""}
      ${id !== "racine" ? `<div class="resolu-a"><span class="petit">${tr("Cela répond à votre question ?")}</span>
        <button type="button" data-resolu="oui">👍 ${tr("Oui")}</button><button type="button" data-resolu="non">👎 ${tr("Non, j'ai besoin d'aide")}</button>
        ${id !== "racine" ? `<button type="button" data-sujet="racine">${tr("Autre question")}</button>` : ""}</div>` : ""}`;
    bulle(html);
  };
  fil.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sujet) { bulle(esc(tr(SUJETS[b.dataset.sujet].titre)), true); historique.push({ de: "client", texte: SUJETS[b.dataset.sujet].titre }); montrer(b.dataset.sujet); }
    if (b.dataset.resolu === "oui") { b.closest(".resolu-a").innerHTML = `<span class="petit">✅ ${tr("Parfait ! Bonne journée avec Cleaneroo.")}</span>`; }
    if (b.dataset.resolu === "non") { b.closest(".resolu-a").remove(); formulaire(); }
  });
  vue.querySelector(".saisie-assistant").onsubmit = e => {
    e.preventDefault();
    const champ = e.target.querySelector("input"), t = champ.value.trim(); if (!t) return;
    champ.value = ""; bulle(esc(t), true); historique.push({ de: "client", texte: t });
    const id = chercherSujet(t);
    if (id) montrer(id);
    else { bulle(`<p>${tr("Je n'ai pas de réponse toute prête à cette question.")}</p><div class="choix-a"><button type="button" data-sujet="racine">${tr("Voir les sujets")}</button></div>`); formulaire(t); }
  };

  /** Demande à valider : ce que l'assistant n'a pas résolu, transmis à l'équipe (réponse sous 48 h). */
  const formulaire = (texte = "") => {
    if (fil.querySelector(".form-demande-a")) return;
    const dernier = [...historique].reverse().find(h => h.sujet && h.sujet !== "racine")?.sujet || "autre";
    const recentes = (demandes || []).slice(0, 12);
    const d = bulle(`<p>${tr("Décrivez votre situation : l'équipe Cleaneroo la vérifie et vous répond sous 48 h, par e-mail et dans vos notifications.")}</p>
      <form class="form-demande-a" novalidate>
        ${profil ? "" : `<label class="champ">${tr("Votre e-mail")}<input name="email" type="email" required maxlength="200" autocomplete="email"></label>`}
        ${recentes.length ? `<label class="champ">${tr("Prestation concernée (facultatif)")}<select name="reference"><option value="">${tr("Aucune en particulier")}</option>
          ${recentes.map(x => `<option value="${esc(x.reference)}">${esc(x.reference)} · ${esc(rubrique(x.rubrique_id)?.nom || "")}${x.creneau ? ` · ${new Date(x.creneau).toLocaleDateString("fr-FR")}` : ""}</option>`).join("")}</select></label>` : ""}
        <label class="champ">${tr("Votre demande")}<textarea name="resume" rows="4" maxlength="4000" required>${esc(texte)}</textarea></label>
        <p class="erreur" data-erreur-a></p><button class="bouton plein" type="submit">${tr("Envoyer à l'équipe")}</button></form>`);
    const f = d.querySelector("form");
    f.onsubmit = async ev => {
      ev.preventDefault();
      const err = f.querySelector("[data-erreur-a]"), email = profil?.email || f.email?.value.trim() || "", resume = f.resume.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = tr("Indiquez une adresse e-mail valable."); return; }
      if (resume.length < 5) { err.textContent = tr("Décrivez votre demande en quelques mots."); return; }
      const n = numero(), btn = f.querySelector("button"); btn.disabled = true;
      const ligne = { numero: n, email, prenom: profil?.prenom || null, espace: !profil ? "visiteur" : document.body.classList.contains("mode-cleaneur") ? "cleaneur" : "client",
        categorie: SUJETS[dernier]?.titre?.slice(0, 60) || "Autre", reference: f.reference?.value || null, resume, conversation: historique.slice(-30) };
      if (profil) ligne.auteur = s.user.id;
      const { error } = await supabase.from("demandes_support").insert(ligne);
      if (error) { btn.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
      supabase.functions.invoke("support", { body: { numero: n } }).catch(() => null);   // e-mail au support et accusé de réception
      d.innerHTML = `<p>✅ ${tr("Demande envoyée")} · <b>${n}</b></p><p class="petit">${tr("L'équipe vous répond sous 48 h, par e-mail et dans vos notifications. Gardez ce numéro si vous nous recontactez.")}</p>`;
    };
  };

  montrer(SUJETS[sujetDepart] ? sujetDepart : "racine");
}

function styles() {
  if (document.getElementById("styles-assistant")) return;
  const st = document.createElement("style"); st.id = "styles-assistant";
  st.textContent = `.fil-assistant{display:flex;flex-direction:column;gap:10px;margin:14px 0}
    .bulle-a{max-width:92%;padding:12px 14px;border-radius:16px;background:var(--surface,#fff);box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .bulle-a.bot{align-self:flex-start;border-top-left-radius:4px}.bulle-a.moi{align-self:flex-end;background:var(--primaire,#1F8A80);color:#fff;border-top-right-radius:4px}
    .bulle-a p{margin:0 0 8px}.bulle-a p:last-child{margin-bottom:0}
    .liens-a,.choix-a,.resolu-a{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center}
    .choix-a button,.resolu-a button{min-height:38px;padding:0 14px;border-radius:999px;border:1.5px solid var(--separateur,#d5e2e2);background:var(--fond,#fff);font:inherit;font-weight:700;font-size:14px;cursor:pointer;color:inherit}
    .choix-a button:hover,.resolu-a button:hover{border-color:var(--primaire,#1F8A80)}
    .saisie-assistant{display:flex;gap:8px;position:sticky;bottom:12px}.saisie-assistant input{flex:1;min-height:46px;padding:0 14px;border-radius:12px;border:1.5px solid var(--separateur,#d5e2e2);font:inherit}
    .form-demande-a{margin-top:8px}`;
  document.head.append(st);
}
