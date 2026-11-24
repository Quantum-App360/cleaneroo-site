// Espace Conciergerie, outils de travail (13 novembre 2026) — inspirés des logiciels de conciergerie (Turno, Breezeway, Hostaway) :
//  • « Aujourd'hui » : poste de pilotage — alertes (départs sans ménage, stock bas, incidents, calendriers en erreur) et rotations du jour et du lendemain ;
//  • « Ménages » : tous les ménages des biens, à venir et passés, filtrés par bien et par état ;
//  • « Rapports » : par mois et par bien — ménages, coût, nuits occupées, taux d'occupation ; export pour les propriétaires ;
//  • fiche de chaque bien : stock (consommables et linge, alerte sous le seuil) et incidents (casse, panne, à réparer).
// Stock et incidents sont enregistrés avec le bien (champs stock / incidents). Même espace dans l'appli (Conciergerie.kt).
import { supabase, enregistrerBien, envoyerDemande } from "./donnees.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { lancerPaiement } from "./paiement.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, dateCourte, reservationsFermees } from "./regles.js";
import { icone } from "./icones.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { esc } from "./commun.js";
import { versIcs } from "./agenda.js";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourDe = s => { const [a, m, j] = s.split("-").map(Number); return new Date(a, m - 1, j); };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const memeAdresse = (d, l) => (d.rue || "").trim().toLowerCase() === (l.rue || "").trim().toLowerCase() && (d.code_postal || d.codePostal) === l.codePostal;
export const ETATS = { VERIFICATION: "En vérification", PUBLIEE: "Recherche d'un Cleaneur", CONFIRMEE: "Cleaneur confirmé", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "Ménage en cours", A_VALIDER: "À valider", TERMINEE: "Terminé", ANNULEE: "Annulé" };

/* ------------------------------------------------------------------ Stock et incidents d'un bien */

/** Articles proposés au départ (consommables et linge). */
export const STOCK_CONSEILLE = ["Papier toilette", "Gel douche et shampoing", "Savon pour les mains", "Liquide vaisselle", "Éponges", "Sacs poubelle",
  "Café, thé, sucre", "Produits ménagers", "Jeux de draps", "Serviettes de bain", "Torchons"];
/** Quantité utilisée à chaque ménage, pour la liste conseillée (le linge est lavé, pas consommé). */
const CONSO_CONSEILLEE = { "Papier toilette": 2, "Éponges": 1, "Sacs poubelle": 2, "Café, thé, sucre": 1 };

/**
 * Consommation automatique (13 novembre 2026) : chaque ménage terminé dans un bien retire de son stock la quantité « par ménage » de chaque article.
 * Seuls les ménages terminés après l'ajout de l'article comptent, chacun une seule fois (références gardées dans stockDeduit). Fonction pure, testée.
 * Renvoie les biens à enregistrer : [{ ...bien, stock, stockDeduit }].
 */
export function consommerStock(biens, demandes) {
  return biens.map(b => {
    const st = stockDe(b);
    if (!st.some(a => Number(a.parMenage) > 0)) return null;
    const deja = new Set(b.stockDeduit || []);
    const faits = demandes.filter(d => d.statut === "TERMINEE" && d.reference && !deja.has(d.reference) && memeAdresse(d, b));
    if (!faits.length) return null;
    const stock = st.map(a => {
      const n = faits.filter(d => !a.depuis || String(d.creneau || d.cree_le || "") >= a.depuis).length;
      return n && Number(a.parMenage) > 0 ? { ...a, qte: Math.max(0, Number(a.qte) - n * Number(a.parMenage)) } : a;
    });
    return { ...b, stock, stockDeduit: [...deja, ...faits.map(d => d.reference)].slice(-300) };
  }).filter(Boolean);
}
export const stockDe = l => Array.isArray(l?.stock) ? l.stock : [];
export const incidentsDe = l => Array.isArray(l?.incidents) ? l.incidents : [];
/** Articles sous le seuil d'alerte. Fonction pure, testée. */
export const stockBas = l => stockDe(l).filter(a => Number(a.qte) <= Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT));
const ouverts = l => incidentsDe(l).filter(i => i.statut !== "RESOLU");
const fichesOuvertes = new Set();

export function editeurStock(l) {
  const st = stockDe(l), bas = stockBas(l);
  return `<details class="outil-bien" data-outil="stock-${esc(l.id)}" ${fichesOuvertes.has("stock-" + l.id) ? "open" : ""}>
    <summary>${icone("stock")} ${tr("Stock et linge")} ${bas.length ? `<span class="tampon spam">${bas.length} ${tr(bas.length > 1 ? "articles à racheter" : "article à racheter")}</span>` : st.length ? `<span class="tampon vert">${tr("OK")}</span>` : ""}</summary>
    <p class="petit">${tr("Ce qui doit être sur place pour les voyageurs. Le stock baisse tout seul à chaque ménage terminé (quantité « par ménage ») ; une alerte apparaît dans « Aujourd'hui » quand un article passe sous son seuil.")}</p>
    ${st.length ? `<div class="table-stock">${st.map((a, i) => `<div class="ligne-stock ${bas.includes(a) ? "bas" : ""}"><span>${esc(tr(a.nom))}</span>
      <span class="qte"><button type="button" class="pas" data-stock="${esc(l.id)}:${i}:-1" aria-label="${esc(tr("Moins"))}">−</button><b>${Number(a.qte)}</b>
      <button type="button" class="pas" data-stock="${esc(l.id)}:${i}:1" aria-label="${esc(tr("Plus"))}">+</button></span>
      <span class="petit">${tr("seuil")} ${Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT)}${Number(a.parMenage) > 0 ? ` · −${Number(a.parMenage)} ${tr("par ménage")}` : ""}</span>
      <button type="button" class="lien-bouton" data-stock-retirer="${esc(l.id)}:${i}">${tr("Retirer")}</button></div>`).join("")}</div>`
      : `<button type="button" class="bouton secondaire" data-stock-conseille="${esc(l.id)}">${tr("Ajouter la liste conseillée")}</button>`}
    <form class="ajout-ligne" data-stock-ajout="${esc(l.id)}" novalidate><input class="texte" name="nom" maxlength="60" placeholder="${esc(tr("Article (ex. : capsules de café)"))}">
      <input class="texte" name="qte" type="number" min="0" max="999" value="4" aria-label="${esc(tr("Quantité"))}"><input class="texte" name="seuil" type="number" min="0" max="99" value="${REGLES.STOCK_SEUIL_DEFAUT}" aria-label="${esc(tr("Seuil d'alerte"))}" title="${esc(tr("Seuil d'alerte"))}">
      <input class="texte" name="parMenage" type="number" min="0" max="20" value="1" aria-label="${esc(tr("Utilisé par ménage"))}" title="${esc(tr("Utilisé par ménage"))}">
      <button class="lien-bouton" type="submit">${tr("Ajouter")}</button></form></details>`;
}

export function editeurIncidents(l) {
  const liste = incidentsDe(l), ouv = ouverts(l);
  return `<details class="outil-bien" data-outil="incidents-${esc(l.id)}" ${fichesOuvertes.has("incidents-" + l.id) ? "open" : ""}>
    <summary>${icone("outil")} ${tr("Incidents et réparations")} ${ouv.length ? `<span class="tampon spam">${ouv.length} ${tr(ouv.length > 1 ? "ouverts" : "ouvert")}</span>` : ""}</summary>
    <p class="petit">${tr("Casse, panne, objet manquant : notez-le, transmettez-le à votre artisan, marquez-le résolu.")}</p>
    ${liste.slice().reverse().map(x => { const i = liste.indexOf(x); return `<div class="ligne-incident ${x.statut === "RESOLU" ? "resolu" : ""}">
      <div><b>${esc(x.texte)}</b><span class="petit"> · ${dateCourte(new Date(x.date))}${x.montantC ? ` · ${euros(x.montantC)}` : ""}${x.chargeProprietaire ? ` · ${tr("à la charge du propriétaire")}` : ""}${x.statut === "RESOLU" ? ` · ${icone("valide")} ${tr("Résolu")}` : ""}</span></div>
      <div class="actions">${x.statut === "RESOLU" ? "" : `<a class="lien-bouton" href="sms:?&body=${encodeURIComponent(`${l.nom || l.rue} (${l.rue}, ${l.ville}) : ${x.texte}`)}">${tr("Envoyer à l'artisan")}</a>
        <button type="button" class="lien-bouton" data-incident-resolu="${esc(l.id)}:${i}">${tr("Marquer résolu")}</button>`}</div></div>`; }).join("")}
    <form class="ajout-ligne ajout-incident" data-incident-ajout="${esc(l.id)}" novalidate><input class="texte" name="texte" maxlength="160" placeholder="${esc(tr("Ex. : ampoule de la salle de bain grillée"))}">
      <input class="texte montant-incident" name="montant" inputmode="decimal" maxlength="9" placeholder="${esc(tr("Coût (€)"))}" aria-label="${esc(tr("Coût (€)"))}">
      <label class="case petit"><input type="checkbox" name="charge"> ${tr("À la charge du propriétaire")}</label>
      <button class="lien-bouton" type="submit">${tr("Signaler")}</button></form></details>`;
}

