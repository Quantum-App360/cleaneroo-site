// Conciergeries : prix libres, baromètre et commission (23 novembre 2026, montage B — base-prix-conciergeries.sql).
// • Dans « Mon parc de biens », chaque logement a son prix de ménage de location : la conciergerie le fixe, voit le prix conseillé
//   Cleaneroo (grille) et le baromètre de la zone (prix acceptés, dès 20 ménages comparables sur 90 jours).
// • Sur le suivi d'une demande à prix libre : le détail (rémunération du Cleaneur, frais Cleaneroo TTC, frais de service, total)
//   et, tant que personne n'a accepté, « Augmenter le prix » (jamais à la baisse, au plus le double ; complément prélevé à la validation).
// Mêmes écrans que l'application (PrixLibre.kt).
import { supabase, enregistrerBien } from "./donnees.js";
import { euros } from "./regles.js";
import { tr, traduire } from "./langue.js";
import { prixConseilleBien, messagePlancher } from "./reserver.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enCentimes = v => Math.round((Number(String(v).replace(",", ".")) || 0) * 100);
const enEuros = c => c ? (c / 100).toFixed(2).replace(".00", "").replace(".", ",") : "";

/** Bloc « Prix du ménage » d'un logement (espace Conciergerie, Hôtels et campings). */
export function blocPrixBien(l) {
  const conseil = prixConseilleBien(l), prix = Math.round(Number(l.prixMenageC) || 0);
  return `<details class="prix-bien" data-prix-bien="${esc(l.id)}"><summary>💶 ${tr("Prix du ménage")} : <b>${prix ? euros(prix) : tr("prix conseillé")}</b>${prix ? "" : ` (${euros(conseil)})`}</summary>
    <form data-form-prix="${esc(l.id)}" novalidate style="margin-top:10px">
      <div class="barometre" data-barometre="${esc(l.id)}"><span class="petit">${tr("Prix conseillé Cleaneroo")} : <b>${euros(conseil)}</b></span>
        <span class="petit" data-barometre-zone>${tr("Baromètre de la zone : lecture…")}</span></div>
      <label class="champ">${tr("Votre prix pour un ménage de location (€)")}<input name="prix" type="text" inputmode="decimal" maxlength="8" value="${esc(enEuros(prix))}" placeholder="${esc(enEuros(conseil))}"></label>
      <p class="petit" data-apercu-prix></p>
      <p class="petit">${tr("Frais Cleaneroo compris dans ce prix : 5 % (minimum 1,50 €) avec les Cleaneurs que vous avez invités, sinon 12 % ou 20 % selon la formule du Cleaneur. Le Cleaneur reçoit le reste. Vos frais de service ne changent pas.")}</p>
      <p class="erreur" data-erreur-prix></p>
      <div class="boutons"><button class="bouton plein" type="submit">${tr("Enregistrer")}</button>
        <button class="bouton secondaire" type="button" data-prix-conseille="${conseil}">${tr("Appliquer le prix conseillé")}</button>
        ${prix ? `<button class="lien-bouton" type="button" data-prix-grille>${tr("Revenir au prix conseillé automatique")}</button>` : ""}</div></form></details>`;
}

/** Aperçu sous le champ : ce que reçoit le Cleaneur, et le plancher de 80 %. */
function apercu(f, conseil) {
  const prix = enCentimes(f.prix.value), boite = f.querySelector("[data-apercu-prix]");
  if (!prix) { boite.textContent = ""; return; }
  const invite = prix - Math.min(prix, Math.max(150, Math.round(prix * 0.05)));
  boite.innerHTML = `${tr("Le Cleaneur reçoit")} <b>${euros(invite)}</b> ${tr("s'il est invité par vous")}, <b>${euros(Math.round(prix * 0.88))}</b> ${tr("(Cleaneur Pro) ou")} <b>${euros(Math.round(prix * 0.80))}</b> ${tr("(Cleaneur Gratuit)")}.`
    + (messagePlancher(prix, conseil) ? `<br><span class="attention">⚠️ ${messagePlancher(prix, conseil)}</span>` : "");
}

