// Paiement Stripe d'une demande (site et application) — fonction serveur Supabase « paiement ».
// La clé secrète Stripe (STRIPE_SECRET_KEY, clé de test sk_test_… pour l'instant) est dans les secrets Supabase, jamais dans le code.
// Principe (22 novembre 2026, règle de l'utilisateur) : le client PAIE en réservant, sur la page sécurisée Stripe (carte, Apple Pay,
// Google Pay, Link). Le montant reste BLOQUÉ par Cleaneroo et n'est LIBÉRÉ pour le versement au Cleaneur qu'après la validation
// (par le client, ou automatiquement 48 h après la fin). Demande annulée : REMBOURSÉE. La carte est enregistrée pour les passages
// suivants d'un entretien régulier (prélevés 3 jours avant) et pour un complément (supplément accepté sur place, pourboire).
// Actions du client (lien de suivi ou compte) : creer (→ adresse de la page de paiement), verifier (retour de Stripe).
// Actions du serveur (en-tête x-cle-alertes, base-paiement-reservation.sql) : rembourser, liberer, synchroniser.
// Prix libres des conciergeries (base-prix-conciergeries.sql) : prix non recalculé ; la facture du Cleaneur porte déjà son net.
// Versements (Stripe Connect, base-pilote-connect.sql) : à la validation, la part du Cleaneur (prestation − commission + pourboire
// + prime d'urgence) est transférée sur son compte de versement ; virement sur son IBAN chaque vendredi.
// Actions du Cleaneur connecté : connect (→ formulaire Stripe : identité, IBAN), connect_etat (versements activés ?).
// Ancien fonctionnement (empreinte) gardé pour les demandes déjà garanties : encaisser, annuler, statuts AUTORISE / ENCAISSE / ANNULE.
import { createClient } from "jsr:@supabase/supabase-js@2";
// Prix vérifié par le serveur (refonte du 20 novembre 2026) : les MÊMES fichiers que le site (assets/js/prix-serveur.js,
// figés sur un commit du dépôt), avec les tarifs publiés depuis l'espace de gestion. Après chaque changement des règles
// dans assets/js : pousser le site, remplacer le numéro de commit ci-dessous, puis redéployer cette fonction.
import { calculer, entreeEstimation, appliquerTarifs } from "https://esm.sh/gh/Quantum-App360/cleaneroo-site@87ecf7d/assets/js/prix-serveur.js?target=deno";

/** Passages suivants d'un entretien régulier : prélevés automatiquement ce nombre d'heures avant le passage. */
const PRELEVEMENT_AVANT_H = 72;
/** Demande non payée : annulée sans frais après ce délai (compté depuis l'ouverture pour les pré-réservations). */
const DELAI_PAIEMENT_H = 24;
/** Prélèvement refusé : le client a jusqu'à ce nombre d'heures avant le passage pour payer, sinon le passage est annulé. */
const DERNIER_DELAI_AVANT_H = 24;
/** Ouverture des réservations : 31 décembre 2026, 0 h à Paris. */
const OUVERTURE = Date.parse("2026-12-30T23:00:00Z");
const H = 3600_000;

/** Date affichée à Paris (le serveur tourne en UTC) : dimanche et créneau malin se jugent à l'heure de Paris. */
function heureDeParis(iso: string | null) {
  if (!iso) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
}
/** Recalcule le prix d'une demande ; null si elle ne peut pas l'être (devis, ancienne demande sans détails). */
function prixServeur(d: Record<string, any>, abonne: boolean) {
  if (!d.details || !d.rubrique_id) return null;
  const b = { taches: [], tachesPerso: [], ...d.details, rubriqueId: d.rubrique_id, codePostal: d.code_postal || "", abonnePro: abonne };
  const perso = d.espace === "personnel";
  const e = entreeEstimation(b, perso, heureDeParis(d.creneau));
  const r1 = calculer(e), r2 = calculer({ ...e, creneauMalin: !e.creneauMalin });   // le créneau malin dépend du moment de la réservation
  return { normal: r1, variante: r2 };
}

