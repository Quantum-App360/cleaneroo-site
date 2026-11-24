// Prestations proposées par le Cleaneur (13 novembre 2026, demande de Vincent) : chaque case de son profil est vérifiée.
//  • bloquée seulement si une formation EXIGÉE PAR LA LOI manque (Certibiocide « nuisibles », attestation de l'organisme officiel) ;
//  • bloquée si sa RC Pro ne couvre pas l'activité (activités vérifiées par Cleaneroo sur l'attestation d'assurance) ;
//  • les formations Cleaneroo (Socle, quiz) sont CONSEILLÉES, jamais imposées (16 novembre 2026) : un indépendant ne reçoit pas
//    de formation imposée par la plateforme (risque de requalification en salariat). Elles donnent le badge « Formé ».
// Chaque ligne renvoie vers la fiche de formation et ses vidéos. Même écran dans l'appli (PrestationsCleaneur.kt).
import { icone } from "./icones.js";
import { supabase } from "./donnees.js";
import { chargerFormations, textes, ouvrirFormation, RESSOURCES } from "./formations.js";
import { qualificationsRequises, MODULES_EXIGES_PAR_LA_LOI } from "./regles.js";
import { ACTIVITES_RC_PRO } from "./dossier.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

/** Activité d'assurance d'une prestation (copie de activite_rc_pro en base, type de lieu par défaut). */
export const activiteRcPro = r => ({ home: "domicile", rental: "domicile", moving: "domicile", kitchen: "domicile", office: "locaux", commerce: "locaux",
  communal: "locaux", windows: "vitres", construction: "chantier", car: "vehicules", textiles: "textiles", outdoor: "exterieurs", pool: "exterieurs", event: "evenementiel",
  special: "specialise", leisure: "vehicules", boat: "nautique" })[r] || "domicile";

/** État d'une prestation pour ce Cleaneur : bloquée (raison), quiz à réussir (modules), ou libre. Fonction pure, testée. */
export function etatPrestation(rubriqueId, catalogue, statut, rcActivites) {
  const req = qualificationsRequises(rubriqueId).map(id => catalogue.find(m => m.id === id)).filter(Boolean);
  if (rcActivites && !rcActivites.includes(activiteRcPro(rubriqueId))) return { bloquee: "rc", activite: activiteRcPro(rubriqueId), modules: [] };
  const loi = req.filter(m => MODULES_EXIGES_PAR_LA_LOI.includes(m.id) && statut[m.id] !== "VALIDEE");
  if (loi.length) return { bloquee: "attestation", modules: loi };
  // Conseillées : rien n'est bloqué, la case se coche librement.
  return { bloquee: "", modules: req.filter(m => !MODULES_EXIGES_PAR_LA_LOI.includes(m.id) && statut[m.id] !== "VALIDEE") };
}

/** Vérifie les cases « prestation » du formulaire de profil du Cleaneur. */
export async function verrouillerPrestations(form, profil) {
  const cases = form ? [...form.querySelectorAll("input[name=prestation]")] : [];
  if (!cases.length || profil?.role === "admin") return;
  const [cat, etats, manque] = await Promise.all([chargerFormations(),
    supabase.rpc("mes_formations").then(r => r.data || []).catch(() => []),
    supabase.rpc("ce_qui_me_manque").then(r => r.data || null).catch(() => null)]);
  if (!form.isConnected || !cat.length) return;
  const statut = Object.fromEntries(etats.map(e => [e.module, e.statut]));
  const rc = Array.isArray(manque?.rc_pro_activites) ? manque.rc_pro_activites : null;
  styles();
  // Socle non validé : un seul encadré en haut de la liste (il débloque toutes les prestations).
  form.querySelector(".encart-socle")?.remove();
  const socle = cat.find(m => m.id === "socle");
  const sansSocle = socle && statut.socle !== "VALIDEE";
  if (sansSocle) cases[0].closest("label").insertAdjacentHTML("beforebegin", `<div class="encart-socle conseil">${icone("formation")} <b>${tr("Formation conseillée : Socle Cleaneroo")}</b>
    <span>${tr("Gratuite et facultative : une fiche à lire et un court questionnaire. Elle vous donne le badge « Formé », visible des clients.")}</span>
    <span class="liens"><button type="button" class="bouton petit" data-module="socle">${icone("formation")} ${tr("Suivre la formation")}</button>
    ${(RESSOURCES.socle || []).filter(x => x[2] === "video").map(([t, url]) => `<a class="lien-bouton" href="${url}" target="_blank" rel="noopener">▶ ${esc(tr(t))}</a>`).join("")}</span></div>`);
  cases.forEach(c => {
    const label = c.closest("label");
    label.nextElementSibling?.classList.contains("etat-prestation") && label.nextElementSibling.remove();
    label.classList.remove("prestation-bloquee");
    const e = etatPrestation(c.value, cat, statut, rc);
    const boutons = e.modules.map(m => `<a class="lien-bouton" href="#/formation/${m.id}">${icone("formation")} ${esc(textes(m).titre)}</a>`).join("")
      + [...new Map(e.modules.flatMap(m => RESSOURCES[m.id] || []).filter(x => x[2] === "video").map(x => [x[1], x])).values()]
        .map(([t, url]) => `<a class="lien-bouton" href="${url}" target="_blank" rel="noopener">▶ ${esc(tr(t))}</a>`).join("");
    let texte = "";
    if (e.bloquee === "rc") texte = `${icone("cadenas")} ${tr("Non couverte par votre RC Pro")} (${tr(ACTIVITES_RC_PRO.find(a => a[0] === e.activite)?.[1] || e.activite)}). ${tr("Envoyez une attestation d'assurance qui couvre cette activité.")}`;
    else if (e.bloquee === "attestation") texte = `${icone("cadenas")} ${tr("Exigée par la loi : attestation de l'organisme de formation officiel. Voir comment l'obtenir :")}`;
    else if (e.modules.length) texte = `${icone("formation")} ${tr("Formation conseillée (gratuite, facultative) :")}`;
    if (e.bloquee) { c.disabled = true; label.classList.add("prestation-bloquee"); }
    if (texte) label.insertAdjacentHTML("afterend", `<div class="etat-prestation ${e.bloquee ? "bloquee" : ""}">${texte} ${boutons}</div>`);
  });
  form.querySelectorAll("[data-module]").forEach(b => b.onclick = () => {
    const m = cat.find(x => x.id === b.dataset.module);
    ouvrirFormation(m, statut[m.id], () => { statut[m.id] = "VALIDEE"; setTimeout(() => verrouillerPrestations(form, profil), 900); });
  });
  form.querySelectorAll(".etat-prestation, .encart-socle").forEach(d => traduire(d));
}

function styles() {
  if (document.getElementById("styles-prestations-cleaneur")) return;
  const s = document.createElement("style"); s.id = "styles-prestations-cleaneur";
  s.textContent = `.prestation-bloquee{opacity:.55}.prestation-bloquee input{cursor:not-allowed}
    .etat-prestation{margin:-2px 0 8px 30px;font-size:13px;color:var(--texte2);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
    .etat-prestation.bloquee{color:#B4501C}
    .encart-socle{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;padding:12px 14px;border-radius:14px;background:#FFF1E8;border:1px solid #FFD4BA;color:#7A3410;font-size:14px}
    .encart-socle .liens{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:4px}.etat-prestation .lien-bouton{font-size:13px}`;
  document.head.appendChild(s);
}
