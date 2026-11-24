// Factures (onglet « Factures » de chaque espace : Particulier, Pro, Cleaneur). Créées par la base quand une prestation est terminée :
// prestation (du Cleaneur au client, établie par Cleaneroo pour son compte), frais de service et commission (de Cleaneroo).
// 20 novembre 2026 : vraies factures PDF au format Factur-X (XML CII profil BASIC joint dans le PDF, pdf.js), pour tous ;
// par période : archive ZIP, relevé PDF, export comptable CSV et envoi au comptable en un geste.
// Même écran dans l'appli (Factures.kt). Les montants viennent de la base, jamais de l'IA (elle rédige seulement la description).
import { supabase } from "./donnees.js";
import { euros, dateLongue } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";
import { blocAttestations, brancherAttestations } from "./attestations.js";
import { facturePdf, relevePdf, csvComptable, archiveZip, remettre, xmlFacturX as xmlBasic } from "./pdf.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPES = { prestation: "Prestation", frais: "Frais de service", commission: "Commission Cleaneroo" };

/** Factures de la personne connectée pour un espace : "personnel", "pro" (conciergerie et entreprise) ou "cleaneur". */
export async function mesFactures(espace) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  let q = supabase.from("factures").select("*").order("date_emission", { ascending: false }).order("numero", { ascending: false }).limit(200);
  if (espace === "cleaneur") q = q.or(`and(type.eq.prestation,cleaneur_id.eq.${session.user.id}),and(type.eq.commission,client_id.eq.${session.user.id})`);
  else q = q.eq("client_id", session.user.id).neq("type", "commission").in("espace", espace === "pro" ? ["conciergerie", "professionnel"] : ["personnel"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

/** Bloc « Mes factures » : période, liste, totaux, PDF Factur-X, et outils pour la comptabilité. */
const CLE_COMPTABLE = "cleaneroo-email-comptable";
const moisDe = f => String(f.date_emission).slice(0, 7);
export function blocFactures(liste, espace) {
  const an = new Date().getFullYear();
  const total = liste.filter(f => new Date(f.date_emission).getFullYear() === an).reduce((s, f) => s + f.total_ttc_c, 0);
  const mois = [...new Set(liste.map(moisDe))].sort().reverse();
  const nomMois = m => new Date(`${m}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  let comptable = ""; try { comptable = localStorage.getItem(CLE_COMPTABLE) || ""; } catch { /* rien */ }
  return `<h2 class="titre-section">${icone("paiement", { tuile: true })}Mes factures</h2>
    <p class="petit" style="margin-top:0">${tr(espace === "cleaneur" ? "Les factures de vos prestations (établies pour votre compte) et les commissions Cleaneroo, en PDF Factur-X. Utile pour votre déclaration URSSAF et votre comptabilité."
      : "Une vraie facture PDF est créée automatiquement à la fin de chaque prestation, au format Factur-X (facture électronique lisible par les logiciels comptables).")}</p>
    ${liste.length ? `<div class="carte outils-factures">
        <label class="champ" style="margin:0">${tr("Période")}<select data-periode-factures><option value="">${tr("Toutes")}</option>${[...new Set(liste.map(f => String(f.date_emission).slice(0, 4)))].sort().reverse().map(y => `<option value="${y}">${tr("Année")} ${y}</option>`).join("")}${mois.map(m => `<option value="${m}">${esc(nomMois(m))}</option>`).join("")}</select></label>
        <div class="boutons-factures"><button type="button" class="bouton" data-zip-factures>⬇ ${tr("Tout télécharger (ZIP)")}</button>
          <button type="button" class="bouton secondaire" data-releve-factures>${tr("Relevé PDF")}</button>
          <button type="button" class="bouton secondaire" data-csv-factures>${tr("Export comptable (CSV)")}</button>
          <button type="button" class="bouton secondaire" data-comptable-factures>${icone("message")} ${tr("Envoyer à mon comptable")}</button></div>
        <label class="champ" style="margin:8px 0 0">${tr("E-mail de mon comptable (facultatif, gardé sur cet appareil)")}<input type="email" data-email-comptable value="${esc(comptable)}" maxlength="200" placeholder="comptable@cabinet.fr"></label>
        <p class="petit muet" data-etat-factures style="margin:6px 0 0"></p></div>
      <div class="carte factures-liste">${liste.map(f => `<div class="ligne-facture" data-mois="${moisDe(f)}">
        <div><b>${esc(f.numero)}</b><span class="petit">${esc(dateLongue(new Date(f.date_emission)))} · ${tr(TYPES[f.type])} · ${tr("prestation")} ${esc(f.reference)}</span></div>
        <b>${euros(f.total_ttc_c)}</b>
        <div class="actions-facture"><button type="button" class="bouton secondaire" data-pdf="${esc(f.id)}">PDF</button>
          <button type="button" class="lien-bouton" data-xml="${esc(f.id)}" title="${tr("Fichier XML seul, déjà inclus dans le PDF")}">XML</button></div></div>`).join("")}
      <p class="petit" style="margin:10px 0 0">${tr("Total")} ${an} : <b>${euros(total)}</b></p></div>`
      : `<div class="vide-compte"><p class="muet">${tr("Aucune facture pour l'instant.")}</p><p class="petit">${tr("Vos factures apparaîtront ici après chaque prestation terminée.")}</p></div>`}`;
}

export function brancherFactures(boite, liste) {
  const etat = t => { const e = boite.querySelector("[data-etat-factures]"); if (e) e.textContent = t; };
  const choix = () => { const p = boite.querySelector("[data-periode-factures]")?.value || ""; return liste.filter(f => String(f.date_emission).startsWith(p)); };
  const libelle = () => { const sel = boite.querySelector("[data-periode-factures]"); return sel?.value ? sel.options[sel.selectedIndex].text : tr("toutes périodes"); };
  const occupe = async (b, travail) => { b.disabled = true; etat(tr("Préparation des documents…")); try { await travail(); etat(""); } catch { etat(tr("Le document n'a pas pu être préparé. Réessayez.")); } b.disabled = false; };
  boite.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => occupe(b, async () => { const f = liste.find(x => x.id === b.dataset.pdf); await remettre(await facturePdf(f), `facture-${f.numero}.pdf`, "application/pdf", { partager: true }); }));
  boite.querySelectorAll("[data-xml]").forEach(b => b.onclick = () => { const f = liste.find(x => x.id === b.dataset.xml); remettre(new TextEncoder().encode(xmlBasic(f)), `factur-x-${f.numero}.xml`, "application/xml"); });
  boite.querySelector("[data-periode-factures]")?.addEventListener("change", e => boite.querySelectorAll(".ligne-facture").forEach(l => { l.hidden = !!e.target.value && !l.dataset.mois.startsWith(e.target.value); }));
  const titre = () => `Relevé de factures · ${libelle()}`;
  const zip = async () => remettre(await archiveZip(choix(), { titre: titre() }), `factures-cleaneroo-${(boite.querySelector("[data-periode-factures]")?.value || "tout")}.zip`, "application/zip", { partager: true });
  boite.querySelector("[data-zip-factures]")?.addEventListener("click", e => occupe(e.currentTarget, zip));
  boite.querySelector("[data-releve-factures]")?.addEventListener("click", e => occupe(e.currentTarget, async () => remettre(await relevePdf(choix(), { titre: titre() }), "releve-factures.pdf", "application/pdf", { partager: true })));
  boite.querySelector("[data-csv-factures]")?.addEventListener("click", () => remettre(new TextEncoder().encode(csvComptable(choix())), "export-comptable.csv", "text/csv"));
  boite.querySelector("[data-email-comptable]")?.addEventListener("change", e => { try { localStorage.setItem(CLE_COMPTABLE, e.target.value.trim()); } catch { /* rien */ } });
  // Envoyer à mon comptable : sur téléphone, partage direct de l'archive (e-mail, WhatsApp…) ; sinon l'archive est téléchargée
  // et un e-mail prêt à envoyer s'ouvre (il ne reste qu'à joindre le fichier téléchargé).
  boite.querySelector("[data-comptable-factures]")?.addEventListener("click", e => occupe(e.currentTarget, async () => {
    const r = await zip();
    if (r === "partage" || r === "annule") return;
    const dest = boite.querySelector("[data-email-comptable]")?.value.trim() || "";
    location.href = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(`Factures Cleaneroo · ${libelle()}`)}&body=${encodeURIComponent(`Bonjour,\n\nVous trouverez ci-joint mes factures Cleaneroo (${libelle()}) : PDF au format Factur-X, relevé et export comptable.\n\nBien cordialement`)}`;
    etat(tr("L'archive est téléchargée : joignez-la à l'e-mail qui vient de s'ouvrir."));
  }));
}