export function brancherOutilsBiens(vue, biens, recharger) {
  const bien = id => biens.find(b => b.id === id);
  const sauver = async (l, champs, cle) => { fichesOuvertes.add(cle); try { await enregistrerBien({ ...l, ...champs }); recharger(); } catch { alert(tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")); } };
  vue.querySelectorAll("[data-stock]").forEach(b => b.onclick = () => {
    const [id, i, pas] = b.dataset.stock.split(":"), l = bien(id), st = stockDe(l).slice();
    st[i] = { ...st[i], qte: Math.max(0, Number(st[i].qte) + Number(pas)) };
    sauver(l, { stock: st }, "stock-" + id);
  });
  vue.querySelectorAll("[data-stock-retirer]").forEach(b => b.onclick = () => {
    const [id, i] = b.dataset.stockRetirer.split(":"), l = bien(id);
    sauver(l, { stock: stockDe(l).filter((_, k) => k !== Number(i)) }, "stock-" + id);
  });
  vue.querySelectorAll("[data-stock-conseille]").forEach(b => b.onclick = () => {
    const l = bien(b.dataset.stockConseille);
    const depuis = new Date().toISOString();
    sauver(l, { stock: STOCK_CONSEILLE.map(nom => ({ nom, qte: 4, seuil: REGLES.STOCK_SEUIL_DEFAUT, parMenage: CONSO_CONSEILLEE[nom] || 0, depuis })) }, "stock-" + l.id);
  });
  vue.querySelectorAll("[data-stock-ajout]").forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const l = bien(f.dataset.stockAjout), nom = f.nom.value.trim();
    if (!nom) return;
    sauver(l, { stock: [...stockDe(l), { nom, qte: Number(f.qte.value) || 0, seuil: Number(f.seuil.value) || 0, parMenage: Number(f.parMenage.value) || 0, depuis: new Date().toISOString() }].slice(0, 60) }, "stock-" + l.id);
  });
  vue.querySelectorAll("[data-incident-ajout]").forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const l = bien(f.dataset.incidentAjout), texte = f.texte.value.trim();
    if (!texte) return;
    // Coût et charge du propriétaire (24/11/2026) : repris dans le relevé mensuel du propriétaire, total à refacturer.
    const montantC = Math.max(0, Math.round(parseFloat(String(f.montant?.value || "").replace(",", ".")) * 100) || 0);
    sauver(l, { incidents: [...incidentsDe(l), { id: `i${Date.now().toString(36)}`, date: new Date().toISOString(), texte, statut: "OUVERT",
      ...(montantC ? { montantC } : {}), ...(f.charge?.checked ? { chargeProprietaire: true } : {}) }].slice(-100) }, "incidents-" + l.id);
  });
  vue.querySelectorAll("[data-incident-resolu]").forEach(b => b.onclick = () => {
    const [id, i] = b.dataset.incidentResolu.split(":"), l = bien(id), liste = incidentsDe(l).slice();
    liste[i] = { ...liste[i], statut: "RESOLU", resolu_le: new Date().toISOString() };
    sauver(l, { incidents: liste }, "incidents-" + id);
  });
  vue.querySelectorAll("details.outil-bien").forEach(d => d.ontoggle = () => { d.open ? fichesOuvertes.add(d.dataset.outil) : fichesOuvertes.delete(d.dataset.outil); });
}

/* ------------------------------------------------------------------ Liste de courses (24/11/2026, repris de l'appli iPhone)
   Articles sous le seuil, par logement ; « Racheté » remet le stock à jour ; partage par copie, WhatsApp, SMS ou partage du téléphone. */
/** Quantité conseillée : de quoi remonter au double du seuil (au moins 1). */
export const aRacheter = a => Math.max(1, 2 * Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT) - Number(a.qte || 0));
/** Liste de courses : [{ bien, articles: [{ nom, qte, seuil, index, quantite }] }], logements sans article bas exclus. Fonction pure, testée. */
export function listeCourses(biens) {
  return biens.map(bien => ({ bien, articles: stockDe(bien).map((a, index) => ({ ...a, index }))
      .filter(a => Number(a.qte) <= Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT)).map(a => ({ ...a, quantite: aRacheter(a) })) }))
    .filter(x => x.articles.length);
}
/** Texte à partager (copie, WhatsApp, SMS). */
export const texteCourses = (liste, nomBien) => [`Liste de courses Cleaneroo · ${new Date().toLocaleDateString("fr-FR")}`,
  ...liste.map(x => `\n${nomBien(x.bien)}${x.bien.ville ? ` (${x.bien.ville})` : ""}\n${x.articles.map(a => `- ${a.nom} x${a.quantite}`).join("\n")}`)].join("\n");

