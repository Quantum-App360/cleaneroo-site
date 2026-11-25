// Paiement Stripe d'une demande (page de suivi et fin de réservation), sur la page sécurisée Stripe : carte, Apple Pay, Google Pay.
// Règle (22 novembre 2026) : le client paie en réservant ; le montant reste BLOQUÉ par Cleaneroo jusqu'à sa validation de la
// prestation (ou la validation automatique), puis il est versé au Cleaneur ; une demande annulée est remboursée. Une demande
// non payée n'est pas transmise aux Cleaneurs. Le serveur (fonction Supabase « paiement ») calcule le montant, parle à Stripe,
// libère, rembourse et prélève les passages suivants ; même fonctionnement dans l'application (Paiement.kt).
import { supabase } from "./donnees.js";
import { euros, reservationsFermees } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";

async function appeler(corps) {
  const { data, error } = await supabase.functions.invoke("paiement", { body: corps });
  if (error) {
    let detail = null;
    try { detail = await error.context?.json(); } catch { /* rien */ }
    return detail || { erreur: "service" };
  }
  return data || {};
}

/** Ancien fonctionnement (empreinte) : encaisser ou lever. Désormais fait par le serveur ; gardé pour les anciennes demandes. */
export function paiementApres(action, reference, jeton) {
  return appeler({ action, reference, jeton }).catch(() => null);
}

/** Ouvre le paiement d'une demande : renvoie l'adresse de la page Stripe, ou null (déjà payé, service indisponible…).
 *  Prix corrigé par le serveur : un second essai, au nouveau prix. */
export async function lancerPaiement(reference, jeton) {
  let r = await appeler({ action: "creer", reference, jeton });
  if (r.erreur === "prix_corrige") r = await appeler({ action: "creer", reference, jeton });
  return r.url || null;
}

const MESSAGES_ERREUR = {
  non_configure: "Le paiement en ligne n'est pas encore activé.",
  sur_devis: "Le prix de cette demande est sur devis : le paiement sera proposé avec le devis.",
  prelancement: "Pré-réservation gratuite : le paiement sera proposé dès l'ouverture des réservations.",
  fermees: "Les réservations ne sont pas encore ouvertes : le paiement sera proposé dès l'ouverture.",
  prix_corrige: "Le prix a été mis à jour selon nos tarifs en vigueur. Vérifiez le nouveau montant ci-dessus, puis payez votre réservation.",
  prix_a_verifier: "Le prix de cette demande doit être vérifié par notre équipe : nous revenons vers vous rapidement.",
  deja_paye: "Cette réservation est déjà payée.",
};

/** Ce que voit le client selon l'état du paiement. */
const ETATS = {
  PAYE: "Payé : le montant est bloqué chez Stripe jusqu'à votre validation de la prestation, puis versé au Cleaneur.",
  A_PRELEVER: "Carte enregistrée : ce passage sera prélevé automatiquement 3 jours avant, puis bloqué jusqu'à votre validation.",
  LIBERE: "Prestation validée : le paiement a été versé au Cleaneur.",
  REMBOURSE: "Demande annulée : le montant payé vous a été remboursé (5 à 10 jours selon votre banque).",
  AUTORISE: "Réservation garantie : le montant est réservé et ne sera débité qu'après votre validation.",
  ENCAISSE: "Paiement effectué après votre validation.",
  ANNULE: "Demande annulée : rien n'a été débité.",
};

/** Bloc « Paiement » de la page de suivi. */
export async function blocPaiement(el, reference, jeton) {
  if (!el) return;
  // Retour de la page Stripe : ?paiement=cs_… dans l'adresse.
  const retour = new URLSearchParams(location.search).get("paiement");
  if (retour) {
    history.replaceState(null, "", location.pathname + location.hash);
    await appeler({ action: "verifier", reference, jeton, session: retour });
  }
  const { data: p } = await supabase.rpc("paiement_de", { p_reference: reference, p_jeton: jeton });
  if (!el.isConnected || !p) return;
  const test = p.test !== false;
  const bandeau = test ? `<p class="petit" style="margin:8px 0 0"><span class="tampon">${tr("Mode test")}</span> ${tr("Aucun débit réel. Carte d'essai : 4242 4242 4242 4242, date future, n'importe quel code.")}</p>` : "";
  const statut = p.statut;
  if (ETATS[statut]) {
    el.innerHTML = `<div class="carte teintee" style="margin-bottom:14px">${icone("paiement", { tuile: true })}
      <b>${tr("Paiement")}${p.montant_c ? ` · ${euros(p.montant_c)}` : ""}</b><p class="petit" style="margin:4px 0 0">${tr(ETATS[statut])}</p>${bandeau}</div>`;
    traduire(el); return;
  }
  if (!p.a_payer) { el.innerHTML = ""; return; }
  if (reservationsFermees()) {
    el.innerHTML = `<div class="carte" style="margin-bottom:14px">${icone("paiement", { tuile: true })}<b>${tr("Paiement")}</b>
      <p class="petit" style="margin:4px 0 0">${tr(MESSAGES_ERREUR.prelancement)}</p></div>`;
    traduire(el); return;
  }
  const echec = statut === "ECHEC";
  el.innerHTML = `<div class="carte" style="margin-bottom:14px;border-color:var(--alerte)">${icone("paiement", { tuile: true })}
    <b>${tr(echec ? "Prélèvement refusé" : "Paiement à finaliser")}</b>
    <p class="petit" style="margin:4px 0 10px">${tr(echec
      ? "Le prélèvement automatique de ce passage a été refusé. Payez maintenant pour le confirmer ; sinon il sera annulé sans frais 24 h avant."
      : "Votre demande est transmise aux Cleaneurs dès le paiement. Paiement 100 % sécurisé sur la page de Stripe : le montant reste bloqué jusqu'à votre validation de la prestation, puis il est versé au Cleaneur. Sans paiement, la demande est annulée sans frais.")}</p>
    <button type="button" class="bouton plein" id="payer">${tr("Payer ma réservation")}</button>
    <p class="erreur" id="erreur-paiement" style="margin:8px 0 0"></p>${bandeau}</div>`;
  traduire(el);
  el.querySelector("#payer").onclick = async e => {
    e.target.disabled = true;
    const r = await appeler({ action: "creer", reference, jeton });
    if (r.url) { location.href = r.url; return; }
    if (r.erreur === "prix_corrige" || r.erreur === "deja_paye") { setTimeout(() => location.reload(), 4000); }
    e.target.disabled = false;
    el.querySelector("#erreur-paiement").textContent = tr(MESSAGES_ERREUR[r.erreur] || "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}
