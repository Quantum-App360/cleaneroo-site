// Paiement Stripe d'une demande (page de suivi) : garantir la réservation (empreinte) sur la page sécurisée Stripe
// — carte, Apple Pay, Google Pay —, encaissement après validation, réservation levée si annulation.
// Le serveur (fonction Supabase « paiement ») calcule le montant et parle à Stripe ; même fonctionnement dans l'application (Paiement.kt).
import { supabase } from "./donnees.js";
import { euros } from "./regles.js";
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

/** Après une validation ou une annulation : encaisser le montant réservé, ou lever la réservation. */
export function paiementApres(action, reference, jeton) {
  return appeler({ action, reference, jeton }).catch(() => null);
}

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
  if (!el.isConnected) return;
  const test = !p || p.test !== false;
  const bandeau = test ? `<p class="petit" style="margin:8px 0 0"><span class="tampon">${tr("Mode test")}</span> ${tr("Aucun débit réel. Carte d'essai : 4242 4242 4242 4242, date future, n'importe quel code.")}</p>` : "";
  const statut = p?.statut;
  if (statut === "AUTORISE" || statut === "ENCAISSE" || statut === "ANNULE") {
    const texte = statut === "AUTORISE" ? "Réservation garantie : le montant est réservé et ne sera débité qu'après votre validation."
      : statut === "ENCAISSE" ? "Paiement effectué après votre validation." : "Réservation annulée : le montant réservé a été libéré.";
    el.innerHTML = `<div class="carte teintee" style="margin-bottom:14px">${icone("paiement", { tuile: true })}
      <b>${tr("Paiement")}${p.montant_c ? ` · ${euros(p.montant_c)}` : ""}</b><p class="petit" style="margin:4px 0 0">${tr(texte)}</p>${bandeau}</div>`;
    traduire(el); return;
  }
  el.innerHTML = `<div class="carte" style="margin-bottom:14px">${icone("paiement", { tuile: true })}
    <b>${tr("Garantir ma réservation")}</b>
    <p class="petit" style="margin:4px 0 10px">${tr("Carte bancaire, Apple Pay ou Google Pay, sur la page sécurisée de Stripe. Le montant est seulement réservé : il n'est débité qu'après votre validation du ménage.")}</p>
    <button type="button" class="bouton plein" id="payer">${tr("Garantir ma réservation")}</button>
    <p class="erreur" id="erreur-paiement" style="margin:8px 0 0"></p>${bandeau}</div>`;
  traduire(el);
  el.querySelector("#payer").onclick = async e => {
    e.target.disabled = true;
    const r = await appeler({ action: "creer", reference, jeton });
    if (r.url) { location.href = r.url; return; }
    e.target.disabled = false;
    el.querySelector("#erreur-paiement").textContent = tr(r.erreur === "non_configure" ? "Le paiement en ligne n'est pas encore activé."
      : r.erreur === "sur_devis" ? "Le prix de cette demande est sur devis : le paiement sera proposé avec le devis."
      : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}