export function blocCourses(boite, { biens, nomBien, recharger }) {
  if (!boite) return;
  const liste = listeCourses(biens);
  if (!liste.length) { boite.innerHTML = `<div class="carte vide-courses">${icone("valide")} <span>${tr("Rien à racheter : tous les stocks sont au-dessus de leur seuil.")}</span></div>`; traduire(boite); return; }
  const total = liste.reduce((n, x) => n + x.articles.length, 0), texte = texteCourses(liste, nomBien);
  boite.innerHTML = `<div class="carte liste-courses">
    <div class="haut-courses"><b>${total} ${tr(total > 1 ? "articles à racheter" : "article à racheter")}</b>
      <div class="boutons"><button type="button" class="bouton secondaire petit" data-courses-copier>${tr("Copier la liste")}</button>
        <a class="bouton secondaire petit" href="https://wa.me/?text=${encodeURIComponent(texte)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="bouton secondaire petit" href="sms:?&body=${encodeURIComponent(texte)}">SMS</a>
        ${navigator.share ? `<button type="button" class="bouton secondaire petit" data-courses-partager>${tr("Partager")}</button>` : ""}</div></div>
    ${liste.map(x => `<div class="courses-bien"><b>${esc(nomBien(x.bien))}</b>${x.bien.ville ? ` <span class="petit muet">${esc(x.bien.ville)}</span>` : ""}
      ${x.articles.map(a => `<div class="ligne-course"><span>${esc(tr(a.nom))} <b>× ${a.quantite}</b>
          <span class="petit muet">${tr("en stock")} : ${Number(a.qte)} · ${tr("seuil")} : ${Number(a.seuil ?? REGLES.STOCK_SEUIL_DEFAUT)}</span></span>
        <label class="case racheter"><input type="checkbox" data-rachete="${esc(x.bien.id)}:${a.index}:${a.quantite}"> ${tr("Racheté")}</label></div>`).join("")}</div>`).join("")}
    <p class="petit muet" style="margin:8px 0 0">${tr("Cochez « Racheté » : la quantité achetée est ajoutée au stock du logement.")}</p></div>`;
  traduire(boite);
  const etat = t => { const p = boite.querySelector(".haut-courses b"); if (p) p.textContent = t; };
  boite.querySelector("[data-courses-copier]").onclick = async e => { try { await navigator.clipboard.writeText(texte); e.target.textContent = tr("Liste copiée"); } catch { /* rien */ } };
  boite.querySelector("[data-courses-partager]")?.addEventListener("click", () => navigator.share({ title: tr("Liste de courses"), text: texte }).catch(() => null));
  boite.querySelectorAll("[data-rachete]").forEach(c => c.onchange = async () => {
    if (!c.checked) return;
    const [id, i, q] = c.dataset.rachete.split(":"), l = biens.find(b => b.id === id), st = stockDe(l).slice();
    st[i] = { ...st[i], qte: Number(st[i].qte || 0) + Number(q) };
    c.disabled = true;
    try { await enregistrerBien({ ...l, stock: st }); recharger(); }
    catch { c.checked = false; c.disabled = false; etat(tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")); }
  });
}

/* ------------------------------------------------------------------ Dommages voyageurs (24/11/2026, repris de l'appli iPhone)
   Les dommages constatés par le Cleaneur à son arrivée (photos horodatées, constat_arrivee) forment un dossier par séjour ;
   rappel « demande à déposer avant le … » (14 jours après le départ, règle Airbnb), alerte à 5 jours, urgente à 2 jours ; export PDF. */
export const TYPES_DOMMAGE = { degat: "Dégât", salete: "Saleté exceptionnelle", casse: "Objet cassé", autre: "Autre" };
/**
 * Dossiers de dommages. Fonction pure, testée. signalements : lignes de signalements_arrivee { reference, type, texte, photo, cree_le }.
 * Renvoie [{ bien, reference, jour, sejour, source, signalements, limite, joursRestants, niveau: "urgent" | "alerte" | "ok" | "expire" | "depose" }],
 * les plus pressés d'abord.
 */
export function dossiersDommages({ biens, demandes, signalements, sejours = [], aujourdhui = new Date() }) {
  const auj = iso(aujourdhui);
  const parRef = new Map();
  signalements.forEach(x => { if (!parRef.has(x.reference)) parRef.set(x.reference, []); parRef.get(x.reference).push(x); });
  const dossiers = [];
  for (const [reference, sig] of parRef) {
    const d = demandes.find(x => x.reference === reference);
    if (!d || !d.creneau) continue;
    const bien = biens.find(b => d.details?.logementId === b.id) || biens.find(b => memeAdresse(d, b));
    if (!bien) continue;
    const jour = iso(new Date(d.creneau));
    const sejour = sejours.find(s => s.bienId === bien.id && s.fin === jour) || null;
    const limite = iso(plusJours(jourDe(jour), REGLES.DOMMAGES_DELAI_JOURS));
    const joursRestants = Math.round((jourDe(limite) - jourDe(auj)) / 864e5);
    const depose = (bien.dommagesDeposes || {})[reference];
    const niveau = depose ? "depose" : joursRestants < 0 ? "expire" : joursRestants <= REGLES.DOMMAGES_URGENT_JOURS ? "urgent" : joursRestants <= REGLES.DOMMAGES_ALERTE_JOURS ? "alerte" : "ok";
    dossiers.push({ bien, reference, jour, sejour, source: sejour?.source || "", signalements: sig.slice().sort((a, b) => String(a.cree_le).localeCompare(String(b.cree_le))),
      limite, joursRestants, niveau, depose: depose || null });
  }
  const rang = { urgent: 0, alerte: 1, ok: 2, expire: 3, depose: 4 };
  return dossiers.sort((a, b) => rang[a.niveau] - rang[b.niveau] || a.limite.localeCompare(b.limite));
}
const PLATEFORMES = { airbnb: "Airbnb", booking: "Booking", vrbo: "Abritel / Vrbo", manuel: "saisi à la main" };
const texteDelai = x => x.niveau === "depose" ? `${tr("Demande déposée le")} ${dateCourte(new Date(x.depose))}`
  : x.niveau === "expire" ? `${tr("Délai dépassé depuis le")} ${dateCourte(jourDe(x.limite))}`
  : `${tr("Demande à déposer avant le")} ${dateLongue(jourDe(x.limite))} · ${x.joursRestants === 0 ? tr("dernier jour") : `${x.joursRestants} ${tr(x.joursRestants > 1 ? "jours restants" : "jour restant")}`}`;

export async function blocDommages(boite, { biens, demandes, sejours, nomBien, recharger, zoneAlertes = null }) {
  if (!boite) return;
  const refs = demandes.filter(d => d.reference && biens.some(b => memeAdresse(d, b) || d.details?.logementId === b.id)).map(d => d.reference);
  if (!refs.length) { boite.innerHTML = `<p class="petit muet">${tr("Aucun dommage constaté à l'arrivée d'un Cleaneur.")}</p>`; traduire(boite); return; }
  const { data, error } = await supabase.from("signalements_arrivee").select("reference, type, texte, photo, cree_le").in("reference", refs.slice(-300));
  if (!boite.isConnected) return;
  if (error) { boite.innerHTML = `<p class="petit erreur">${tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")}</p>`; traduire(boite); return; }
  const dossiers = dossiersDommages({ biens, demandes, signalements: data || [], sejours });
  if (!dossiers.length) { boite.innerHTML = `<p class="petit muet">${tr("Aucun dommage constaté à l'arrivée d'un Cleaneur.")}</p>`; traduire(boite); return; }
  boite.innerHTML = dossiers.map((x, k) => `<div class="carte dossier-dommage niveau-${x.niveau}">
    <div class="haut-dommage"><div><b>${esc(nomBien(x.bien))}</b>
      <span class="petit muet">${x.sejour ? `${tr("Séjour du")} ${esc(dateCourte(jourDe(x.sejour.debut)))} ${tr("au")} ${esc(dateCourte(jourDe(x.sejour.fin)))}` : `${tr("Départ du")} ${esc(dateCourte(jourDe(x.jour)))}`}${x.source ? ` · ${esc(tr(PLATEFORMES[x.source] || x.source))}` : ""}</span></div>
      <span class="delai-dommage">${icone(x.niveau === "urgent" || x.niveau === "expire" ? "alerte" : x.niveau === "depose" ? "valide" : "horloge")} ${texteDelai(x)}</span></div>
    <ul class="constats-dommage">${x.signalements.map(s => `<li><b>${esc(tr(TYPES_DOMMAGE[s.type] || s.type))}</b> · <span class="petit muet">${esc(new Date(s.cree_le).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span>
      ${s.texte ? ` · ${esc(s.texte)}` : ""}${s.photo ? ` · <span class="petit">${icone("photo")} ${tr("photo horodatée")}</span>` : ""}</li>`).join("")}</ul>
    <div class="boutons"><button type="button" class="bouton secondaire petit" data-dommage-pdf="${k}">${tr("Dossier PDF")}</button>
      ${x.niveau === "depose" ? "" : `<button type="button" class="bouton petit" data-dommage-depose="${k}">${tr("Demande déposée")}</button>`}</div></div>`).join("");
  traduire(boite);
  // Alerte dans « Aujourd'hui » : à 5 jours, puis urgente à 2 jours.
  const pressants = dossiers.filter(x => ["urgent", "alerte"].includes(x.niveau));
  if (zoneAlertes && pressants.length) {
    zoneAlertes.querySelectorAll(".alerte-dommage").forEach(e => e.remove());
    zoneAlertes.insertAdjacentHTML("afterbegin", pressants.map(x => `<div class="alerte-concierge alerte-dommage ${x.niveau === "urgent" ? "urgent" : ""}">${icone("alerte")}
      <span>${tr("Dommage voyageur")} · <b>${esc(nomBien(x.bien))}</b> · ${texteDelai(x)}</span><a class="bouton petit" href="#titre-dommages">${tr("Voir")}</a></div>`).join(""));
    traduire(zoneAlertes);
  }
  boite.querySelectorAll("[data-dommage-pdf]").forEach(b => b.onclick = async () => {
    const x = dossiers[Number(b.dataset.dommagePdf)]; b.disabled = true;
    try {
      const { lienPhotoControle } = await import("./donnees.js");
      const photos = await Promise.all(x.signalements.map(s => s.photo ? lienPhotoControle(s.photo).catch(() => "") : ""));
      const { dommagesPdf, remettre } = await import("./pdf.js");
      await remettre(await dommagesPdf({ ...x, delaiJours: REGLES.DOMMAGES_DELAI_JOURS, nomBien: nomBien(x.bien), adresse: `${x.bien.rue || ""}, ${x.bien.codePostal || ""} ${x.bien.ville || ""}`, plateforme: PLATEFORMES[x.source] || "",
        signalements: x.signalements.map((s, i) => ({ ...s, type: TYPES_DOMMAGE[s.type] || s.type, url: photos[i] })) }), `cleaneroo-dommages-${x.reference}.pdf`, "application/pdf", { partager: true });
    } finally { b.disabled = false; }
  });
  boite.querySelectorAll("[data-dommage-depose]").forEach(b => b.onclick = async () => {
    const x = dossiers[Number(b.dataset.dommageDepose)]; b.disabled = true;
    try { await enregistrerBien({ ...x.bien, dommagesDeposes: { ...(x.bien.dommagesDeposes || {}), [x.reference]: new Date().toISOString() } }); recharger(); }
    catch { b.disabled = false; }
  });
}

/* ------------------------------------------------------------------ Aujourd'hui : poste de pilotage */

/**
 * Alertes du jour. Fonction pure, testée : départs à moins de 48 h sans ménage, stock bas, incidents ouverts, calendriers en erreur.
 * sejours : [{ bienId, debut, fin }] ; menagePrevu(bienId, jourIso) ; erreurs : { url: raison }.
 */
export function alertes({ biens, sejours, menagePrevu, erreurs = {}, aujourdhui = new Date() }) {
  const auj = iso(aujourdhui), limite = iso(plusJours(aujourdhui, 2));
  const l = [];
  const departs = sejours.filter((s, i, t) => s.fin >= auj && s.fin <= limite && !menagePrevu(s.bienId, s.fin) && t.findIndex(x => x.bienId === s.bienId && x.fin === s.fin) === i);
  departs.forEach(s => l.push({ niveau: "urgent", type: "depart", bienId: s.bienId, jour: s.fin }));
  biens.forEach(b => {
    const bas = stockBas(b); if (bas.length) l.push({ niveau: "attention", type: "stock", bienId: b.id, n: bas.length, articles: bas.map(a => a.nom) });
    const ouv = ouverts(b); if (ouv.length) l.push({ niveau: "attention", type: "incident", bienId: b.id, n: ouv.length, texte: ouv[ouv.length - 1].texte });
    const ko = (b.calendriers || []).filter(c => erreurs[c.url]); if (ko.length) l.push({ niveau: "attention", type: "calendrier", bienId: b.id, n: ko.length });
  });
  return l;
}

/* Horaires par séjour (24/11/2026, repris de l'app iPhone) : départ tardif (6 à 14 h) et arrivée anticipée (12 à 22 h), séjour par séjour.
   Séjour saisi à la main : heures enregistrées avec lui ; séjour d'un calendrier : dans bien.horairesSejours, par « arrivée|départ ». */
export const cleSejour = s => `${s.debut}|${s.fin}`;
export const departDe = s => Number.isFinite(s?.departH) ? s.departH : REGLES.DEPART_VOYAGEURS_DEFAUT_H;
export const arriveeDe = s => Number.isFinite(s?.arriveeH) ? s.arriveeH : REGLES.ARRIVEE_SUIVANTE_DEFAUT_H;
/** Séjour complété des horaires enregistrés pour lui sur le bien (calendriers). Fonction pure, testée. */
export const avecHoraires = (s, bien) => s.source === "manuel" ? s : { ...s, ...((bien?.horairesSejours || {})[cleSejour(s)] || {}) };
/** Heures valables : départ 6 à 14 h, arrivée 12 à 22 h, arrivée après le départ du même jour. Renvoie un message ou "". */
export function erreurHoraires({ departH, arriveeH }, departDuJourH = null) {
  if (departH != null && (departH < REGLES.DEPART_VOYAGEURS_MIN_H || departH > REGLES.DEPART_VOYAGEURS_MAX_H)) return "Départ entre 6 h et 14 h.";
  if (arriveeH != null && (arriveeH < REGLES.ARRIVEE_SUIVANTE_MIN_H || arriveeH > REGLES.ARRIVEE_SUIVANTE_MAX_H)) return "Arrivée entre 12 h et 22 h.";
  if (arriveeH != null && departDuJourH != null && arriveeH <= departDuJourH) return "L'arrivée doit suivre le départ des voyageurs précédents.";
  return "";
}

/**
 * Niveau de risque d'une rotation (18 novembre 2026, repris de l'app iPhone). Fonction pure, testée.
 * Urgent : départ dans moins de 48 h sans ménage · aucun Cleaneur confirmé à moins de 24 h · moins de 30 min de marge avant l'arrivée suivante ·
 *   incident bloquant ouvert · départ passé de 30 min et Cleaneur pas encore en route.
 * À surveiller : ménage à programmer · Cleaneur pas encore confirmé (départ dans moins de 72 h) · moins de 1 h 30 de marge · articles sous le seuil.
 * Serein sinon. Renvoie { niveau: "urgent" | "surveiller" | "serein", raison, rang } (rang 0 = le plus urgent).
 */
export function niveauRotation({ jour, menage = null, bien = {}, arriveeSuivanteH = null, departH = REGLES.DEPART_VOYAGEURS_DEFAUT_H, maintenant = new Date() }) {
  const depart = jourDe(jour); depart.setHours(departH, 0, 0, 0);
  const heures = (depart - maintenant) / 3600000;
  const confirme = menage && !["VERIFICATION", "PUBLIEE"].includes(menage.statut);
  const marge = menage && arriveeSuivanteH != null ? (arriveeSuivanteH - departH) * 60 - (menage.duree_min || 0) : null;
  const r = (niveau, raison) => ({ niveau, raison, rang: { urgent: 0, surveiller: 1, serein: 2 }[niveau] });
  if (!menage && heures < REGLES.RISQUE_SANS_MENAGE_URGENT_H) return r("urgent", "Départ dans moins de 48 h sans ménage");
  if (menage && !confirme && heures < REGLES.RISQUE_SANS_CLEANEUR_URGENT_H) return r("urgent", "Aucun Cleaneur confirmé à moins de 24 h");
  if (marge != null && marge < REGLES.RISQUE_MARGE_URGENTE_MIN) return r("urgent", "Moins de 30 min de marge avant l'arrivée suivante");
  if (ouverts(bien).some(i => i.bloquant)) return r("urgent", "Incident bloquant ouvert");
  if (menage && menage.statut === "CONFIRMEE" && -heures * 60 > REGLES.RISQUE_RETARD_DEPART_MIN) return r("urgent", "Départ passé et Cleaneur pas encore en route");
  if (!menage) return r("surveiller", "Ménage à programmer");
  if (!confirme && heures < REGLES.RISQUE_SANS_CLEANEUR_SURVEILLER_H) return r("surveiller", "Cleaneur pas encore confirmé");
  if (marge != null && marge < REGLES.RISQUE_MARGE_SURVEILLER_MIN) return r("surveiller", "Moins de 1 h 30 de marge avant l'arrivée suivante");
  if (stockBas(bien).length) return r("surveiller", "Articles sous le seuil");
  return r("serein", "Tout est prêt");
}

export function blocAujourdhui(boite, { biens, sejours, demandes, menageDe, erreurs, nomBien, couleur, programmer, aujourdhui = new Date() }) {
  if (!boite) return;
  const auj = iso(aujourdhui), demain = iso(plusJours(aujourdhui, 1));
  const al = alertes({ biens, sejours, menagePrevu: (b, j) => !!menageDe(b, j), erreurs, aujourdhui });
  const bien = id => biens.find(b => b.id === id);
  const texteAlerte = a => ({
    depart: () => `${tr("Départ sans ménage")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${a.jour === auj ? tr("aujourd'hui") : a.jour === demain ? tr("demain") : dateCourte(jourDe(a.jour))}`,
    stock: () => `${tr("Stock bas")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${a.articles.slice(0, 3).map(x => esc(tr(x))).join(", ")}${a.n > 3 ? "…" : ""}`,
    incident: () => `${a.n} ${tr(a.n > 1 ? "incidents ouverts" : "incident ouvert")} · <b>${esc(nomBien(bien(a.bienId)))}</b> · ${esc(a.texte)}`,
    calendrier: () => `${tr("Calendrier injoignable")} · <b>${esc(nomBien(bien(a.bienId)))}</b>`,
  })[a.type]();
  const rotation = (l, j) => {
    const dep = sejours.find(s => s.bienId === l.id && s.fin === j), arr = sejours.find(s => s.bienId === l.id && s.debut === j);
    if (!dep && !arr) return "";
    const m = menageDe(l.id, j), prochaine = sejours.filter(s => s.bienId === l.id && s.debut >= j).sort((a, b) => a.debut.localeCompare(b.debut))[0];
    // Niveau de risque de la rotation (départ du jour) : affiché et utilisé pour classer de la plus urgente à la plus sereine.
    // Heures du séjour (départ tardif, arrivée anticipée) : le risque est recalculé avec elles.
    const dH = dep ? departDe(avecHoraires(dep, l)) : null, aH = arr ? arriveeDe(avecHoraires(arr, l)) : null;
    const risque = dep ? niveauRotation({ jour: j, menage: m, bien: l, arriveeSuivanteH: aH, departH: dH, maintenant: aujourdhui }) : null;
    return `<div class="rotation" data-rang="${risque ? risque.rang : 3}" style="--c:${couleur(l.id)}">
      <div class="rot-bien"><span class="pl-pastille"></span><b>${esc(nomBien(l))}</b><span class="petit">${esc(l.ville || "")}</span>
        ${risque ? `<span class="risque risque-${risque.niveau}"><span class="pastille-risque" aria-hidden="true"></span> ${tr({ urgent: "Urgent", surveiller: "À surveiller", serein: "Serein" }[risque.niveau])} · ${tr(risque.raison)}</span>` : ""}</div>
      <div class="rot-flux">
        ${dep ? `<span class="rot-etape">${icone("valise")} ${tr("Départ")} <b>${dH} h</b>${dH !== REGLES.DEPART_VOYAGEURS_DEFAUT_H ? ` <small>${tr("tardif")}</small>` : ""}</span>` : ""}
        ${dep ? (m ? `<span class="rot-etape menage etat-${esc(m.statut)}">${icone(rubrique(m.rubrique_id)?.icone || "termine")} ${tr(ETATS[m.statut] || "")}</span>`
          : `<button type="button" class="bouton petit" data-programmer="${esc(l.id)}" data-jour="${j}">${tr("Programmer le ménage")}</button>`) : ""}
        ${arr || (dep && prochaine && prochaine.debut === j) ? `<span class="rot-etape">${icone("cle")} ${tr("Arrivée")} <b>${aH ?? REGLES.ARRIVEE_SUIVANTE_DEFAUT_H} h</b>${aH != null && aH !== REGLES.ARRIVEE_SUIVANTE_DEFAUT_H ? ` <small>${tr("anticipée")}</small>` : ""}</span>` : prochaine ? `<span class="rot-etape petit">${tr("Prochaine arrivée")} ${dateCourte(jourDe(prochaine.debut))}</span>` : ""}
        ${dep && arr ? `<span class="tampon">${tr("Rotation le jour même")}</span>` : ""}
      </div></div>`;
  };
  // Ménages programmés du jour (avec ou sans calendrier relié) : « Aujourd'hui · 3 ménages : X, Y, Z », état en direct et lien de suivi.
  const menagesDuJour = j => demandes.filter(d => d.statut !== "ANNULEE" && d.creneau && iso(new Date(d.creneau)) === j && biens.some(b => memeAdresse(d, b)))
    .sort((a, b) => a.creneau.localeCompare(b.creneau));
  const ligneMission = d => { const b = biens.find(x => memeAdresse(d, x)), r = rubrique(d.rubrique_id);
    return `<a class="mission-jour" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}" style="--c:${couleur(b?.id)}">
      <span class="b-menage b-presta etat-${esc(d.statut)}">${icone(r?.icone || "termine")}</span>
      <span class="corps"><b>${esc(b ? nomBien(b) : d.ville)}</b><span class="petit">${new Date(d.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })} · ${esc(r?.nom || "")}</span></span>
      <span class="etat-texte etat-${esc(d.statut)}">${tr(ETATS[d.statut] || "")}</span><span class="aller">›</span></a>`; };
  const rang = h => Number((h.match(/data-rang="(\d)"/) || [])[1] ?? 3);
  const jour = (j, titre) => { const r = biens.map(l => rotation(l, j)).filter(Boolean).sort((a, b) => rang(a) - rang(b)), m = menagesDuJour(j);
    return `<div class="carte jour-rotations"><h3>${titre} <span class="petit">${dateLongue(jourDe(j))}</span></h3>
      ${m.length ? `<p class="resume-missions"><b>${m.length} ${tr(m.length > 1 ? "ménages" : "ménage")}</b> · ${m.map(d => esc(nomBien(biens.find(x => memeAdresse(d, x)) || { nom: d.ville }))).join(", ")}</p>
        <div class="missions-jour">${m.map(ligneMission).join("")}</div>` : ""}
      ${r.length ? r.join("") : m.length ? "" : `<p class="muet petit">${tr("Aucun ménage, départ ni arrivée.")}</p>`}</div>`; };
  // Ajouter ses ménages à venir à son agenda (Google, Outlook, iPhone) : fichier .ics.
  const aVenir = demandes.filter(d => !["ANNULEE", "TERMINEE"].includes(d.statut) && d.creneau && biens.some(b => memeAdresse(d, b)));
  boite.innerHTML = `<div class="alertes-concierge">${al.length ? al.map(a => `<div class="alerte-concierge ${a.niveau}">${icone({ depart: "horloge", stock: "stock", incident: "outil", calendrier: "calendrier" }[a.type])}
      <span>${texteAlerte(a)}</span>${a.type === "depart" ? `<button type="button" class="bouton petit" data-programmer="${esc(a.bienId)}" data-jour="${a.jour}">${tr("Programmer")}</button>` : ""}</div>`).join("")
    : `<div class="alerte-concierge ok">${icone("valide")} <span>${tr("Tout est en ordre : chaque départ des prochaines 48 h a son ménage, aucun stock bas, aucun incident ouvert.")}</span></div>`}</div>
    <div class="grille-rotations">${jour(auj, tr("Aujourd'hui"))}${jour(demain, tr("Demain"))}</div>
    ${aVenir.length ? `<p style="margin:12px 0 0"><button type="button" class="bouton secondaire petit" data-agenda-ics>${icone("calendrier")} ${tr("Ajouter mes ménages à mon agenda")} (${aVenir.length})</button>
      <span class="petit muet"> ${tr("Google Agenda, Outlook ou iPhone")}</span></p>` : ""}`;
  boite.querySelector("[data-agenda-ics]")?.addEventListener("click", () => {
    const evts = aVenir.map(d => { const b = biens.find(x => memeAdresse(d, x)), jj = iso(new Date(d.creneau));
      return { uid: `menage-${d.reference}`, debut: jj, fin: iso(plusJours(jourDe(jj), 1)),
        titre: `${tr("Ménage Cleaneroo")} · ${b ? nomBien(b) : d.ville} · ${new Date(d.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}`,
        lieu: b ? `${b.rue}, ${b.codePostal} ${b.ville}` : d.ville, note: `${tr(ETATS[d.statut] || "")} · https://cleaneroo.fr/#/demande/${d.reference}/${d.jeton}` }; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([versIcs(evts, new Date())], { type: "text/calendar" }));
    a.download = "cleaneroo-menages.ics"; a.click();
  });
  boite.querySelectorAll("[data-programmer]").forEach(b => b.onclick = () => programmer(b.dataset.programmer, b.dataset.jour));
  traduire(boite);
}

/* ------------------------------------------------------------------ Ménages : tous les ménages des biens */
let filtreMenages = { bien: "", periode: "avenir" };
export function blocMenages(boite, { biens, demandes, nomBien }) {
  if (!boite) return;
  const maintenant = new Date().toISOString();
  const lesMiens = demandes.filter(d => biens.some(b => memeAdresse(d, b)));
  const dessiner = () => {
    const liste = lesMiens.filter(d => (!filtreMenages.bien || memeAdresse(d, biens.find(b => b.id === filtreMenages.bien)))
      && (filtreMenages.periode === "avenir" ? !["TERMINEE", "ANNULEE"].includes(d.statut) : ["TERMINEE", "ANNULEE"].includes(d.statut) || (d.creneau || "") < maintenant))
      .sort((a, b) => (filtreMenages.periode === "avenir" ? 1 : -1) * String(a.creneau || a.cree_le).localeCompare(String(b.creneau || b.cree_le)));
    boite.innerHTML = `<div class="filtres-menages">
        <div class="segments"><button type="button" data-periode="avenir" class="${filtreMenages.periode === "avenir" ? "choisi" : ""}">${tr("À venir")}</button>
          <button type="button" data-periode="passes" class="${filtreMenages.periode === "passes" ? "choisi" : ""}">${tr("Passés")}</button></div>
        ${biens.length > 1 ? `<select class="texte" data-filtre-bien aria-label="${esc(tr("Bien"))}"><option value="">${tr("Tous les biens")}</option>${biens.map(b => `<option value="${esc(b.id)}" ${filtreMenages.bien === b.id ? "selected" : ""}>${esc(nomBien(b))}</option>`).join("")}</select>` : ""}
      </div>
      ${liste.length ? `<div class="liste-menages">${liste.map(d => { const b = biens.find(x => memeAdresse(d, x)), r = rubrique(d.rubrique_id);
        return `<a class="carte ligne-menage" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">
          <span class="b-menage b-presta grand etat-${esc(d.statut)}">${icone(r?.icone || "termine")}</span>
          <span class="corps"><b>${esc(b ? nomBien(b) : d.ville)}</b><span class="petit">${esc(r?.nom || "")} · ${d.creneau ? `${dateCourte(new Date(d.creneau))} ${new Date(d.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}` : tr("Date à fixer")}</span></span>
          <span class="droite"><span class="etat-texte etat-${esc(d.statut)}">${tr(ETATS[d.statut] || d.statut)}</span><b>${d.sur_devis ? tr("Sur devis") : euros(d.estimation_c)}</b></span></a>`; }).join("")}</div>`
        : `<div class="vide-compte"><p class="muet">${tr(filtreMenages.periode === "avenir" ? "Aucun ménage à venir." : "Aucun ménage passé.")}</p></div>`}`;
    boite.querySelectorAll("[data-periode]").forEach(b => b.onclick = () => { filtreMenages.periode = b.dataset.periode; dessiner(); });
    const s = boite.querySelector("[data-filtre-bien]"); if (s) s.onchange = () => { filtreMenages.bien = s.value; dessiner(); };
    traduire(boite);
  };
  dessiner();
}

/* ------------------------------------------------------------------ Rapports : par mois et par bien */

/** Chiffres d'un mois pour un bien. Fonction pure, testée. mois : Date du 1er du mois. */
export function chiffresMois(bien, mois, sejours, demandes) {
  const debut = iso(mois), finMois = iso(new Date(mois.getFullYear(), mois.getMonth() + 1, 1)), jours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const nuits = sejours.filter(s => s.bienId === bien.id).reduce((n, s) => {
    const a = s.debut > debut ? s.debut : debut, b = s.fin < finMois ? s.fin : finMois;
    return n + Math.max(0, Math.round((jourDe(b) - jourDe(a)) / 864e5));
  }, 0);
  const menages = demandes.filter(d => d.statut !== "ANNULEE" && d.creneau && memeAdresse(d, bien) && d.creneau.slice(0, 10) >= debut && d.creneau.slice(0, 10) < finMois);
  return { nuits: Math.min(nuits, jours), occupation: Math.round(100 * Math.min(nuits, jours) / jours), menages: menages.length,
    coutC: menages.reduce((s, d) => s + (d.estimation_c || 0), 0), sejours: sejours.filter(s => s.bienId === bien.id && s.fin > debut && s.debut < finMois).length };
}

/* ------------------------------------------------------------------ Relevé mensuel par propriétaire (24/11/2026, repris de l'appli iPhone)
   Ses logements, nuits occupées, ménages et leur coût, incidents à sa charge, total à refacturer. Jamais de code d'accès ni d'autre propriétaire :
   seuls le nom, la ville et les chiffres du mois sont repris. Fonction pure, testée. */
export function releveProprietaire({ biens, mois, sejours, demandes, nomBien = l => l.nom || l.rue || "" }) {
  const debut = iso(mois), finMois = iso(new Date(mois.getFullYear(), mois.getMonth() + 1, 1));
  const lignes = biens.map(b => {
    const c = chiffresMois(b, mois, sejours, demandes);
    const menages = demandes.filter(d => !["ANNULEE"].includes(d.statut) && d.creneau && memeAdresse(d, b) && d.creneau.slice(0, 10) >= debut && d.creneau.slice(0, 10) < finMois)
      .sort((x, y) => x.creneau.localeCompare(y.creneau))
      .map(d => ({ date: d.creneau.slice(0, 10), prestation: rubrique(d.rubrique_id)?.nom || "", statut: d.statut, coutC: d.estimation_c || 0 }));
    const incidents = incidentsDe(b).filter(i => i.chargeProprietaire && String(i.date || "").slice(0, 10) >= debut && String(i.date || "").slice(0, 10) < finMois)
      .map(i => ({ date: String(i.date).slice(0, 10), texte: i.texte, montantC: i.montantC || 0 }));
    const menagesC = menages.reduce((t, x) => t + x.coutC, 0), incidentsC = incidents.reduce((t, x) => t + x.montantC, 0);
    return { nom: nomBien(b), ville: b.ville || "", nuits: c.nuits, occupation: c.occupation, sejours: c.sejours, menages, incidents, menagesC, incidentsC, totalC: menagesC + incidentsC };
  });
  const somme = k => lignes.reduce((t, x) => t + x[k], 0);
  return { mois: debut.slice(0, 7), biens: lignes, nuits: somme("nuits"), menagesC: somme("menagesC"), incidentsC: somme("incidentsC"), totalC: somme("totalC") };
}

let moisRapport = null;
export function blocRapports(boite, { biens, sejours, demandes, nomBien, societe }) {
  if (!boite) return;
  moisRapport = moisRapport || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const dessiner = () => {
    const lignes = biens.map(b => ({ b, ...chiffresMois(b, moisRapport, sejours, demandes) }));
    const total = lignes.reduce((t, x) => ({ nuits: t.nuits + x.nuits, menages: t.menages + x.menages, coutC: t.coutC + x.coutC, sejours: t.sejours + x.sejours }), { nuits: 0, menages: 0, coutC: 0, sejours: 0 });
    const nomMois = moisRapport.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
    boite.innerHTML = `<div class="entete-rapport"><button type="button" class="lien-bouton" data-mois="-1" aria-label="${esc(tr("Mois précédent"))}">‹</button>
        <b>${nomMois}</b><button type="button" class="lien-bouton" data-mois="1" aria-label="${esc(tr("Mois suivant"))}">›</button>
        <span class="espace"></span><button type="button" class="bouton secondaire petit" data-export>${tr("Exporter (Excel)")}</button>
        <button type="button" class="bouton secondaire petit" data-imprimer>${tr("Relevé à imprimer")}</button></div>
      <div class="tuiles-chiffres tuiles-conciergerie">
        <div class="tuile-chiffre"><b>${total.sejours}</b><span>${tr("Séjours")}</span></div>
        <div class="tuile-chiffre"><b>${total.nuits}</b><span>${tr("Nuits occupées")}</span></div>
        <div class="tuile-chiffre"><b>${total.menages}</b><span>${tr("Ménages")}</span></div>
        <div class="tuile-chiffre"><b>${euros(total.coutC)}</b><span>${tr("Coût des ménages")}</span></div></div>
      <div class="table-rapport" role="table"><div class="tr entete" role="row"><span>${tr("Bien")}</span><span>${tr("Séjours")}</span><span>${tr("Nuits")}</span><span>${tr("Occupation")}</span><span>${tr("Ménages")}</span><span>${tr("Coût")}</span></div>
        ${lignes.map(x => `<div class="tr" role="row"><span><b>${esc(nomBien(x.b))}</b></span><span>${x.sejours}</span><span>${x.nuits}</span>
          <span><i class="jauge-occ"><i style="width:${x.occupation}%"></i></i> ${x.occupation} %</span><span>${x.menages}</span><span>${euros(x.coutC)}</span></div>`).join("")}</div>
      <p class="petit">${tr("Nuits lues dans vos calendriers et séjours saisis ; coût des ménages au prix estimé de chaque réservation.")}</p>
      <div id="releves-proprietaires"></div>`;
    blocRelevesProprietaires(boite.querySelector("#releves-proprietaires"), { biens, sejours, demandes, nomBien, societe, mois: moisRapport, nomMois });
    boite.querySelectorAll("[data-mois]").forEach(b => b.onclick = () => { moisRapport = new Date(moisRapport.getFullYear(), moisRapport.getMonth() + Number(b.dataset.mois), 1); dessiner(); });
    boite.querySelector("[data-export]").onclick = () => {
      const csv = [["bien", "adresse", "sejours", "nuits", "occupation_pct", "menages", "cout_eur"], ...lignes.map(x => [nomBien(x.b), `${x.b.rue}, ${x.b.codePostal} ${x.b.ville}`, x.sejours, x.nuits, x.occupation, x.menages, (x.coutC / 100).toFixed(2).replace(".", ",")])]
        .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `cleaneroo-rapport-${iso(moisRapport).slice(0, 7)}.csv`; a.click();
    };
    boite.querySelector("[data-imprimer]").onclick = () => {
      const w = window.open("", "_blank"); if (!w) return;
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(tr("Relevé"))} ${esc(nomMois)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#14232E}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#EEF6F5}</style>
        <h1>${esc(tr("Relevé d'activité"))} · ${esc(nomMois)}</h1><p>${esc(societe || "")}</p>
        <table><tr><th>${esc(tr("Bien"))}</th><th>${esc(tr("Séjours"))}</th><th>${esc(tr("Nuits"))}</th><th>${esc(tr("Occupation"))}</th><th>${esc(tr("Ménages"))}</th><th>${esc(tr("Coût"))}</th></tr>
        ${lignes.map(x => `<tr><td>${esc(nomBien(x.b))}<br><small>${esc(x.b.rue)}, ${esc(x.b.codePostal)} ${esc(x.b.ville)}</small></td><td>${x.sejours}</td><td>${x.nuits}</td><td>${x.occupation} %</td><td>${x.menages}</td><td>${euros(x.coutC)}</td></tr>`).join("")}
        <tr><th>${esc(tr("Total"))}</th><th>${total.sejours}</th><th>${total.nuits}</th><th></th><th>${total.menages}</th><th>${euros(total.coutC)}</th></tr></table>
        <p><small>Cleaneroo · cleaneroo.fr</small></p><script>print()<\/script>`);
      w.document.close();
    };
    traduire(boite);
  };
  dessiner();
}

/** Relevés par propriétaire (24/11/2026) : un par propriétaire invité (Équipe), PDF à télécharger et partage dans son espace. */
async function blocRelevesProprietaires(zone, { biens, sejours, demandes, nomBien, societe, mois, nomMois }) {
  if (!zone) return;
  const { data } = await supabase.rpc("mon_equipe").catch(() => ({ data: null }));
  const proprios = (data || []).filter(m => m.role === "PROPRIETAIRE");
  if (!zone.isConnected) return;
  if (!proprios.length) { zone.innerHTML = `<p class="petit muet">${tr("Relevés par propriétaire : invitez vos propriétaires dans « Équipe et propriétaires » pour leur préparer un relevé mensuel.")}</p>`; traduire(zone); return; }
  const releve = m => releveProprietaire({ biens: biens.filter(b => (m.biens || []).includes(b.id)), mois, sejours, demandes, nomBien });
  zone.innerHTML = `<h3 class="sous-titre-releves">${tr("Relevés par propriétaire")} · ${esc(nomMois)}</h3>
    ${proprios.map(m => { const r = releve(m); return `<div class="ligne-releve"><div><b>${esc(m.email)}</b>
      <span class="petit muet">${r.biens.length} ${tr(r.biens.length > 1 ? "logements" : "logement")} · ${r.nuits} ${tr("nuits")} · ${tr("total à refacturer")} <b>${euros(r.totalC)}</b></span></div>
      <div class="boutons"><button type="button" class="bouton secondaire petit" data-releve-pdf="${esc(m.id)}">${tr("Relevé PDF")}</button>
        ${m.statut === "ACTIF" ? `<button type="button" class="bouton petit" data-releve-partager="${esc(m.id)}">${tr("Partager avec le propriétaire")}</button>`
          : `<span class="petit muet">${tr("Invitation pas encore acceptée")}</span>`}</div>
      <p class="petit" data-releve-etat="${esc(m.id)}"></p></div>`; }).join("")}`;
  traduire(zone);
  const membre = id => proprios.find(m => m.id === id);
  zone.querySelectorAll("[data-releve-pdf]").forEach(b => b.onclick = async () => {
    const m = membre(b.dataset.relevePdf); b.disabled = true;
    try { const { releveProprietairePdf, remettre } = await import("./pdf.js");
      await remettre(await releveProprietairePdf(releve(m), { nomMois, conciergerie: societe, proprietaire: m.email }), `cleaneroo-releve-${iso(mois).slice(0, 7)}.pdf`, "application/pdf", { partager: true }); }
    finally { b.disabled = false; }
  });
  zone.querySelectorAll("[data-releve-partager]").forEach(b => b.onclick = async () => {
    const m = membre(b.dataset.relevePartager), etat = zone.querySelector(`[data-releve-etat="${CSS.escape(m.id)}"]`);
    b.disabled = true;
    const { data: r, error } = await supabase.rpc("publier_releve", { p_membre: m.id, p_mois: iso(mois), p_donnees: { ...releve(m), conciergerie: societe || "", nomMois } });
    b.disabled = false;
    etat.textContent = tr(!error && r === "ok" ? "Relevé partagé : le propriétaire le retrouve dans son espace." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
}

/* ------------------------------------------------------------------ « Programmer tout » (24/11/2026, repris de l'appli iPhone)
   Programme d'un coup tous les départs sans ménage des 14 prochains jours, au prix de chaque logement (prix fixé par la conciergerie,
   sinon le prix de la grille recalculé pour la date, comme le serveur), un seul ménage par départ. Le total est affiché avant la
   confirmation. Chaque ménage reprend le dernier ménage réservé pour ce logement (consignes, accès, tâches) ; sans ménage précédent,
   le logement est à programmer à la main. Paiement : le premier ménage est payé sur la page sécurisée Stripe, les suivants sont
   prélevés sur la même carte 3 jours avant chacun (groupe de paiement, comme les passages d'un entretien régulier). */
export const PROGRAMMER_TOUT_JOURS = 14;
const CHAMPS_MODELE = ["rubrique_id", "duree_min", "nombre_cleaneurs", "espace", "prenom", "nom", "email", "telephone", "rue", "code_postal", "ville",
  "accueil", "acces", "remarque", "choix_cleaneur", "cleaneur_favori"];
/** Instant (ISO) d'une heure de Paris un jour donné, quel que soit le fuseau du navigateur. */
export function instantParis(jour, h) {
  const [a, m, j] = jour.split("-").map(Number);
  const utc = Date.UTC(a, m - 1, j, h);
  const vu = new Date(new Date(utc).toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const ecart = vu.getTime() - new Date(new Date(utc).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(utc - ecart).toISOString();
}
/** Dernier ménage réservé pour un logement (modèle). */
export const modeleDe = (l, demandes) => demandes.filter(d => d.statut !== "ANNULEE" && ["rental", "hospitality"].includes(d.rubrique_id)
    && (d.details?.logementId === l.id || memeAdresse(d, l)))
  .sort((a, b) => String(b.cree_le || b.creneau || "").localeCompare(String(a.cree_le || a.creneau || "")))[0] || null;

/**
 * Plan de « Programmer tout ». Fonction pure, testée. departs : [{ bienId, fin }] ; menagePrevu(bienId, jour) ; abonne : 0 % de frais.
 * Renvoie { lignes: [{ bien, jour, creneau, prixC, creditImpotC, fraisPct, modele }], sansModele: [{ bien, jour }], prestationsC, fraisC, totalC }.
 */
export function planProgrammerTout({ biens, departs, demandes, menagePrevu, abonne = false, aujourdhui = new Date(), jours = PROGRAMMER_TOUT_JOURS }) {
  const debut = iso(aujourdhui), limite = iso(plusJours(aujourdhui, jours));
  const vus = new Set(), lignes = [], sansModele = [];
  for (const s of [...departs].sort((a, b) => a.fin.localeCompare(b.fin))) {
    const cle = `${s.bienId}|${s.fin}`;
    if (vus.has(cle) || s.fin < debut || s.fin > limite || menagePrevu(s.bienId, s.fin)) continue;
    vus.add(cle);
    const bien = biens.find(b => b.id === s.bienId);
    if (!bien) continue;
    const modele = modeleDe(bien, demandes);
    if (!modele || modele.sur_devis) { sansModele.push({ bien, jour: s.fin }); continue; }
    // Heure de départ du séjour (départ tardif réglé séjour par séjour), sinon celle du dernier ménage.
    const departH = Number.isFinite(s.departH) ? s.departH : Number(modele.details?.departVoyageursH ?? REGLES.DEPART_VOYAGEURS_DEFAUT_H);
    const creneau = instantParis(s.fin, departH);
    const prixLibre = Number(bien.prixMenageC) >= 1000 && ["conciergerie", "hotellerie"].includes(modele.espace) && modele.rubrique_id === "rental";
    let prixC, creditImpotC = 0, fraisPct = abonne ? 0 : REGLES.FRAIS_SERVICE_PRO_PCT;
    if (prixLibre) prixC = Math.round(Number(bien.prixMenageC));
    else {
      // Même calcul que le serveur au paiement (dimanche, créneau, zone) : le prix affiché est celui qui sera payé.
      const b = { taches: [], tachesPerso: [], ...(modele.details || {}), rubriqueId: modele.rubrique_id, codePostal: modele.code_postal || "", abonnePro: abonne };
      const r = calculer(entreeEstimation(b, modele.espace === "personnel", new Date(creneau)));
      if (r.devisObligatoire) { sansModele.push({ bien, jour: s.fin }); continue; }
      prixC = r.totalC; creditImpotC = r.creditImpotC || 0; fraisPct = r.fraisServicePct;
    }
    const suivant = departs.find(x => x.bienId === s.bienId && x.debut === s.fin);
    lignes.push({ bien, jour: s.fin, creneau, prixC, creditImpotC, fraisPct, modele, prixLibre, departH, arriveeH: suivant ? arriveeDe(suivant) : null });
  }
  const prestationsC = lignes.reduce((t, x) => t + x.prixC, 0);
  const fraisC = lignes.reduce((t, x) => t + Math.round(x.prixC * x.fraisPct / 100), 0);
  return { lignes, sansModele, prestationsC, fraisC, totalC: prestationsC + fraisC };
}

/** Bouton « Programmer tout » (vide s'il n'y a rien à programmer). */
export const boutonProgrammerTout = plan => plan.lignes.length && !reservationsFermees()
  ? `<div class="programmer-tout"><button type="button" class="bouton plein petit" data-programmer-tout>${icone("calendrier")} ${tr("Programmer tout")} (${plan.lignes.length})</button>
      <span class="petit muet">${tr("Tous les départs sans ménage des 14 prochains jours")} · ${euros(plan.totalC)}</span></div>` : "";

/** Fenêtre de confirmation puis programmation. */
export function fenetreProgrammerTout(plan, { nomBien, recharger }) {
  const fond = document.createElement("div");
  fond.className = "fenetre-fond";
  fond.innerHTML = `<div class="fenetre carte" role="dialog" aria-modal="true" aria-labelledby="titre-programmer-tout">
    <h2 id="titre-programmer-tout" style="margin-top:0">${tr("Programmer tous les ménages")}</h2>
    <p class="petit" style="margin-top:0">${tr("Un ménage par départ de voyageurs des 14 prochains jours, au prix de chaque logement.")}</p>
    <div class="liste-programmer-tout">${plan.lignes.map(x => `<div class="ligne-montant"><span><b>${esc(nomBien(x.bien))}</b> · ${esc(dateCourte(jourDe(x.jour)))}</span><span>${euros(x.prixC)}</span></div>`).join("")}</div>
    <div class="ligne-montant"><span>${tr("Ménages")} (${plan.lignes.length})</span><span>${euros(plan.prestationsC)}</span></div>
    <div class="ligne-montant"><span>${tr("Frais de service Cleaneroo")}</span><span>${plan.fraisC ? euros(plan.fraisC) : tr("0 € (abonné)")}</span></div>
    <div class="ligne-montant total"><span>${tr("Total")}</span><span>${euros(plan.totalC)}</span></div>
    ${plan.sansModele.length ? `<p class="petit note alerte">${tr("À programmer à la main (aucun ménage précédent pour reprendre les consignes)")} : ${plan.sansModele.map(x => `${esc(nomBien(x.bien))} · ${esc(dateCourte(jourDe(x.jour)))}`).join(", ")}</p>` : ""}
    <p class="petit">${icone("paiement")} ${tr("Le premier ménage est payé maintenant sur la page sécurisée Stripe ; les suivants sont prélevés sur la même carte 3 jours avant chacun. Chaque montant reste bloqué jusqu'à la validation du ménage.")}</p>
    <p class="erreur" data-erreur-programmer></p>
    <div class="boutons"><button type="button" class="bouton plein" data-confirmer>${tr("Programmer")} ${plan.lignes.length} ${tr(plan.lignes.length > 1 ? "ménages" : "ménage")} · ${euros(plan.totalC)}</button>
      <button type="button" class="bouton secondaire" data-fermer>${tr("Annuler")}</button></div></div>`;
  document.body.appendChild(fond); traduire(fond);
  const fermer = () => fond.remove();
  fond.querySelector("[data-fermer]").onclick = fermer;
  fond.onclick = e => { if (e.target === fond) fermer(); };
  fond.querySelector("[data-confirmer]").onclick = async e => {
    const bouton = e.currentTarget, err = fond.querySelector("[data-erreur-programmer]");
    bouton.disabled = true; err.textContent = tr("Programmation en cours…");
    const groupe = crypto.randomUUID(), faits = [];
    for (const x of plan.lignes) {
      const m = x.modele, details = { ...(m.details || {}) };
      ["pilote", "depuisModele", "prixCorrigeLe", "prixNavigateurC", "fraisServicePctServeur", "passages"].forEach(k => delete details[k]);
      Object.assign(details, { logementId: x.bien.id, programmeTout: true, fraisServicePct: x.fraisPct, fraisServiceC: Math.round(x.prixC * x.fraisPct / 100),
        departVoyageursH: x.departH, ...(x.arriveeH != null ? { arriveeSuivanteH: x.arriveeH } : {}) });
      if (x.prixLibre) Object.assign(details, { prixLibre: true });
      const demande = Object.fromEntries(CHAMPS_MODELE.filter(k => m[k] !== undefined).map(k => [k, m[k]]));
      try {
        faits.push(await envoyerDemande({ ...demande, details, estimation_c: x.prixC, credit_impot_c: x.creditImpotC, sur_devis: false, flexible: false,
          prelancement: false, creneau: x.creneau, groupe_paiement: groupe, remise_parrainage_c: 0, cagnotte_c: 0 }));
      } catch { /* les autres continuent ; le compte est donné ci-dessous */ }
    }
    if (!faits.length) { bouton.disabled = false; err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    if (faits.length < plan.lignes.length) err.textContent = `${faits.length} / ${plan.lignes.length} ${tr("ménages programmés : relancez « Programmer tout » pour les autres.")}`;
    const url = await lancerPaiement(faits[0].reference, faits[0].jeton).catch(() => null);
    if (url) { location.href = url; return; }
    fermer(); recharger();
  };
}