const SITES = ["https://cleaneroo.fr", "https://www.cleaneroo.fr", "https://quantum-app360.github.io", "http://localhost:8123"];
const entetes = (origine: string) => ({
  "Access-Control-Allow-Origin": SITES.includes(origine) ? origine : SITES[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

/** Appel à l'API Stripe. cleIdem : clé d'idempotence (un même prélèvement n'est jamais fait deux fois, même si l'appel est rejoué). */
async function stripe(chemin: string, corps?: Record<string, string>, cleIdem?: string) {
  const cle = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/x-www-form-urlencoded", ...(cleIdem ? { "Idempotency-Key": cleIdem } : {}) },
    body: corps ? new URLSearchParams(corps) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.code ?? j?.error?.message ?? "stripe");
  return j;
}

type Demande = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Admin = any;

/** Le client est-il abonné Pro (0 % de frais de service) ? */
async function estAbonne(admin: Admin, d: Demande) {
  const { data: prof } = d.client_id ? await admin.from("profils").select("abonnement_pro").eq("id", d.client_id).maybeSingle() : { data: null };
  return !!prof?.abonnement_pro && prof.abonnement_pro !== "aucun";
}
let tarifsCharges = false;
async function chargerTarifs(admin: Admin) {
  if (tarifsCharges) return;
  const { data: t } = await admin.from("tarifs").select("version, donnees").eq("actif", true).order("version", { ascending: false }).limit(1).maybeSingle();
  appliquerTarifs(t?.donnees || {}, t?.version || 0);
  tarifsCharges = true;
}
/** Prix vérifié par le serveur : le prix enregistré par le navigateur doit être celui des règles (à 1 € près).
 *  Renvoie le pourcentage de frais de service, ou une erreur (le prix est alors corrigé dans la demande). */
async function verifierPrix(admin: Admin, d: Demande): Promise<{ pct: number; erreur?: string; estimation?: number }> {
  await chargerTarifs(admin);
  const abonne = await estAbonne(admin, d);
  const verif = prixServeur(d, abonne);
  const pctDefaut = d.espace === "personnel" ? 5 : abonne ? 0 : 8;
  // Prix libre d'une conciergerie (23/11/2026, montage B) : le prix est celui fixé par la conciergerie, pas la grille.
  // Le prix conseillé (grille) est gardé pour le plancher de 80 % et le baromètre ; frais de service 8 % (0 % abonnée).
  if (d.prix_libre) {
    const prix = d.estimation_c ?? 0;
    if (prix < 1000 || prix > 200000) return { pct: pctDefaut, erreur: "prix_a_verifier" };
    if (d.conseil_c == null && verif && !verif.normal.devisObligatoire)
      await admin.from("demandes").update({ conseil_c: verif.normal.totalC }).eq("id", d.id);
    return { pct: abonne ? 0 : 8 };
  }
  if (verif && !verif.normal.devisObligatoire) {
    const initial = d.estimation_initiale_c ?? d.estimation_c ?? 0;
    const proche = (x: number) => Math.abs(initial - x) <= 100;
    if (!proche(verif.normal.totalC) && !proche(verif.variante.totalC)) {
      if (d.estimation_initiale_c != null) return { pct: pctDefaut, erreur: "prix_a_verifier" };
      const fraisC = Math.round(verif.normal.totalC * verif.normal.fraisServicePct / 100);
      await admin.from("demandes").update({ estimation_c: verif.normal.totalC, credit_impot_c: verif.normal.creditImpotC,
        details: { ...d.details, fraisServiceC: fraisC, fraisServicePct: verif.normal.fraisServicePct, prixCorrigeLe: new Date().toISOString(), prixNavigateurC: initial } }).eq("id", d.id);
      return { pct: verif.normal.fraisServicePct, erreur: "prix_corrige", estimation: verif.normal.totalC };
    }
  }
  // Frais de service recalculés (5 % particulier, 8 % pro, 0 % abonné), jamais repris tels quels du navigateur.
  return { pct: verif?.normal.fraisServicePct ?? pctDefaut };
}
/** Même total que l'écran : prestation + frais de service − remises (parrainage, cagnotte). */
const montantDe = (d: Demande, pct: number) =>
  (d.estimation_c ?? 0) + Math.round((d.estimation_c ?? 0) * pct / 100) - (d.remise_parrainage_c ?? 0) - (d.cagnotte_c ?? 0);
/** Frais de service retenus par le serveur au paiement (repris pour un complément). */
const pctEnregistre = (d: Demande) => Number(d.details?.fraisServicePctServeur ?? d.details?.fraisServicePct ?? (d.espace === "personnel" ? 5 : 8));

/** Trace de chaque opération (paiement, prélèvement, remboursement, complément) dans la demande. */
function trace(d: Demande, entree: Record<string, unknown>) {
  return [...(Array.isArray(d.paiement_journal) ? d.paiement_journal : []), { ...entree, le: new Date().toISOString() }].slice(-30);
}
async function notifierClient(admin: Admin, d: Demande, titre: string, texte: string, niveau = "important") {
  if (!d.client_id) return;
  try { await admin.rpc("notifier", { p_dest: d.client_id, p_espace: "client", p_type: "paiement", p_niveau: niveau, p_titre: titre, p_texte: texte, p_reference: d.reference }); } catch { /* sans gravité */ }
}
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const dateCourte = (iso: string | null) => iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) : "";

/** Prélèvement sur la carte enregistrée, sans le client (passage suivant, complément). Renvoie le PaymentIntent ou l'erreur. */
async function prelever(d: Demande, montant: number, motif: string) {
  return await stripe("payment_intents", {
    amount: String(montant), currency: "eur", customer: d.paiement_client, payment_method: d.paiement_moyen,
    off_session: "true", confirm: "true", "metadata[reference]": d.reference, "metadata[motif]": motif,
    "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never",
    description: `Cleaneroo ${d.reference} · ${motif}`,
  }, `${motif}-${d.reference}-${montant}`);
}

/** Session Stripe terminée : la demande est payée (bloquée) ; la carte est enregistrée pour les passages suivants du même entretien. */
async function confirmerSession(admin: Admin, d: Demande, idSession: string) {
  const s = await stripe(`checkout/sessions/${idSession}?expand[]=payment_intent`);
  const pi = s.payment_intent;
  if (s.status !== "complete" || !pi) return d.paiement_statut;
  const ancien = pi.capture_method === "manual";   // ancienne empreinte
  if (ancien && !["requires_capture", "succeeded"].includes(pi.status)) return d.paiement_statut;
  if (!ancien && pi.status !== "succeeded") return d.paiement_statut;
  const statut = ancien ? (pi.status === "succeeded" ? "ENCAISSE" : "AUTORISE") : "PAYE";
  if (d.paiement_statut === statut) return statut;
  const client = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
  const moyen = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
  await admin.from("demandes").update({ paiement_statut: statut, paiement_intent: pi.id, paiement_c: pi.amount, paiement_client: client, paiement_moyen: moyen,
    paiement_journal: trace(d, { type: "paiement", montant_c: pi.amount, id: pi.id }) }).eq("id", d.id);
  if (statut === "PAYE" && d.groupe_paiement && client && moyen) {
    // Passages suivants : carte enregistrée, prélevés 3 jours avant chacun ; visibles des Cleaneurs dès maintenant.
    await admin.from("demandes").update({ paiement_statut: "A_PRELEVER", paiement_client: client, paiement_moyen: moyen, paiement_test: d.paiement_test })
      .eq("groupe_paiement", d.groupe_paiement).neq("id", d.id).is("paiement_statut", null).neq("statut", "ANNULEE");
  }
  if (statut === "PAYE") await notifierClient(admin, d, "Paiement reçu", `${euros(pi.amount)} : le montant reste bloqué jusqu'à votre validation de la prestation. Votre demande est transmise aux Cleaneurs.`, "standard");
  return statut;
}

/** Passage suivant : prix revérifié, puis prélevé sur la carte enregistrée. En cas de refus : ECHEC, le client paie depuis son suivi. */
async function preleverPassage(admin: Admin, d: Demande) {
  const v = await verifierPrix(admin, d);
  if (v.erreur === "prix_a_verifier") return;
  const dd = v.estimation != null ? { ...d, estimation_c: v.estimation } : d;
  const montant = montantDe(dd, v.pct);
  if (montant < 50 || !d.paiement_client || !d.paiement_moyen) return;
  try {
    const pi = await prelever(dd, montant, "passage");
    if (pi.status !== "succeeded") throw new Error(pi.status);
    await admin.from("demandes").update({ paiement_statut: "PAYE", paiement_intent: pi.id, paiement_c: montant,
      details: { ...d.details, fraisServicePctServeur: v.pct }, paiement_journal: trace(d, { type: "prelevement", montant_c: montant, id: pi.id }) }).eq("id", d.id);
  } catch (e) {
    await admin.from("demandes").update({ paiement_statut: "ECHEC", paiement_journal: trace(d, { type: "prelevement_refuse", montant_c: montant, erreur: String((e as Error).message) }) }).eq("id", d.id);
    await notifierClient(admin, d, "Paiement refusé",
      `Le prélèvement de ${euros(montant)} pour votre passage du ${dateCourte(d.creneau)} a été refusé. Payez depuis votre suivi pour le confirmer, sinon il sera annulé sans frais 24 h avant.`);
  }
}

/** Versement au Cleaneur (ou à sa société) d'une prestation validée : prestation − commission + pourboire + prime d'urgence,
 *  d'après les factures émises à la validation. Sans compte de versement actif : en attente, réessayé dès qu'il est activé. */
async function verser(admin: Admin, d: Demande) {
  if (d.versement_statut === "VERSE" || !["LIBERE", "ENCAISSE"].includes(d.paiement_statut)) return d.versement_statut;
  const payeur = d.societe_id ?? d.cleaneur_id;
  if (!payeur) return d.versement_statut;
  const { data: p } = await admin.from("profils").select("stripe_compte, stripe_compte_actif").eq("id", payeur).maybeSingle();
  const { data: factures } = await admin.from("factures").select("type, total_ttc_c").eq("reference", d.reference);
  const { data: avis } = await admin.from("avis").select("pourboire_c").eq("reference", d.reference).maybeSingle();
  const presta = (factures || []).find((f: any) => f.type === "prestation")?.total_ttc_c ?? d.estimation_c ?? 0;
  const commission = (factures || []).find((f: any) => f.type === "commission")?.total_ttc_c ?? 0;
  const montant = presta - commission + (avis?.pourboire_c ?? 0) + (d.prime_urgence_c ?? 0);
  if (montant <= 0) { await admin.from("demandes").update({ versement_statut: "RIEN", versement_c: 0 }).eq("id", d.id); return "RIEN"; }
  if (!p?.stripe_compte || !p.stripe_compte_actif) {
    if (d.versement_statut !== "COMPTE_A_ACTIVER") {
      await admin.from("demandes").update({ versement_statut: "COMPTE_A_ACTIVER", versement_c: montant }).eq("id", d.id);
      try { await admin.rpc("notifier", { p_dest: payeur, p_espace: "cleaneur", p_type: "paiement", p_niveau: "important", p_titre: "Activez vos versements",
        p_texte: `${euros(montant)} vous attendent. Renseignez votre IBAN dans « Mon activité » pour les recevoir.`, p_reference: d.reference }); } catch { /* sans gravité */ }
    }
    return "COMPTE_A_ACTIVER";
  }
  try {
    // Le transfert s'appuie sur le paiement du client quand il le couvre (fonds disponibles tout de suite).
    let source: string | null = null;
    if (d.paiement_intent && !String(d.paiement_intent).startsWith("pi_test_")) {
      const pi = await stripe(`payment_intents/${d.paiement_intent}`).catch(() => null);
      if (pi?.latest_charge && montant <= (pi.amount_received ?? 0)) source = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge.id;
    }
    const t = await stripe("transfers", { amount: String(montant), currency: "eur", destination: p.stripe_compte, transfer_group: d.reference,
      "metadata[reference]": d.reference, description: `Cleaneroo ${d.reference}`, ...(source ? { source_transaction: source } : {}) }, `versement-${d.reference}`);
    await admin.from("demandes").update({ versement_statut: "VERSE", versement_c: montant, versement_id: t.id,
      paiement_journal: trace(d, { type: "versement", montant_c: montant, id: t.id }) }).eq("id", d.id);
    try { await admin.rpc("notifier", { p_dest: payeur, p_espace: "cleaneur", p_type: "paiement", p_niveau: "standard", p_titre: "Paiement reçu",
      p_texte: `${euros(montant)} pour la prestation ${d.reference} : viré sur votre compte bancaire vendredi.`, p_reference: d.reference }); } catch { /* sans gravité */ }
    return "VERSE";
  } catch (e) {
    await admin.from("demandes").update({ versement_statut: "ECHEC", versement_c: montant,
      paiement_journal: trace(d, { type: "versement_refuse", montant_c: montant, erreur: String((e as Error).message) }) }).eq("id", d.id);
    return "ECHEC";
  }
}

/** Toutes les 15 minutes : retours de Stripe non vérifiés, passages suivants à prélever, demandes impayées à rappeler ou annuler. */
async function synchroniser(admin: Admin) {
  const bilan = { verifies: 0, preleves: 0, rappels: 0, annules: 0, verses: 0 };
  const maintenant = Date.now();
  // 1. Paiements faits sur Stripe dont le client n'est pas revenu sur le site ou l'appli.
  const { data: attente } = await admin.from("demandes").select("*").eq("paiement_statut", "EN_ATTENTE").not("paiement_session", "is", null)
    .gte("maj_le", new Date(maintenant - 48 * H).toISOString()).limit(100);
  for (const d of attente || []) {
    try { if (["PAYE", "AUTORISE", "ENCAISSE"].includes(await confirmerSession(admin, d, d.paiement_session))) bilan.verifies++; } catch { /* réessayé au prochain passage */ }
  }
  // 2. Passages suivants dont la date approche (ou sans date : tout de suite).
  const { data: aPrelever } = await admin.from("demandes").select("*").eq("paiement_statut", "A_PRELEVER").in("statut", ["VERIFICATION", "PUBLIEE", "CONFIRMEE"]).limit(100);
  for (const d of aPrelever || []) {
    if (d.creneau && Date.parse(d.creneau) - maintenant > PRELEVEMENT_AVANT_H * H) continue;
    await preleverPassage(admin, d); bilan.preleves++;
  }
  // 3. Demandes impayées : un rappel, puis annulation sans frais (rien n'a été débité).
  const { data: impayees } = await admin.from("demandes").select("*").in("statut", ["VERIFICATION", "PUBLIEE", "CONFIRMEE"]).eq("sur_devis", false)
    .or("paiement_statut.is.null,paiement_statut.eq.EN_ATTENTE,paiement_statut.eq.ECHEC").limit(200);
  for (const d of impayees || []) {
    const depart = Math.max(Date.parse(d.cree_le), d.prelancement ? OUVERTURE : 0);
    if (maintenant < depart) continue;                       // pré-réservation : rien à payer avant l'ouverture
    const journal = Array.isArray(d.paiement_journal) ? d.paiement_journal : [];
    // Prélèvement refusé : jusqu'à 24 h avant le passage (sans date : 24 h après le refus) ; sinon 24 h après la demande
    // (48 h après l'ouverture pour une pré-réservation).
    const refus = [...journal].reverse().find((x: any) => x.type === "prelevement_refuse");
    const limite = d.paiement_statut === "ECHEC"
      ? (d.creneau ? Date.parse(d.creneau) - DERNIER_DELAI_AVANT_H * H : Date.parse(refus?.le ?? d.maj_le) + DELAI_PAIEMENT_H * H)
      : depart + (d.prelancement ? 2 * DELAI_PAIEMENT_H : DELAI_PAIEMENT_H) * H;
    if (maintenant >= limite) {
      if (d.paiement_session && d.paiement_statut === "EN_ATTENTE") {
        // Dernière vérification : le client a peut-être payé à l'instant.
        try { if (["PAYE", "AUTORISE", "ENCAISSE"].includes(await confirmerSession(admin, d, d.paiement_session))) continue; } catch { continue; }
        await stripe(`checkout/sessions/${d.paiement_session}/expire`, {}).catch(() => null);
      }
      await admin.from("demandes").update({ statut: "ANNULEE", paiement_journal: trace(d, { type: "annulee_impayee" }),
        notes_admin: `${d.notes_admin || ""} Annulée sans frais : non payée.`.trim() }).eq("id", d.id).in("statut", ["VERIFICATION", "PUBLIEE", "CONFIRMEE"]);
      await notifierClient(admin, d, "Demande annulée", "Le paiement n'a pas été fait à temps : la demande est annulée, rien n'a été débité. Vous pouvez réserver à nouveau en deux minutes.");
      bilan.annules++;
    } else if (maintenant - depart > H && !journal.some((x: any) => x.type === "rappel")) {
      await admin.from("demandes").update({ paiement_journal: trace(d, { type: "rappel" }) }).eq("id", d.id);
      await notifierClient(admin, d, "Paiement à finaliser",
        "Votre demande sera transmise aux Cleaneurs dès le paiement. Sans paiement, elle sera annulée sans frais.");
      bilan.rappels++;
    }
  }
  // 4. Versements en attente (compte du Cleaneur activé entre-temps, ou échec à réessayer).
  const { data: aVerser } = await admin.from("demandes").select("*").eq("statut", "TERMINEE").in("paiement_statut", ["LIBERE", "ENCAISSE"])
    .or("versement_statut.is.null,versement_statut.eq.COMPTE_A_ACTIVER,versement_statut.eq.ECHEC").limit(100);
  for (const d of aVerser || []) if ((await verser(admin, d)) === "VERSE") bilan.verses++;
  return bilan;
}

Deno.serve(async (req) => {
  const origine = req.headers.get("origin") ?? "";
  const h = entetes(origine);
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const reponse = (o: unknown, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: h });
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) return reponse({ erreur: "non_configure" }, 503);
    const { action, reference, jeton, session } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const test = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_");

    // Actions du serveur (déclencheurs et tâche planifiée) : clé privée des tâches automatiques.
    const internes = ["rembourser", "liberer", "synchroniser"];
    if (internes.includes(action)) {
      const { data: cle } = await admin.from("config_privee").select("valeur").eq("cle", "alertes").maybeSingle();
      if (!cle?.valeur || req.headers.get("x-cle-alertes") !== cle.valeur) return reponse({ erreur: "refuse" }, 403);
      if (action === "synchroniser") return reponse(await synchroniser(admin));
    }

    // Compte de versement du Cleaneur connecté (Stripe Connect Express : identité et IBAN saisis chez Stripe, jamais chez Cleaneroo).
    if (action === "connect" || action === "connect_etat") {
      const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
      const uid = u?.user?.id;
      if (!uid) return reponse({ erreur: "connexion" }, 401);
      const { data: p } = await admin.from("profils").select("id, role, stripe_compte, stripe_compte_actif").eq("id", uid).maybeSingle();
      if (!p) return reponse({ erreur: "profil" }, 404);
      if (action === "connect_etat") {
        if (!p.stripe_compte) return reponse({ compte: false, actif: false });
        const a = await stripe(`accounts/${p.stripe_compte}`);
        const actif = a.capabilities?.transfers === "active" && !!a.payouts_enabled;
        if (actif !== p.stripe_compte_actif) await admin.from("profils").update({ stripe_compte_actif: actif }).eq("id", uid);
        return reponse({ compte: true, actif, a_completer: !a.details_submitted || (a.requirements?.currently_due || []).length > 0 });
      }
      let compte = p.stripe_compte;
      if (!compte) {
        try {
          const a = await stripe("accounts", { type: "express", country: "FR", ...(u?.user?.email ? { email: u.user.email } : {}),
            "capabilities[transfers][requested]": "true", "settings[payouts][schedule][interval]": "weekly",
            "settings[payouts][schedule][weekly_anchor]": "friday", "metadata[profil]": uid }, `compte-${uid}`);
          compte = a.id;
          await admin.from("profils").update({ stripe_compte: compte, stripe_compte_actif: false }).eq("id", uid);
        } catch (e) {
          return reponse({ erreur: /connect/i.test(String((e as Error).message)) ? "connect_inactif" : "service", detail: String((e as Error).message) }, 503);
        }
      }
      const base = SITES.includes(origine) ? origine : SITES[0];
      const lien = await stripe("account_links", { account: compte, type: "account_onboarding",
        refresh_url: `${base}/#/compte`, return_url: `${base}/#/compte` });
      return reponse({ url: lien.url });
    }

    const { data: d } = await admin.from("demandes").select("*").eq("reference", String(reference ?? "")).maybeSingle();
    if (!d) return reponse({ erreur: "introuvable" }, 404);
    const maj = (champs: Record<string, unknown>) => admin.from("demandes").update(champs).eq("id", d.id);

    if (action === "rembourser") {
      if (d.statut !== "ANNULEE") return reponse({ statut: d.paiement_statut });
      if (d.paiement_statut === "PAYE" && d.paiement_intent) {
        // Remboursement intégral : les annulations possibles aujourd'hui sont toutes sans frais (client avant confirmation,
        // retard de plus de 30 min, pas de remplaçant, non-paiement).
        const r = await stripe("refunds", { payment_intent: d.paiement_intent, "metadata[reference]": d.reference }, `remboursement-${d.reference}`);
        await maj({ paiement_statut: "REMBOURSE", paiement_journal: trace(d, { type: "remboursement", montant_c: r.amount, id: r.id }) });
        await notifierClient(admin, d, "Remboursement en cours", `${euros(r.amount)} vous sont remboursés sur votre carte (5 à 10 jours selon votre banque).`);
        return reponse({ statut: "REMBOURSE" });
      }
      if (d.paiement_statut === "AUTORISE" && d.paiement_intent) {
        await stripe(`payment_intents/${d.paiement_intent}/cancel`, {});
        await maj({ paiement_statut: "ANNULE" });
        return reponse({ statut: "ANNULE" });
      }
      if (d.paiement_statut === "EN_ATTENTE" && d.paiement_session) await stripe(`checkout/sessions/${d.paiement_session}/expire`, {}).catch(() => null);
      if (["A_PRELEVER", "ECHEC", "EN_ATTENTE"].includes(d.paiement_statut)) await maj({ paiement_statut: "ANNULE" });
      return reponse({ statut: d.paiement_statut });
    }

    if (action === "liberer") {
      if (d.statut !== "TERMINEE") return reponse({ statut: d.paiement_statut });
      if (d.paiement_statut === "AUTORISE" && d.paiement_intent) {   // ancienne empreinte : encaissée à la validation
        await stripe(`payment_intents/${d.paiement_intent}/capture`, {});
        await maj({ paiement_statut: "ENCAISSE" });
        await verser(admin, { ...d, paiement_statut: "ENCAISSE" });
        return reponse({ statut: "ENCAISSE" });
      }
      if (d.paiement_statut !== "PAYE") return reponse({ statut: d.paiement_statut });
      // Complément : supplément accepté sur place (le prix de la demande a augmenté) et pourboire laissé à la validation.
      const { data: avis } = await admin.from("avis").select("pourboire_c").eq("reference", d.reference).maybeSingle();
      const du = montantDe(d, pctEnregistre(d)) + (avis?.pourboire_c ?? 0) - (d.paiement_c ?? 0);
      let journal = trace(d, { type: "libere" });
      let paye = d.paiement_c ?? 0;
      if (du >= 50 && d.paiement_client && d.paiement_moyen) {
        try {
          const pi = await prelever(d, du, "complement");
          if (pi.status !== "succeeded") throw new Error(pi.status);
          paye += du; journal = [...journal, { type: "complement", montant_c: du, id: pi.id, le: new Date().toISOString() }];
        } catch (e) {
          journal = [...journal, { type: "complement_refuse", montant_c: du, erreur: String((e as Error).message), le: new Date().toISOString() }];
          await notifierClient(admin, d, "Complément à régler", `Le complément de ${euros(du)} (supplément accepté ou pourboire) n'a pas pu être prélevé. Notre équipe vous recontacte.`);
        }
      }
      await maj({ paiement_statut: "LIBERE", paiement_c: paye, paiement_journal: journal });
      await verser(admin, { ...d, paiement_statut: "LIBERE", paiement_c: paye, paiement_journal: journal });
      return reponse({ statut: "LIBERE" });
    }

    // Actions du client : le lien de suivi (jeton) ou le compte du client connecté.
    let autorise = !!jeton && d.jeton === jeton;
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!autorise && auth && d.client_id) {
      const { data: u } = await admin.auth.getUser(auth);
      autorise = u?.user?.id === d.client_id;
    }
    if (!autorise) return reponse({ erreur: "refuse" }, 403);

    if (action === "creer") {
      if (d.sur_devis) return reponse({ erreur: "sur_devis" }, 400);
      if (["ANNULEE", "TERMINEE"].includes(d.statut)) return reponse({ erreur: "statut" }, 400);
      if (["AUTORISE", "ENCAISSE", "PAYE", "LIBERE", "A_PRELEVER"].includes(d.paiement_statut)) return reponse({ erreur: "deja_paye" }, 400);
      if (d.prelancement && Date.now() < OUVERTURE) return reponse({ erreur: "prelancement" }, 400);
      // Session déjà ouverte : peut-être payée entre-temps.
      if (d.paiement_statut === "EN_ATTENTE" && d.paiement_session) {
        const st = await confirmerSession(admin, d, d.paiement_session).catch(() => d.paiement_statut);
        if (["PAYE", "AUTORISE", "ENCAISSE"].includes(st)) return reponse({ erreur: "deja_paye" }, 400);
      }
      const v = await verifierPrix(admin, d);
      if (v.erreur === "prix_a_verifier") return reponse({ erreur: "prix_a_verifier" }, 409);
      if (v.erreur === "prix_corrige") return reponse({ erreur: "prix_corrige", estimation_c: v.estimation }, 409);
      const montant = montantDe(d, v.pct);
      if (montant < 50) return reponse({ erreur: "montant" }, 400);
      const base = SITES.includes(origine) ? origine : SITES[0];
      const retour = `${base}/?paiement={CHECKOUT_SESSION_ID}#/demande/${d.reference}/${d.jeton}`;
      const s = await stripe("checkout/sessions", {
        mode: "payment",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(montant),
        "line_items[0][price_data][product_data][name]": `Cleaneroo · réservation ${d.reference}`,
        "line_items[0][quantity]": "1",
        // Débit immédiat ; la carte est gardée pour les passages suivants et un éventuel complément (supplément, pourboire).
        "payment_intent_data[setup_future_usage]": "off_session",
        "payment_intent_data[metadata][reference]": d.reference,
        "payment_intent_data[description]": `Cleaneroo ${d.reference}`,
        customer_creation: "always",
        ...(d.email ? { customer_email: d.email } : {}),
        locale: "auto",
        success_url: retour,
        cancel_url: `${base}/#/demande/${d.reference}/${d.jeton}`,
      });
      await maj({ paiement_statut: "EN_ATTENTE", paiement_session: s.id, paiement_c: montant, paiement_test: test,
        details: { ...d.details, fraisServicePctServeur: v.pct } });
      return reponse({ url: s.url });
    }

    if (action === "verifier") {
      const id = String(session ?? d.paiement_session ?? "");
      if (!id || id !== d.paiement_session) return reponse({ statut: d.paiement_statut });
      return reponse({ statut: await confirmerSession(admin, d, id) });
    }

    // Ancien fonctionnement (empreinte) : encaisser après validation, lever si annulée. Désormais fait par le serveur.
    if (action === "encaisser") {
      if (d.statut !== "TERMINEE" || d.paiement_statut !== "AUTORISE" || !d.paiement_intent) return reponse({ statut: d.paiement_statut });
      await stripe(`payment_intents/${d.paiement_intent}/capture`, {});
      await maj({ paiement_statut: "ENCAISSE" });
      return reponse({ statut: "ENCAISSE" });
    }
    if (action === "annuler") {
      if (d.statut !== "ANNULEE" || d.paiement_statut !== "AUTORISE" || !d.paiement_intent) return reponse({ statut: d.paiement_statut });
      await stripe(`payment_intents/${d.paiement_intent}/cancel`, {});
      await maj({ paiement_statut: "ANNULE" });
      return reponse({ statut: "ANNULE" });
    }
    return reponse({ erreur: "action" }, 400);
  } catch (e) {
    return reponse({ erreur: "service", detail: String((e as Error).message ?? e) }, 500);
  }
});
