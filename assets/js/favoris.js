// Favoris et « Réserver à nouveau » (12 novembre 2026, repris de l'appli iPhone de Vincent) : après une prestation, le client
// ajoute son Cleaneur à ses favoris (il verra et sera prévenu de ses prochaines demandes tout de suite) et peut réserver
// à nouveau la même prestation (même logement, dernier modèle mémorisé). Même écran dans l'appli (Favoris.kt).
import { supabase } from "./donnees.js";
import { tr, traduire } from "./langue.js";

export async function blocFavori(boite, reference, rubriqueId) {
  if (!boite) return;
  const { data: { session } } = await supabase.auth.getSession();
  const favori = session ? (await supabase.rpc("est_favori", { p_reference: reference })).data : false;
  if (!boite.isConnected) return;
  boite.innerHTML = `<div class="boutons" style="margin:10px 0 14px">
    ${session ? `<button type="button" class="bouton secondaire" data-favori>${favori ? "❤️ " + tr("Cleaneur favori") : "🤍 " + tr("Ajouter à mes favoris")}</button>` : ""}
    <a class="bouton" href="#/reserver/${encodeURIComponent(rubriqueId)}/rapide">🔁 ${tr("Réserver à nouveau")}</a></div>
    ${favori ? `<p class="petit">${tr("Votre Cleaneur favori voit vos nouvelles demandes en priorité et en est prévenu.")}</p>` : ""}`;
  traduire(boite);
  boite.querySelector("[data-favori]")?.addEventListener("click", async () => { await supabase.rpc("basculer_favori", { p_reference: reference }); blocFavori(boite, reference, rubriqueId); });
}
