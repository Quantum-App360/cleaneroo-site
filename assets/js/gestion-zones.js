// Back-office « Zones et partenaires » (plan de démarchage, 22 novembre 2026).
// Règle d'or : on ne démarche que là où des Cleaneurs validés peuvent servir. Une zone = un rayon d'environ 20 km autour d'une ville.
// En attente (< 5 Cleaneurs actifs) · Ouverte (≥ 5 actifs couvrant logement et location saisonnière) · Prioritaire (≥ 15 actifs,
// ≥ 30 « Être prévenu » ou un partenaire signé) · En pause (à la main, ou plus de 15 % de demandes sans Cleaneur sur 14 jours).
// Calculs dans la base : calcul_zones, etat_zones, prevenir_zone, stats_partenaires, stats_canaux (outils/base-demarchage.sql).
import { supabase } from "./donnees.js";
import { coordonnees } from "./cartes.js";
import { rubrique } from "./catalogue.js";
import { dateLongue } from "./regles.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ETATS = { en_attente: ["En attente", "", "Aucune publicité. Le site reste visible ; les clients s'inscrivent sur « Être prévenu »."],
  ouverte: ["Ouverte", " vert", "Canaux automatiques : page ville, publicité géociblée, message aux inscrits « Être prévenu », partenaires nationaux."],
  prioritaire: ["Prioritaire", " vert", "Canaux automatiques + démarchage direct des professionnels (téléphone, visites, partenaires locaux)."],
  en_pause: ["En pause", " rouge", "Publicité coupée, recrutement de Cleaneurs relancé, clients existants servis en priorité."] };
const CANAUX = { direct: "Direct (sans code)", cleaneur: "Invité par un Cleaneur", partenaire: "Code partenaire" };
/** Message d'ouverture, prêt à envoyer par WhatsApp ou e-mail (accord donné en s'inscrivant sur « Être prévenu »). */
const messageOuverture = (prenom, ville) => `Bonjour ${prenom || ""}, vous nous aviez demandé d'être prévenu : Cleaneroo intervient maintenant à ${ville} et alentours. `
  + `Des Cleaneurs vérifiés, le prix affiché tout de suite et un paiement protégé jusqu'à votre validation. Réservez sur https://cleaneroo.fr`;
const telInternational = t => { const n = String(t || "").replace(/\D/g, ""); return n.startsWith("0") && n.length === 10 ? "33" + n.slice(1) : n; };

