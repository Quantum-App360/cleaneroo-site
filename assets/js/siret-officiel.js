// Contrôle du SIRET / SIREN des Cleaneurs sur le registre officiel des entreprises (13 novembre 2026, contre les faux comptes).
// Source : API publique et gratuite de l'État « recherche-entreprises.api.gouv.fr » (données INSEE et RNE).
// Le numéro doit exister, l'entreprise et l'établissement être actifs, et le titulaire porter le nom et le prénom du Cleaneur.
// Même contrôle dans l'appli (SiretOfficiel.kt). Le back-office affiche le résultat dans chaque dossier.
import { sirenSiretValide } from "./regles.js";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]+/g, " ").trim();
const mots = s => norm(s).split(" ").filter(m => m.length > 1);

/**
 * Résultat du contrôle pour une fiche du registre (fonction pure, testée).
 * etat : "verifie" (au nom du Cleaneur), "autre_nom", "ferme", "introuvable", "non_diffusible" (nom masqué à la demande du titulaire).
 */
export function comparerTitulaire(entreprise, numero, prenom, nom) {
  const n = String(numero || "").replace(/\D/g, "");
  if (!entreprise || entreprise.siren !== n.slice(0, 9)) return { etat: "introuvable" };
  const etab = n.length === 14 ? [entreprise.siege, ...(entreprise.matching_etablissements || [])].find(x => x && x.siret === n) : entreprise.siege;
  if (n.length === 14 && !etab) return { etat: "introuvable" };
  const nomOfficiel = entreprise.nom_complet || entreprise.nom_raison_sociale || "";
  if (entreprise.etat_administratif !== "A" || (etab && etab.etat_administratif && etab.etat_administratif !== "A")) return { etat: "ferme", nomOfficiel };
  if (entreprise.statut_diffusion && entreprise.statut_diffusion !== "O" || /NON.?DIFFUSIBLE/i.test(nomOfficiel)) return { etat: "non_diffusible", nomOfficiel };
  const titulaires = [nomOfficiel, entreprise.nom_raison_sociale, ...(entreprise.dirigeants || []).filter(d => d.type_dirigeant === "personne physique")
    .map(d => `${d.prenoms || ""} ${d.nom || ""}`)].filter(Boolean).map(norm);
  const nomsCleaneur = mots(nom), prenom1 = mots(prenom)[0];
  const auNom = nomsCleaneur.length && prenom1 && titulaires.some(t => nomsCleaneur.every(m => ` ${t} `.includes(` ${m} `)) && ` ${t} `.includes(` ${prenom1} `));
  return { etat: auNom ? "verifie" : "autre_nom", nomOfficiel };
}

/** Interroge le registre officiel. etat "indisponible" si le service ne répond pas (le contrôle est alors refait par Cleaneroo). */
export async function verifierSiret(numero, prenom, nom) {
  const n = String(numero || "").replace(/\D/g, "");
  if (!sirenSiretValide(n)) return { etat: "invalide" };
  try {
    const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${n}&per_page=5`);
    if (!r.ok) return { etat: "indisponible" };
    const j = await r.json();
    const e = (j.results || []).find(x => x.siren === n.slice(0, 9));
    return comparerTitulaire(e, n, prenom, nom);
  } catch { return { etat: "indisponible" }; }
}

/** Phrase à afficher pour chaque résultat. */
export const MESSAGES_SIRET = {
  verifie: "SIRET vérifié sur le registre officiel : entreprise active, à votre nom.",
  invalide: "Ce numéro n'est pas un SIRET valable : vérifiez les 14 chiffres.",
  introuvable: "Ce SIRET n'existe pas dans le registre officiel des entreprises.",
  ferme: "Cette entreprise ou cet établissement est fermé dans le registre officiel.",
  autre_nom: "Ce SIRET n'est pas à votre nom dans le registre officiel : indiquez le SIRET de votre propre entreprise.",
  non_diffusible: "Votre entreprise est en diffusion restreinte : Cleaneroo vérifiera votre nom sur l'avis de situation INSEE de votre dossier.",
  indisponible: "Le registre officiel ne répond pas pour l'instant : Cleaneroo vérifiera votre SIRET avec votre dossier.",
};
/** Résultats qui empêchent d'enregistrer le SIRET. */
export const SIRET_REFUSE = ["invalide", "introuvable", "ferme", "autre_nom"];
