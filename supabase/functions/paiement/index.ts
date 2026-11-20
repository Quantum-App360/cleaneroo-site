// Paiement Stripe d'une demande (site et application) — fonction serveur Supabase « paiement ».
// La clé secrète Stripe (STRIPE_SECRET_KEY, clé de test sk_test_… pour l'instant) est dans les secrets Supabase, jamais dans le code.
// Principe : à la réservation, le montant est seulement RÉSERVÉ (empreinte, capture manuelle) sur la page sécurisée Stripe
// (carte, Apple Pay, Google Pay, Link) ; il est ENCAISSÉ après la validation du client ; la réservation est LEVÉE si la demande est annulée.
// Actions : creer (→ adresse de la page de paiement), verifier (retour de Stripe), encaisser, annuler.
import { createClient } from "jsr:@supabase/supabase-js@2";
// Prix vérifié par le serveur (refonte du 20 novembre 2026) : les MÊMES fichiers que le site (assets/js/prix-serveur.js,
// figés sur un commit du dépôt), avec les tarifs publiés depuis l'espace de gestion. Après chaque changement des règles
// dans assets/js : pousser le site, remplacer le numéro de commit ci-dessous, puis redéployer cette fonction.
import { calculer, entreeEstimation, appliquerTarifs } from "https://esm.sh/gh/Quantum-App360/cleaneroo-site@d49a0f9/assets/js/prix-serveur.js?target=deno";

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

async function stripe(chemin: string, corps?: Record<string, string>) {
  const cle = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: corps ? new URLSearchParams(corps) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "stripe");
  return j;
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
    const { data: d } = await admin.from("demandes").select("*").eq("reference", String(reference ?? "")).maybeSingle();
    if (!d) return reponse({ erreur: "introuvable" }, 404);
    // Accès : le lien de suivi (jeton) ou le compte du client connecté.
    let autorise = !!jeton && d.jeton === jeton;
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!autorise && auth && d.client_id) {
      const { data: u } = await admin.auth.getUser(auth);
      autorise = u?.user?.id === d.client_id;
    }
    if (!autorise) return reponse({ erreur: "refuse" }, 403);
    const test = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_");
    const maj = (champs: Record<string, unknown>) => admin.from("demandes").update(champs).eq("id", d.id);

    if (action === "creer") {
      if (d.sur_devis) return reponse({ erreur: "sur_devis" }, 400);
      if (["ANNULEE", "TERMINEE"].includes(d.statut)) return reponse({ erreur: "statut" }, 400);
      if (["AUTORISE", "ENCAISSE"].includes(d.paiement_statut)) return reponse({ erreur: "deja_paye" }, 400);
      // Prix vérifié par le serveur : le prix enregistré par le navigateur doit être celui des règles (à 1 € près).
      const { data: t } = await admin.from("tarifs").select("version, donnees").eq("actif", true).order("version", { ascending: false }).limit(1).maybeSingle();
      appliquerTarifs(t?.donnees || {}, t?.version || 0);
      const { data: prof } = d.client_id ? await admin.from("profils").select("abonnement_pro").eq("id", d.client_id).maybeSingle() : { data: null };
      const abonne = !!prof?.abonnement_pro && prof.abonnement_pro !== "aucun";
      const verif = prixServeur(d, abonne);
      if (verif && !verif.normal.devisObligatoire) {
        const initial = d.estimation_initiale_c ?? d.estimation_c ?? 0;
        const proche = (x: number) => Math.abs(initial - x) <= 100;
        if (!proche(verif.normal.totalC) && !proche(verif.variante.totalC)) {
          if (d.estimation_initiale_c != null) return reponse({ erreur: "prix_a_verifier" }, 409);
          const fraisC = Math.round(verif.normal.totalC * verif.normal.fraisServicePct / 100);
          await maj({ estimation_c: verif.normal.totalC, credit_impot_c: verif.normal.creditImpotC,
            details: { ...d.details, fraisServiceC: fraisC, fraisServicePct: verif.normal.fraisServicePct, prixCorrigeLe: new Date().toISOString(), prixNavigateurC: initial } });
          return reponse({ erreur: "prix_corrige", estimation_c: verif.normal.totalC }, 409);
        }
      }
      // Frais de service recalculés (5 % particulier, 8 % pro, 0 % abonné), jamais repris tels quels du navigateur.
      const pct = d.espace === "personnel" ? 5 : abonne ? 0 : 8;
      const fraisServeurC = Math.round((d.estimation_c ?? 0) * (verif?.normal.fraisServicePct ?? pct) / 100);
      // Même total que l'écran : prestation + frais de service − remises (parrainage, cagnotte).
      const montant = (d.estimation_c ?? 0) + fraisServeurC - (d.remise_parrainage_c ?? 0) - (d.cagnotte_c ?? 0);
      if (montant < 50) return reponse({ erreur: "montant" }, 400);
      const base = SITES.includes(origine) ? origine : SITES[0];
      const retour = `${base}/?paiement={CHECKOUT_SESSION_ID}#/demande/${d.reference}/${d.jeton}`;
      const s = await stripe("checkout/sessions", {
        mode: "payment",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(montant),
        "line_items[0][price_data][product_data][name]": `Cleaneroo · réservation ${d.reference}`,
        "line_items[0][quantity]": "1",
        "payment_intent_data[capture_method]": "manual",
        "payment_intent_data[metadata][reference]": d.reference,
        "payment_intent_data[description]": `Cleaneroo ${d.reference}`,
        "metadata[reference]": d.reference,
        ...(d.email ? { customer_email: d.email } : {}),
        locale: "auto",
        success_url: retour,
        cancel_url: `${base}/#/demande/${d.reference}/${d.jeton}`,
      });
      await maj({ paiement_statut: "EN_ATTENTE", paiement_session: s.id, paiement_c: montant, paiement_test: test });
      return reponse({ url: s.url });
    }

    if (action === "verifier") {
      const id = String(session ?? d.paiement_session ?? "");
      if (!id || id !== d.paiement_session) return reponse({ statut: d.paiement_statut });
      const s = await stripe(`checkout/sessions/${id}?expand[]=payment_intent`);
      const pi = s.payment_intent;
      if (s.status === "complete" && pi && ["requires_capture", "succeeded"].includes(pi.status)) {
        const statut = pi.status === "succeeded" ? "ENCAISSE" : "AUTORISE";
        await maj({ paiement_statut: statut, paiement_intent: pi.id });
        return reponse({ statut });
      }
      return reponse({ statut: d.paiement_statut });
    }

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
