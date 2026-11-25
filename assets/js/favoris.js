// Favoris et « Réserver à nouveau » (12 novembre 2026, repris de l'appli iPhone de Vincent) : après une prestation, le client
// ajoute son Cleaneur à ses favoris (il verra et sera prévenu de ses prochaines demandes tout de suite) et peut réserver
// à nouveau la même prestation (même logement, dernier modèle mémorisé). Même écran dans l'appli (Favoris.kt).
import { icone } from "./icones.js";
import { supabase, invitationFavori } from "./donnees.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

export async function blocFavori(boite, reference, rubriqueId) {
  if (!boite) return;
  const { data: { session } } = await supabase.auth.getSession();
  const favori = session ? (await supabase.rpc("est_favori", { p_reference: reference })).data : false;
  // Invitation du Cleaneur (25/11, base-favori-invitation.sql) : « Ajouter à mes favoris » mis en avant, avec son prénom.
  const invite = session && !favori ? await invitationFavori(reference).catch(() => null) : null;
  if (!boite.isConnected) return;
  boite.innerHTML = `${invite ? `<div class="invitation-favori">${icone("coeur")}<div><b>${esc(invite)} ${tr("vous invite à l'ajouter à vos favoris")}</b>
      <p class="petit" style="margin:2px 0 0">${tr("En favori, ce Cleaneur voit vos prochaines demandes en premier. Vous restez libre d'en choisir un autre.")}</p></div></div>` : ""}
    <div class="boutons" style="margin:10px 0 14px">
    ${session ? `<button type="button" class="bouton ${invite ? "" : "secondaire"}" data-favori>${favori ? icone("coeur") + tr("Cleaneur favori") : icone("coeur") + tr("Ajouter à mes favoris")}</button>` : ""}
    <a class="bouton${invite ? " secondaire" : ""}" href="#/reserver/${encodeURIComponent(rubriqueId)}/rapide">${icone("repeter")} ${tr("Réserver à nouveau")}</a></div>
    ${favori ? `<p class="petit">${tr("Votre Cleaneur favori voit vos nouvelles demandes en priorité et en est prévenu.")}</p>` : ""}`;
  traduire(boite);
  boite.querySelector("[data-favori]")?.addEventListener("click", async () => { await supabase.rpc("basculer_favori", { p_reference: reference }); blocFavori(boite, reference, rubriqueId); });
}
