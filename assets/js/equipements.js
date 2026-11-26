// Cleaneroo AI, lot D (26/11/2026) : matériel des Cleaneurs et brief de mission.
// 1. « Mon matériel » (espace Cleaneur › Profil) : le Cleaneur coche ce qu'il possède (liste de la base de connaissances).
//    Une mission préparée par Cleaneroo AI qui exige un matériel n'est proposée qu'aux Cleaneurs équipés (base-equipements.sql).
// 2. Brief de mission : ce que l'IA a préparé (objet, matière et précautions, taches, ce que le client a vu et dit, résultat
//    annoncé, options retenues ou retirées par le client), affiché sur la carte de mission du Cleaneur.
import { supabase } from "./donnees.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { rubrique } from "./catalogue.js";

let liste = null;
/** Équipements proposés (base de connaissances, entrées actives). */
export async function equipementsConnus() {
  if (liste) return liste;
  const { data } = await supabase.from("connaissances_ia").select("donnees").eq("type", "equipement").eq("actif", true);
  liste = (data || []).map(x => x.donnees).filter(x => x?.id).sort((a, b) => a.nom.localeCompare(b.nom));
  return liste;
}

export async function blocMonMateriel(boite, p) {
  if (!boite) return;
  const tous = await equipementsConnus().catch(() => []);
  if (!tous.length) { boite.innerHTML = ""; return; }
  const miens = new Set(p.equipements || []);
  boite.innerHTML = `<details class="carte" id="mon-materiel"${miens.size ? "" : " open"}><summary><b>${icone("outil")} ${tr("Mon matériel")}</b>${miens.size ? ` <span class="petit muet">· ${miens.size}</span>` : ""}</summary>
    <p class="petit muet" style="margin:6px 0 10px">${tr("Certaines missions demandent un matériel précis (un injecteur-extracteur pour un canapé, par exemple). Elles ne vous sont proposées que si vous l'avez coché ici.")}</p>
    <div class="grille-materiel">${tous.map(e => `<label class="option${miens.has(e.id) ? " choisi" : ""}"><input type="checkbox" value="${esc(e.id)}" ${miens.has(e.id) ? "checked" : ""} hidden>${esc(tr(e.nom))}</label>`).join("")}</div>
    <p class="petit" data-etat-materiel aria-live="polite" style="margin:8px 0 0"></p></details>`;
  traduire(boite);
  boite.querySelectorAll(".grille-materiel input").forEach(c => c.addEventListener("change", async () => {
    c.closest("label").classList.toggle("choisi", c.checked);
    const choix = [...boite.querySelectorAll(".grille-materiel input:checked")].map(x => x.value);
    const etat = boite.querySelector("[data-etat-materiel]");
    const { data, error } = await supabase.rpc("maj_equipements", { p_equipements: choix });
    etat.textContent = error ? tr("Enregistrement impossible : réessayez dans un instant.") : tr("Matériel enregistré.");
    if (!error) p.equipements = data || choix;
  }));
}

/** Brief préparé par Cleaneroo AI pour la carte de mission du Cleaneur (rien si la demande n'en a pas). */
export function blocBriefIA(m) {
  const g = m.details?.diagnosticIa;
  if (!g) return "";
  const r = rubrique(m.rubrique_id);
  const nomTache = id => tr(r?.taches.find(t => t.id === id)?.nom || id);
  const retenues = (g.options || []).filter(o => o.retenue), retirees = g.retirees || [];
  const liste = (titre, items) => items.length ? `<div><dt>${tr(titre)}</dt><dd>${items.map(esc).join(" · ")}</dd></div>` : "";
  return `<details class="brief-ia"><summary>${icone("instantane")} <b>${tr("Brief de la mission")}</b> <span class="petit muet">${tr("préparé par Cleaneroo AI")}</span></summary>
    <dl class="diagnostic-ia">
      ${liste("Objet", [g.libelle || ""].filter(Boolean))}
      ${liste("Matière", [g.matiereNom || g.matiere || ""].filter(x => x && x !== "inconnue").map(x => tr(x)))}
      ${liste("Précautions", g.precautions || [])}
      ${liste("Salissures", (g.salissures || []).map(s => tr(s.nom || s.id)))}
      ${liste("Vu sur les photos du client", g.vuSurPhoto || [])}
      ${liste("Indiqué par le client", g.indiqueParClient || [])}
      ${liste("Options retenues", retenues.map(o => nomTache(o.tache)))}
      ${liste("Options retirées par le client", retirees.map(o => nomTache(o.tache)))}
      ${liste("Matériel nécessaire", (g.equipementsNoms || []).map(x => tr(x)))}
      ${liste("Résultat annoncé au client", [g.resultat?.probable, g.resultat?.attenue, g.resultat?.limite].filter(Boolean))}
    </dl>
    ${retirees.length ? `<p class="petit muet" style="margin:6px 0 0">${tr("Le client a lu l'avertissement avant de retirer ces options : n'en faites pas plus que ce qui est réservé.")}</p>` : ""}
    <p class="petit muet" style="margin:6px 0 0">${tr("Faites toujours un essai sur une zone cachée avant d'appliquer un produit. Si la réalité ne correspond pas, signalez-le avec un supplément.")}</p>
    ${["SUR_PLACE", "EN_COURS"].includes(m.statut) ? `<button type="button" class="bouton secondaire petit" data-ecart-fiche="${esc(m.reference)}" style="margin-top:8px">${icone("alerte")} ${tr("La réalité ne correspond pas à la fiche")}</button>` : ""}</details>`;
}

/** Lot E, vérification sur place : l'écart avec la fiche passe par le signalement à l'arrivée existant (photo à l'appui),
 *  qui ouvre ensuite le supplément pour imprévu (accepté ou refusé par le client). Aucun circuit parallèle. */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-ecart-fiche]");
  if (!b) return;
  const carte = b.closest("[data-mission]") || document;
  const zone = carte.querySelector(".signaler-arrivee") || document.querySelector(".signaler-arrivee");
  if (!zone) { b.insertAdjacentHTML("afterend", `<p class="petit erreur">${tr("Ouvrez d'abord le contrôle de la mission (« Je suis sur place »).")}</p>`); return; }
  zone.open = true;
  const autre = zone.querySelector('input[name="type-signal"][value="autre"]'); if (autre) autre.checked = true;
  const t = zone.querySelector("[data-texte-signal]");
  if (t && !t.value) t.value = tr("Écart avec la fiche Cleaneroo AI : ");
  zone.scrollIntoView({ behavior: "smooth", block: "center" }); t?.focus();
});
