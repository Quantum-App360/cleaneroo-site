// Pass Entretien véhicule (26/11/2026, décision de Michael) : carte du tableau de bord client.
// Palier de fidélité, passage d'entretien, Cleaneur attitré, report gratuit, parrainage : tout vient de la base
// (mon_pass_entretien, outils/base-pass-entretien.sql), qui calcule aussi le prix au paiement. Même carte à prévoir dans les applis.
import { supabase } from "./donnees.js";
import { REGLES, palierPass, dateLongue } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

/** Carte affichée dès qu'un véhicule a été réservé avec ce compte. */
export async function cartePassEntretien(boite, demandes = []) {
  if (!boite) return;
  const vehicules = demandes.filter(x => x.rubrique_id === "car" && x.statut !== "ANNULEE")
    .sort((a, b) => new Date(b.creneau || b.cree_le) - new Date(a.creneau || a.cree_le));
  if (!vehicules.length) return;
  const dernier = vehicules[0];
  const { data: p } = await supabase.rpc("mon_pass_entretien", { p_creneau: null, p_rue: dernier.rue || "", p_cp: dernier.code_postal || "",
    p_freq: dernier.details?.frequenceVehicule || "unique" }).then(r => r, () => ({ data: null }));
  if (!p) return;
  const P = REGLES.PASS_ENTRETIEN, [p1, p2] = P.PALIERS;
  const n = (p.n || 0) + (p.bonus || 0), pal = palierPass(n), max = p2.apres;
  const etapes = Array.from({ length: max + 1 }, (_, i) => `<span class="${i < Math.min(n, max) ? "fait" : ""}${i === p1.apres || i === p2.apres ? " palier" : ""}"></span>`).join("");
  boite.innerHTML = `<article class="carte pass-entretien">
    <div class="pass-haut">${icone("vehicule", { tuile: true })}
      <div><h2>${tr("Pass Entretien")}</h2><p class="muet" style="margin:0">${pal.pct ? `<span>${tr("Votre remise")} : <b>−${pal.pct} %</b> ${tr("sur chaque lavage")}</span>` : `<span>${tr("Pas encore de palier")}</span>`}</p></div></div>
    <div class="pass-frise" aria-hidden="true">${etapes}</div>
    <p class="petit" style="margin:6px 0 0">${pal.suivant
      ? (pal.suivant.reste > 1 ? `<span>${tr("Encore")} ${pal.suivant.reste} ${tr("passages pour")} −${pal.suivant.pct} %</span>` : `<span>${tr("Plus qu'un passage pour")} −${pal.suivant.pct} %</span>`)
      : tr("Palier maximal atteint : vous gardez cette remise tant que vous ne sautez pas deux passages de suite.")}</p>
    <ul class="pass-avantages">
      <li>${icone("valide")} <span>${tr("Passage d'entretien")} : −${P.ENTRETIEN_PCT} % ${tr("quand le véhicule a été lavé récemment (passage plus court)")}</span></li>
      <li>${icone("cleaneurs")} <span>${p.attitre_prenom ? `${tr("Votre Cleaneur attitré")} : <b>${esc(p.attitre_prenom)}</b>` : tr("Le même Cleaneur à chaque passage, si possible")}</span></li>
      <li>${icone("calendrier")} <span>${n >= p1.apres
        ? (p.report_dispo ? tr("1 report gratuit disponible cette année, même pour un passage déjà confirmé (jusqu'à 48 h avant)")
          : `${tr("Report gratuit utilisé le")} ${esc(dateLongue(new Date(p.report_le)))}`)
        : tr("Report gratuit d'un passage confirmé : dès votre 3e passage")}</span></li>
      <li>${icone("cadeau")} <span>${p.bonus ? tr("Bonus de parrainage gagné : un palier d'avance") : tr("Parrainez un voisin ou un proche : dès son premier lavage, vous gagnez un palier.")}</span></li>
    </ul>
    <p class="petit muet" style="margin:8px 0 0">${p.faits || 0} ${tr((p.faits || 0) > 1 ? "lavages réalisés" : "lavage réalisé")}${p.prochain ? ` · <span>${tr("prochain le")} ${esc(dateLongue(new Date(p.prochain)))}</span>` : ""}</p>
    <div class="boutons" style="margin-top:10px"><a class="bouton" href="#/reserver/car">${tr("Réserver un lavage")}</a>
      ${p.bonus ? "" : `<a class="bouton secondaire" href="#/compte/particulier" data-sous-voulu="parrainage">${tr("Parrainer")}</a>`}</div>
  </article>`;
  traduire(boite);
  boite.querySelectorAll("[data-sous-voulu]").forEach(a => a.addEventListener("click", () => { try { localStorage.setItem("cleaneroo-sous-onglet-particulier", a.dataset.sousVoulu); } catch { /* rien */ } }));
}