/** Remplit un conteneur [data-factures="espace"] (appelé par l'onglet de l'espace). */
export async function afficherFactures(conteneur) {
  if (!conteneur) return;
  styles();
  const espace = conteneur.dataset.factures;
  const liste = await mesFactures(espace).catch(() => []);
  if (!conteneur.isConnected) return;
  conteneur.innerHTML = blocFactures(liste, espace) + blocAttestations(liste, espace);
  traduire(conteneur);
  brancherFactures(conteneur, liste);
  brancherAttestations(conteneur);
}

function styles() {
  if (document.getElementById("style-factures")) return;
  const st = document.createElement("style");
  st.id = "style-factures";
  st.textContent = `.factures-liste { display: grid; gap: 0; }
  .ligne-facture { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--separateur); }
  .ligne-facture div:first-child { display: flex; flex-direction: column; gap: 2px; }
  .actions-facture { display: flex; gap: 6px; align-items: center; }
  .actions-facture .bouton { min-height: 36px; padding: 0 14px; }
  @media (max-width: 520px) { .ligne-facture { grid-template-columns: 1fr auto; } .actions-facture { grid-column: 1 / -1; } }
  .outils-factures { margin-bottom: 12px; } .boutons-factures { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .boutons-factures .bouton { min-height: 40px; padding: 0 14px; font-size: 14px; }`;
  document.head.appendChild(st);
}
