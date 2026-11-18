// Paiement Stripe d'une demande (site et application) — fonction serveur Supabase « paiement ».
// La clé secrète Stripe (STRIPE_SECRET_KEY, clé de test sk_test_… pour l'instant) est dans les secrets Supabase, jamais dans le code.
// Principe : à la réservation, le montant est seulement RÉSERVÉ (empreinte, capture manuelle) sur la page sécurisée Stripe
// (carte, Apple Pay, Google Pay, Link) ; il est ENCAISSÉ après la validation du client ; la réservation est LEVÉE si la demande est annulée.
// Actions : creer (→ adresse de la page de paiement), verifier (retour de Stripe), encaisser, annuler.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      // Même total que l'écran : prestation + frais de service − remises (parrainage, cagnotte).
      const montant = (d.estimation_c ?? 0) + (Number(d.details?.fraisServiceC) || 0) - (d.remise_parrainage_c ?? 0) - (d.cagnotte_c ?? 0);
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