export async function ecranZones(vue, titre) {
  const [z, p, c] = await Promise.all([supabase.rpc("etat_zones"), supabase.rpc("stats_partenaires"), supabase.rpc("stats_canaux")]);
  if (z.error) { vue.innerHTML = `${titre}<p class="erreur">${esc(/etat_zones/.test(z.error.message) ? "La base n'est pas encore à jour : appliquez outils/base-demarchage.sql." : z.error.message)}</p>`; return; }
  const zones = z.data || [], partenaires = p.data || [], canaux = c.data || [];
  vue.innerHTML = `${titre}
    <p class="note">On ne vend que là où on peut servir : une zone n'est démarchée que lorsque des Cleaneurs validés y sont présents. L'état est calculé tout seul ; la pause peut être forcée.</p>
    <h2 class="titre-section">Zones</h2>
    ${zones.length ? zones.map(x => {
      const [nom, cl, aide] = ETATS[x.etat] || [x.etat, "", ""];
      const pct = x.demandes_14j ? Math.round(x.sans_cleaneur_14j * 100 / x.demandes_14j) : 0;
      return `<div class="carte zone-bo" data-zone="${esc(x.id)}">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(x.ville)}${x.code_postal ? ` (${esc(x.code_postal)})` : ""} · ${x.rayon_km} km</b><span class="tampon${cl}">${nom}</span></div>
        <p class="petit" style="margin:6px 0">${x.cleaneurs_actifs} Cleaneur(s) actif(s) sur ${x.cleaneurs_valides} validé(s) · logement ${x.logement ? "✓" : "✗"} · location saisonnière ${x.location ? "✓" : "✗"}
          · ${x.attentes} « Être prévenu » · ${x.partenaires} partenaire(s) signé(s) · ${x.demandes_14j} demande(s) sur 14 j, ${pct} % sans Cleaneur</p>
        <p class="petit muet" style="margin:0 0 8px">${aide}${x.prevenus_le ? ` · Inscrits prévenus le ${esc(dateLongue(new Date(x.prevenus_le)))}` : ""}</p>
        <div class="boutons-ligne">
          <button type="button" class="bouton secondaire" data-pause="${x.en_pause ? "0" : "1"}">${x.en_pause ? "Reprendre" : "Mettre en pause"}</button>
          ${x.a_prevenir ? `<button type="button" class="bouton" data-prevenir>Prévenir les ${x.attentes} inscrit(s)</button>` : ""}
          <button type="button" class="lien-bouton" data-supprimer-zone>Supprimer</button></div>
        <div data-liste-prevenus></div></div>`;
    }).join("") : `<p class="muet">Aucune zone. Commencez par Gap (zone pilote).</p>`}
    <form class="carte" id="form-zone" novalidate style="margin-top:12px"><b>Ajouter une zone</b>
      <div class="grille-2" style="margin-top:8px"><label class="champ">Ville<input name="ville" required maxlength="80" placeholder="Gap"></label>
        <label class="champ">Code postal<input name="cp" inputmode="numeric" maxlength="5" placeholder="05000"></label></div>
      <div class="grille-2"><label class="champ">Département<input name="dep" maxlength="60" placeholder="Hautes-Alpes"></label>
        <label class="champ">Rayon (km)<input name="rayon" type="number" min="5" max="60" value="20"></label></div>
      <p class="erreur" id="erreur-zone"></p><button class="bouton" type="submit">Ajouter la zone</button></form>

    <h2 class="titre-section">Partenaires</h2>
    <p class="petit">Le code se donne au partenaire : ses clients le saisissent à l'inscription (champ « Code de parrainage ») ou arrivent par le lien <code>cleaneroo.fr/?code=CODE</code>.</p>
    ${partenaires.length ? `<div class="carte"><table class="tableau-bo"><thead><tr><th>Code</th><th>Partenaire</th><th>Zone</th><th>Signé</th><th>Comptes</th><th>Clients actifs</th><th></th></tr></thead><tbody>
      ${partenaires.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.nom)} <span class="petit muet">${esc(x.type)}</span></td><td>${esc(x.zone || "—")}</td>
        <td>${x.signe_le ? esc(dateLongue(new Date(x.signe_le))) : "—"}</td><td>${x.comptes}</td><td>${x.clients_actifs}</td>
        <td><button type="button" class="lien-bouton" data-actif="${esc(x.code)}" data-valeur="${x.actif ? "0" : "1"}">${x.actif ? "Désactiver" : "Réactiver"}</button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muet">Aucun partenaire pour l'instant.</p>`}
    <form class="carte" id="form-partenaire" novalidate style="margin-top:12px"><b>Ajouter un partenaire</b>
      <div class="grille-2" style="margin-top:8px"><label class="champ">Code (lettres, chiffres, tiret)<input name="code" required maxlength="20" placeholder="ORCIERES-CONC"></label>
        <label class="champ">Nom<input name="nom" required maxlength="120"></label></div>
      <div class="grille-2"><label class="champ">Type<select name="type"><option value="local">Local</option><option value="national">National</option><option value="media">Média, contenu</option><option value="autre">Autre</option></select></label>
        <label class="champ">Zone<select name="zone"><option value="">—</option>${zones.map(x => `<option value="${esc(x.id)}">${esc(x.ville)}</option>`).join("")}</select></label></div>
      <label class="champ">Signé le (laisser vide si pas encore signé)<input name="signe" type="date"></label>
      <p class="erreur" id="erreur-partenaire"></p><button class="bouton" type="submit">Ajouter le partenaire</button></form>

    <h2 class="titre-section">Origine des clients</h2>
    <div class="carte">${canaux.length ? canaux.map(x => `<p style="margin:4px 0">${esc(CANAUX[x.canal] || x.canal)} : <b>${x.comptes}</b> compte(s) · ${x.clients_actifs} ayant commandé</p>`).join("") : `<p class="muet">Aucun compte client pour l'instant.</p>`}</div>`;

  const recharger = () => ecranZones(vue, titre);
  vue.querySelectorAll("[data-zone]").forEach(carte => {
    const id = carte.dataset.zone, x = zones.find(y => y.id === id);
    carte.querySelector("[data-pause]").onclick = async e => { e.target.disabled = true; await supabase.from("zones").update({ en_pause: e.target.dataset.pause === "1" }).eq("id", id); recharger(); };
    carte.querySelector("[data-supprimer-zone]").onclick = async () => { if (!confirm(`Supprimer la zone ${x.ville} ?`)) return; await supabase.from("zones").delete().eq("id", id); recharger(); };
    carte.querySelector("[data-prevenir]")?.addEventListener("click", async e => {
      if (!confirm(`Prévenir les ${x.attentes} inscrit(s) « Être prévenu » de ${x.ville} ? Ceux qui ont un compte reçoivent une notification ; pour les autres, la liste s'affiche pour leur écrire.`)) return;
      e.target.disabled = true;
      const { data, error } = await supabase.rpc("prevenir_zone", { p_zone: id });
      const zone = carte.querySelector("[data-liste-prevenus]");
      if (error || data?.erreur) { zone.innerHTML = `<p class="erreur">${esc(error?.message || "La zone n'est pas ouverte.")}</p>`; e.target.disabled = false; return; }
      const l = data.liste || [];
      zone.innerHTML = `<p class="petit" style="margin-top:10px"><b>${l.length} inscrit(s) à prévenir.</b> Ceux qui ont un compte ont reçu une notification. Écrivez aux autres :</p>
        ${l.map(y => { const t = messageOuverture(y.prenom, x.ville); return `<p class="petit" style="margin:4px 0">${esc(y.prenom || "—")} · ${esc(rubrique(y.rubrique_id)?.nom || "")}
          ${y.telephone ? ` · <a href="https://wa.me/${telInternational(y.telephone)}?text=${encodeURIComponent(t)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${y.email ? ` · <a href="mailto:${esc(y.email)}?subject=${encodeURIComponent("Cleaneroo arrive à " + x.ville)}&body=${encodeURIComponent(t)}">E-mail</a>` : ""}</p>`; }).join("")}`;
    });
  });
  vue.querySelectorAll("[data-actif]").forEach(b => b.onclick = async () => { await supabase.from("partenaires").update({ actif: b.dataset.valeur === "1" }).eq("code", b.dataset.actif); recharger(); });
  const fz = vue.querySelector("#form-zone");
  fz.onsubmit = async e => {
    e.preventDefault();
    const err = fz.querySelector("#erreur-zone");
    if (!fz.ville.value.trim()) { err.textContent = "Indiquez la ville."; return; }
    err.textContent = "Recherche de la ville…";
    const g = await coordonnees("", fz.cp.value.trim(), fz.ville.value.trim()).catch(() => null);
    if (!g) { err.textContent = "Ville introuvable : vérifiez le nom et le code postal."; return; }
    const { error } = await supabase.from("zones").insert({ ville: fz.ville.value.trim(), code_postal: fz.cp.value.trim(), departement: fz.dep.value.trim(),
      lat: g.lat, lon: g.lon, rayon_km: Math.min(60, Math.max(5, Number(fz.rayon.value) || 20)) });
    if (error) { err.textContent = error.message; return; }
    recharger();
  };
  const fp = vue.querySelector("#form-partenaire");
  fp.onsubmit = async e => {
    e.preventDefault();
    const err = fp.querySelector("#erreur-partenaire"), code = fp.code.value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(code) || !fp.nom.value.trim()) { err.textContent = "Code de 3 à 20 lettres, chiffres ou tirets, et nom du partenaire."; return; }
    const { error } = await supabase.from("partenaires").insert({ code, nom: fp.nom.value.trim(), type: fp.type.value, zone_id: fp.zone.value || null, signe_le: fp.signe.value || null });
    if (error) { err.textContent = /duplicate/.test(error.message) ? "Ce code existe déjà." : error.message; return; }
    recharger();
  };
}
