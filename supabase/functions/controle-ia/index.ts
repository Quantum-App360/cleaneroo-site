// Contrôle de fin de mission par IA. Depuis le 9 novembre 2026 : la photo « après » suffit (l'IA vérifie que la pièce est propre et
// que les tâches cochées se voient) ; si la réservation exige les photos avant, l'IA compare « avant » et « après ».
// Depuis le 18 novembre 2026 : si le client a déposé une PHOTO TÉMOIN de la pièce (état attendu, fiche du logement), l'IA s'en sert de
// référence (objets attendus en place : tapis de bain, serviettes, coussins…). En cas d'écart volontaire, le Cleaneur valide avec un commentaire.
// Appelée par le Cleaneur de la mission (site et appli) après la photo « après ».
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
    meme_piece: { type: "boolean", description: "Avec deux photos : montrent-elles la même pièce sous un angle comparable ? Avec une seule photo : la photo est-elle exploitable et montre-t-elle bien la pièce indiquée ?" },
    verdict: { type: "string", enum: ["ok", "ecart"] },
    ecarts: { type: "array", items: ecart },
    resume_fr: { type: "string" }, resume_en: { type: "string" }, resume_it: { type: "string" }, resume_es: { type: "string" },
  },
};

const COMMUN = `Sois juste : ne signale pas l'usure, les rayures, les défauts permanents (joints noircis anciens, peinture abîmée) ni ce que la photo ne permet pas de voir.
verdict « ok » seulement si aucun écart de gravité moyenne ou forte ; un écart faible peut rester « ok » s'il est mineur.
Rédige chaque problème et le résumé en français, anglais, italien et espagnol : phrases courtes, concrètes, polies, adressées au Cleaneur.`;
const TEMOIN = `Une PHOTO TÉMOIN prise par le client montre aussi l'état attendu de la pièce une fois le ménage fait : agencement et objets qui doivent être en place
(tapis de bain, serviettes, coussins, plaids, poubelle, papier toilette, objets de décoration). Signale un objet attendu absent ou nettement mal placé
quand c'est visible (zone + problème), en gravité « moyenne ». Ne tiens compte ni de la lumière, ni de l'angle, ni des affaires personnelles des voyageurs,
ni des petites différences de position sans importance.`;
const SYSTEME_DEUX = `Tu contrôles la qualité d'un ménage professionnel pour Cleaneroo.
On te donne deux photos de la même pièce : AVANT le ménage, puis APRÈS, et la liste des tâches demandées pour cette pièce.
Compare-les et repère uniquement les écarts de propreté visibles sur la photo APRÈS qui relèvent des tâches demandées :
taches, traces, poussière, déchets, vaisselle sale, sol non fait, lit non fait ou mal fait, sanitaires sales, objets laissés en désordre.
Si un défaut était déjà là AVANT et relève d'une tâche demandée, signale-le s'il est toujours là APRÈS.
Si les deux photos ne montrent pas la même pièce (ou si la photo APRÈS est floue, trop sombre ou inutilisable), mets meme_piece à false et verdict « ecart ».
${COMMUN}`;
const SYSTEME_UNE = `Tu contrôles la qualité d'un ménage professionnel pour Cleaneroo.
On te donne la photo d'une pièce prise APRÈS le ménage et la liste des tâches cochées par le Cleaneur pour cette pièce.
Vérifie que la pièce paraît propre et rangée et que le résultat des tâches cochées est visible quand la photo permet d'en juger :
taches, traces, poussière, déchets, vaisselle sale, sol non fait, lit non fait ou mal fait, sanitaires sales, objets laissés en désordre.
Ne reproche pas une tâche dont le résultat ne peut pas se voir sur la photo.
Si la photo est floue, trop sombre, inutilisable ou ne montre pas la pièce indiquée, mets meme_piece à false et verdict « ecart ».
${COMMUN}`;

