// Fonction serveur « support » (20 novembre 2026) : à la création d'une demande au support (assistant Cleaneroo),
// envoie un e-mail à l'équipe (SUPPORT_EMAIL, par défaut contact@cleaneroo.fr) et un accusé de réception au demandeur.
// Envoi par Resend si le secret RESEND_API_KEY est configuré ; sinon la demande reste visible dans l'espace de gestion (onglet Support).
// Sécurité : seule une demande créée il y a moins de 15 minutes et pas encore envoyée peut déclencher un e-mail (une seule fois).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITES = ["https://cleaneroo.fr", "https://www.cleaneroo.fr", "https://quantum-app360.github.io", "http://localhost:8123"];
const entetes = (o: string) => ({ "Access-Control-Allow-Origin": SITES.includes(o) ? o : SITES[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function envoyer(cle: string, de: string, a: string, sujet: string, html: string, repondreA?: string) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [a], subject: sujet, html, ...(repondreA ? { reply_to: repondreA } : {}) }) });
  return r.ok;
}

Deno.serve(async req => {
  const h = entetes(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const rep = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: h });
  try {
    const { numero } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: d } = await admin.from("demandes_support").select("*").eq("numero", String(numero ?? "")).maybeSingle();
    if (!d) return rep({ erreur: "introuvable" }, 404);
    if (d.email_envoye_le || Date.now() - new Date(d.cree_le).getTime() > 15 * 60000) return rep({ statut: "deja" });
    const cle = Deno.env.get("RESEND_API_KEY");
    if (!cle) return rep({ statut: "sans_email" });
    const equipe = Deno.env.get("SUPPORT_EMAIL") || "contact@cleaneroo.fr";
    const de = Deno.env.get("SUPPORT_EXPEDITEUR") || "Cleaneroo Support <support@cleaneroo.fr>";
    const echeance = new Date(d.echeance).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
    const conv = (d.conversation || []).map((m: { de: string; texte?: string; sujet?: string }) => `<li><b>${m.de === "client" ? "Client" : "Assistant"}</b> : ${esc(m.texte || m.sujet || "")}</li>`).join("");
    await envoyer(cle, de, equipe, `[${d.numero}] ${d.categorie} — à valider avant le ${echeance}`,
      `<p><b>Demande à valider</b> · ${esc(d.numero)} · réponse attendue avant le <b>${esc(echeance)}</b></p>
       <p>De : ${esc(d.prenom || "")} &lt;${esc(d.email)}&gt; · espace ${esc(d.espace || "")}${d.reference ? ` · prestation ${esc(d.reference)}` : ""}</p>
       <p style="white-space:pre-wrap;background:#f3f7f7;padding:10px;border-radius:8px">${esc(d.resume)}</p>
       <p>Conversation avec l'assistant :</p><ul>${conv}</ul>
       <p>Répondez depuis l'espace de gestion › Support (la réponse est notifiée au client), ou directement à cet e-mail.</p>`, d.email);
    await envoyer(cle, de, d.email, `Votre demande ${d.numero} est bien reçue`,
      `<p>Bonjour ${esc(d.prenom || "")},</p><p>Nous avons bien reçu votre demande <b>${esc(d.numero)}</b>. L'équipe Cleaneroo vous répond <b>sous 48 h</b> (avant le ${esc(echeance)}), par e-mail et dans vos notifications.</p>
       <p style="white-space:pre-wrap;background:#f3f7f7;padding:10px;border-radius:8px">${esc(d.resume)}</p><p>À très vite,<br>L'équipe Cleaneroo</p>`);
    await admin.from("demandes_support").update({ email_envoye_le: new Date().toISOString() }).eq("id", d.id);
    return rep({ statut: "envoye" });
  } catch (e) {
    return rep({ erreur: "service", detail: String((e as Error).message ?? e) }, 500);
  }
});
