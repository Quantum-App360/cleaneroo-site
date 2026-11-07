// Contrôle de fin de mission par IA (7 novembre 2026) : compare la photo « avant » et la photo « après » d'une pièce
// et signale les écarts de nettoyage. Appelée par le Cleaneur de la mission (site et appli) après la photo « après ».
// Résultat enregistré dans controles_pieces (ia_statut : ok / ecart / erreur ; ia_resultat : écarts en 4 langues).
// Secret requis : ANTHROPIC_API_KEY (Supabase › Edge Functions › Secrets). Sans clé : statut « erreur », le Cleaneur justifie.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const rep = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const service = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const ecart = {
  type: "object", additionalProperties: false,
  required: ["zone", "probleme_fr", "probleme_en", "probleme_it", "probleme_es", "gravite"],
  properties: {
    zone: { type: "string", description: "Endroit précis dans la pièce (ex. « évier », « sol près du lit »), en français." },
    probleme_fr: { type: "string" }, probleme_en: { type: "string" }, probleme_it: { type: "string" }, probleme_es: { type: "string" },
    gravite: { type: "string", enum: ["faible", "moyenne", "forte"] },
  },
};
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["meme_piece", "verdict", "ecarts", "resume_fr", "resume_en", "resume_it", "resume_es"],
  properties: {
    meme_piece: { type: "boolean", description: "Les deux photos montrent-elles la même pièce, sous un angle comparable ?" },
    verdict: { type: "string", enum: ["ok", "ecart"] },
    ecarts: { type: "array", items: ecart },
    resume_fr: { type: "string" }, resume_en: { type: "string" }, resume_it: { type: "string" }, resume_es: { type: "string" },
  },
};

const SYSTEME = `Tu contrôles la qualité d'un ménage professionnel pour Cleaneroo.
On te donne deux photos de la même pièce : AVANT le ménage, puis APRÈS, et la liste des tâches demandées pour cette pièce.
Compare-les et repère uniquement les écarts de propreté visibles sur la photo APRÈS qui relèvent des tâches demandées :
taches, traces, poussière, déchets, vaisselle sale, sol non fait, lit non fait ou mal fait, sanitaires sales, objets laissés en désordre.
Sois juste : ne signale pas l'usure, les rayures, les défauts permanents (joints noircis anciens, peinture abîmée) ni ce que la photo ne permet pas de voir.
Si un défaut était déjà là AVANT et relève d'une tâche demandée, signale-le s'il est toujours là APRÈS.
Si les deux photos ne montrent pas la même pièce (ou si la photo APRÈS est floue, trop sombre ou inutilisable), mets meme_piece à false et verdict « ecart ».
verdict « ok » seulement si aucun écart de gravité moyenne ou forte ; un écart faible peut rester « ok » s'il est mineur.
Rédige chaque problème et le résumé en français, anglais, italien et espagnol : phrases courtes, concrètes, polies, adressées au Cleaneur.`;

async function image(chemin: string) {
  const { data, error } = await service.storage.from("photos-controles").download(chemin);
  if (error || !data) throw new Error("photo");
  const type = ["image/jpeg", "image/png", "image/webp"].includes(data.type) ? data.type : "image/jpeg";
  return { type: "image" as const, source: { type: "base64" as const, media_type: type as "image/jpeg", data: encodeBase64(new Uint8Array(await data.arrayBuffer())) } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let reference = "", piece = "";
  try {
    ({ reference, piece } = await req.json());
    // Qui appelle : le Cleaneur affecté à la mission (ou l'administration), pendant le ménage.
    const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await service.auth.getUser(jeton);
    if (!u?.user) return rep({ erreur: "connexion" }, 401);
    const { data: d } = await service.from("demandes").select("statut, cleaneur_id, rubrique_id").eq("reference", reference).maybeSingle();
    const { data: prof } = await service.from("profils").select("role").eq("id", u.user.id).maybeSingle();
    if (!d) return rep({ erreur: "introuvable" }, 404);
    if (d.cleaneur_id !== u.user.id && prof?.role !== "admin") return rep({ erreur: "interdit" }, 403);
    if (!["SUR_PLACE", "EN_COURS"].includes(d.statut)) return rep({ erreur: "etape" }, 409);
    const { data: c } = await service.from("controles_pieces").select("*").eq("reference", reference).eq("piece_id", piece).maybeSingle();
    if (!c) return rep({ erreur: "introuvable" }, 404);
    if (!c.photo_avant || !c.photo_apres) return rep({ erreur: "photos" }, 409);

    const enregistrer = (statut: string, resultat: unknown) =>
      service.from("controles_pieces").update({ ia_statut: statut, ia_resultat: resultat, maj_le: new Date().toISOString() }).eq("id", c.id);

    if (!Deno.env.get("ANTHROPIC_API_KEY")) { await enregistrer("erreur", { raison: "indisponible" }); return rep({ statut: "erreur", raison: "indisponible" }); }
    await enregistrer("en_cours", null);

    const [avant, apres] = await Promise.all([image(c.photo_avant), image(c.photo_apres)]);
    const taches = (c.taches || []).map((t: { nom: string }) => `- ${t.nom}`).join("\n") || "- Ménage complet de la pièce";
    const client = new Anthropic();
    // Refus éventuel du modèle : repris automatiquement par le modèle de secours conseillé (fallbacks « default »).
    const params = {
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEME,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [
        { type: "text", text: `Pièce : ${c.nom}\nTâches demandées :\n${taches}\n\nPhoto AVANT :` },
        avant,
        { type: "text", text: "Photo APRÈS :" },
        apres,
      ] }],
    };
    // deno-lint-ignore no-explicit-any
    const r = await client.beta.messages.create(params as any);
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") {
      await enregistrer("erreur", { raison: r.stop_reason });
      return rep({ statut: "erreur", raison: r.stop_reason });
    }
    const texte = r.content.find((b) => b.type === "text");
    const res = JSON.parse(texte && texte.type === "text" ? texte.text : "{}");
    if (!res.meme_piece) res.verdict = "ecart";
    const statut = res.verdict === "ok" ? "ok" : "ecart";
    const resultat = { ...res, modele: r.model, le: new Date().toISOString() };
    await enregistrer(statut, resultat);
    return rep({ statut, resultat });
  } catch (e) {
    // Panne (photo illisible, IA indisponible) : le Cleaneur peut justifier ; jamais bloqué par une panne.
    if (reference && piece) await service.from("controles_pieces").update({ ia_statut: "erreur", ia_resultat: { raison: "panne" } })
      .eq("reference", reference).eq("piece_id", piece);
    return rep({ statut: "erreur", raison: "panne", detail: String(e).slice(0, 200) }, 200);
  }
});