async function image(chemin: string, compartiment = "photos-controles") {
  const { data, error } = await service.storage.from(compartiment).download(chemin);
  if (error || !data) throw new Error("photo");
  const type = ["image/jpeg", "image/png", "image/webp"].includes(data.type) ? data.type : "image/jpeg";
  return { type: "image" as const, source: { type: "base64" as const, media_type: type as "image/jpeg", data: encodeBase64(new Uint8Array(await data.arrayBuffer())) } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let reference = "", piece = "";
  try {
    ({ reference, piece } = await req.json());
    const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await service.auth.getUser(jeton);
    if (!u?.user) return rep({ erreur: "connexion" }, 401);
    const { data: d } = await service.from("demandes").select("statut, cleaneur_id, rubrique_id, details, client_id").eq("reference", reference).maybeSingle();
    const { data: prof } = await service.from("profils").select("role").eq("id", u.user.id).maybeSingle();
    if (!d) return rep({ erreur: "introuvable" }, 404);
    if (d.cleaneur_id !== u.user.id && prof?.role !== "admin") return rep({ erreur: "interdit" }, 403);
    if (!["SUR_PLACE", "EN_COURS"].includes(d.statut)) return rep({ erreur: "etape" }, 409);
    const { data: c } = await service.from("controles_pieces").select("*").eq("reference", reference).eq("piece_id", piece).maybeSingle();
    if (!c) return rep({ erreur: "introuvable" }, 404);
    const avantExigee = !!d.details?.photosAvantExigees;
    if (!c.photo_apres || (avantExigee && !c.photo_avant)) return rep({ erreur: "photos" }, 409);

    const enregistrer = (statut: string, resultat: unknown) =>
      service.from("controles_pieces").update({ ia_statut: statut, ia_resultat: resultat, maj_le: new Date().toISOString() }).eq("id", c.id);

    if (!Deno.env.get("ANTHROPIC_API_KEY")) { await enregistrer("erreur", { raison: "indisponible" }); return rep({ statut: "erreur", raison: "indisponible" }); }
    await enregistrer("en_cours", null);

    // Photo témoin du client pour cette pièce (fiche du logement), si elle existe.
    let temoin = null;
    const logementId = d.details?.logementId;
    if (logementId && d.client_id) {
      const { data: bien } = await service.from("biens").select("donnees").eq("id", logementId).eq("client_id", d.client_id).maybeSingle();
      const chemin = bien?.donnees?.temoins?.[c.piece_id];
      if (chemin) { try { temoin = await image(chemin, "photos-temoins"); } catch { temoin = null; } }
    }

    const avecAvant = !!c.photo_avant;
    const apres = await image(c.photo_apres);
    const taches = (c.taches || []).map((t: { nom: string }) => `- ${t.nom}`).join("\n") || "- Ménage complet de la pièce";
    const debut = temoin ? [{ type: "text", text: "PHOTO TÉMOIN (état attendu par le client) :" }, temoin] : [];
    const contenu = avecAvant
      ? [...debut, { type: "text", text: `Pièce : ${c.nom}\nTâches demandées :\n${taches}\n\nPhoto AVANT :` }, await image(c.photo_avant), { type: "text", text: "Photo APRÈS :" }, apres]
      : [...debut, { type: "text", text: `Pièce : ${c.nom}\nTâches cochées :\n${taches}\n\nPhoto APRÈS :` }, apres];
    const client = new Anthropic();
    const params = {
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: (avecAvant ? SYSTEME_DEUX : SYSTEME_UNE) + (temoin ? `\n${TEMOIN}` : ""),
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: contenu }],
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
    const resultat = { ...res, avec_photo_avant: avecAvant, avec_temoin: !!temoin, modele: r.model, le: new Date().toISOString() };
    await enregistrer(statut, resultat);
    return rep({ statut, resultat });
  } catch (e) {
    if (reference && piece) await service.from("controles_pieces").update({ ia_statut: "erreur", ia_resultat: { raison: "panne" } })
      .eq("reference", reference).eq("piece_id", piece);
    return rep({ statut: "erreur", raison: "panne", detail: String(e).slice(0, 200) }, 200);
  }
});