export function brancherPrixBiens(vue, biens, recharger) {
  vue.querySelectorAll("[data-form-prix]").forEach(f => {
    const l = biens.find(x => x.id === f.dataset.formPrix);
    if (!l) return;
    const conseil = prixConseilleBien(l), err = f.querySelector("[data-erreur-prix]");
    f.prix.oninput = () => apercu(f, conseil);
    apercu(f, conseil);
    f.querySelector("[data-prix-conseille]").onclick = () => { f.prix.value = enEuros(conseil); apercu(f, conseil); };
    const grille = f.querySelector("[data-prix-grille]");
    if (grille) grille.onclick = async () => { const { prixMenageC: _p, ...reste } = l; try { await enregistrerBien(reste); recharger(); } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); } };
    f.onsubmit = async e => {
      e.preventDefault();
      const prix = enCentimes(f.prix.value);
      if (prix < 1000 || prix > 200000) { err.textContent = tr("Indiquez un prix entre 10 € et 2 000 €."); return; }
      try { await enregistrerBien({ ...l, prixMenageC: prix }); recharger(); }
      catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
    };
    // Baromètre : prix acceptés dans la zone (même ville ou code postal, même nombre de chambres), dès 20 ménages comparables.
    const zone = f.querySelector("[data-barometre-zone]");
    supabase.rpc("barometre_prix", { p_ville: l.ville || "", p_code_postal: l.codePostal || "", p_chambres: Number.isFinite(Number(l.chambres)) ? Number(l.chambres) : null, p_samedi: false })
      .then(({ data }) => {
        if (!zone.isConnected) return;
        zone.innerHTML = data?.moyenne_c
          ? `${tr("Baromètre de la zone")} : <b>${euros(data.moyenne_c)}</b> ${tr("en moyenne")} (${tr("de")} ${euros(data.bas_c)} ${tr("à")} ${euros(data.haut_c)}, ${data.n} ${tr("ménages sur 90 jours")})`
          : tr("Baromètre de la zone : pas encore assez de ménages comparables, le prix conseillé fait référence.");
      }).catch(() => { if (zone.isConnected) zone.textContent = ""; });
  });
}

/** Suivi d'une demande à prix libre (conciergerie connectée) : détail du prix et « Augmenter le prix ». */
export async function blocPrixDemande(avant, reference) {
  if (!avant || !reference) return;
  const { data: d } = await supabase.rpc("detail_prix_libre", { p_reference: reference }).catch(() => ({ data: null }));
  if (!d || !avant.isConnected) return;
  const boite = document.createElement("div");
  boite.className = "carte detail-prix-libre";
  boite.style.marginBottom = "14px";
  const ligne = (libelle, c, classe = "") => `<div class="ligne-montant ${classe}"><span>${libelle}</span><span>${euros(c)}</span></div>`;
  boite.innerHTML = `<h3 style="margin-top:0">💶 ${tr("Détail du prix")}</h3>`
    + (d.net_cleaneur_c != null
      ? ligne(tr("Rémunération du Cleaneur"), d.net_cleaneur_c)
        + ligne(`${tr("Frais Cleaneroo")} (${tr("dont TVA")} ${euros(d.tva_frais_c)})${d.rattache ? ` · ${tr("Cleaneur invité par vous")}` : ""}`, d.frais_cleaneroo_c)
      : ligne(tr("Prix du ménage"), d.prix_c)
        + `<p class="petit">${tr("Le Cleaneur recevra entre")} ${euros(d.net_min_c)} ${tr("et")} ${euros(d.net_max_c)} ${tr("selon qu'il est invité par vous ou non ; le reste correspond aux frais Cleaneroo.")}</p>`)
    + (d.frais_service_c ? ligne(tr("Frais de service"), d.frais_service_c) : "")
    + ligne(tr("Total"), d.total_c, "total")
    + (d.conseil_c ? `<p class="petit">${tr("Prix conseillé Cleaneroo")} : ${euros(d.conseil_c)}</p>` : "")
    + (d.sous_plancher ? `<div class="note"><span>${messagePlancher(d.prix_c, d.conseil_c)}</span></div>` : "")
    + (d.peut_augmenter ? `<form data-augmenter novalidate style="margin-top:10px">
        ${d.relance_le ? `<p class="attention" style="margin:0 0 8px">⏳ ${tr("Personne n'a encore accepté ce ménage. Augmentez le prix pour le confier plus vite.")}</p>` : ""}
        <label class="champ">${tr("Nouveau prix (€)")}<input name="prix" type="text" inputmode="decimal" maxlength="8" value="${esc(enEuros(d.prix_relance_c || Math.max(d.prix_c + 200, d.conseil_c || 0)))}"></label>
        <p class="petit">${tr("Le complément est prélevé à la validation du ménage, sur la carte utilisée pour la réservation.")}</p>
        <p class="erreur" data-erreur-augmenter></p><button class="bouton plein" type="submit">${tr("Augmenter le prix")}</button></form>` : "");
  avant.parentNode.insertBefore(boite, avant);
  traduire(boite);
  const f = boite.querySelector("[data-augmenter]");
  if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("[data-erreur-augmenter]"), prix = enCentimes(f.prix.value);
    if (prix <= d.prix_c) { err.textContent = tr("Le nouveau prix doit être plus élevé que le prix actuel."); return; }
    if (prix > d.prix_c * 2) { err.textContent = tr("Au plus le double du prix actuel."); return; }
    const { data: r } = await supabase.rpc("augmenter_prix", { p_reference: reference, p_prix_c: prix }).catch(() => ({ data: null }));
    if (r === "ok") { dispatchEvent(new HashChangeEvent("hashchange")); return; }
    err.textContent = tr(r === "statut" ? "Un Cleaneur a déjà accepté ce ménage : le prix ne peut plus changer." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}
