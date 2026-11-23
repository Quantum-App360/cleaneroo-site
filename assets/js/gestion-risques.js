// Back-office « Risques de contournement » (23 novembre 2026, base-confiance-2311.sql) :
// • couples client – Cleaneur qui ont cessé de réserver alors que le Cleaneur reste actif (au moins 2 ménages, rien depuis 30 jours) ;
// • personnes qui ont tenté de partager des coordonnées (messagerie, vitrines), avec le dernier extrait.
// L'administrateur décide : simple suivi, rappel, ou suspension depuis la fiche du compte.
import { supabase } from "./donnees.js";
import { dateLongue } from "./regles.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jour = d => d ? dateLongue(new Date(d)) : "";

export async function ecranRisques(vue, titre) {
  const { data, error } = await supabase.rpc("risques_contournement");
  if (error || !data) {
    vue.innerHTML = `${titre}<p class="erreur">${esc(error && /risques_contournement/.test(error.message) ? "La base n'est pas encore à jour : appliquez outils/base-confiance-2311.sql." : error?.message || "Accès réservé à l'administrateur.")}</p>`;
    return;
  }
  const couples = data.couples || [], tentatives = data.tentatives || [];
  vue.innerHTML = `${titre}
    <p class="note">Ce tableau repère les passages en direct probables. Rien n'est automatique au-delà de l'avertissement envoyé à la 2e tentative de partage de coordonnées : c'est vous qui décidez d'un rappel ou d'une suspension.</p>
    <h2 class="titre-section">Couples qui ont cessé de réserver</h2>
    <p class="petit">Au moins 2 ménages ensemble, aucun depuis 30 jours, aucune demande en cours pour le client, mais le Cleaneur travaille toujours.</p>
    ${couples.length ? `<div class="tableau-defilant"><table class="tableau-bo"><thead><tr><th>Client</th><th>Cleaneur</th><th>Ménages</th><th>Dernier ménage</th></tr></thead><tbody>
      ${couples.map(c => `<tr><td>${esc(c.client)}</td><td>${esc(c.cleaneur)}</td><td>${c.menages}</td><td>${esc(jour(c.dernier))}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muet">Aucun couple à surveiller pour l'instant.</p>`}
    <h2 class="titre-section">Tentatives de partage de coordonnées (90 jours)</h2>
    ${tentatives.length ? `<div class="tableau-defilant"><table class="tableau-bo"><thead><tr><th>Compte</th><th>Rôle</th><th>Tentatives</th><th>Dernière</th><th>Dernier extrait</th></tr></thead><tbody>
      ${tentatives.map(t => `<tr${t.n >= 4 ? ` style="background:color-mix(in srgb, var(--erreur) 10%, transparent)"` : ""}><td>${esc(t.nom)}</td><td>${esc(t.role)}</td><td><b>${t.n}</b></td><td>${esc(jour(t.derniere))}</td><td class="petit">${esc(t.extrait)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muet">Aucune tentative enregistrée.</p>`}`;
}
