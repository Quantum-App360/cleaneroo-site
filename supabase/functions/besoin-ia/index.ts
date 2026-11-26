// Cleaneroo AI, « Décrire mon besoin » (26/11/2026) : le client décrit son besoin (texte et jusqu'à 4 photos), l'IA joue l'expert
// du nettoyage et renvoie une PROPOSITION STRUCTURÉE faite uniquement d'identifiants du catalogue réel et de la base de connaissances
// (table connaissances_ia). Le catalogue est lu sur le site publié (assets/catalogue-ia.json, exporté d'assets/js/catalogue.js par
// outils/generer_catalogue_ia.mjs à chaque génération des pages) : l'IA travaille toujours avec le catalogue en ligne.
// L'IA ne donne JAMAIS de prix : le site calcule le prix avec son moteur (estimation.js), et le serveur de paiement le revérifie.
// Garde-fous : schéma de réponse imposé, identifiants revérifiés ici (un identifiant inconnu est retiré et noté dans analyses_ia),
// objet hors catalogue ou moisissures → validation humaine, limite d'usage par visiteur, photos jamais conservées par cette fonction.
// Secret requis : ANTHROPIC_API_KEY (déjà utilisé par controle-ia). Sans clé : { etat: "indisponible" }.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITES = ["https://cleaneroo.fr", "https://www.cleaneroo.fr", "https://quantum-app360.github.io", "http://localhost:8123", "http://localhost:8765"];
const entetes = (o: string) => ({ "Access-Control-Allow-Origin": SITES.includes(o) ? o : SITES[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Limites d'usage par visiteur (empreinte de l'adresse IP) : chaque analyse a un coût. */
const PAR_HEURE = 20, PAR_JOUR = 60, PHOTOS_MAX = 4, TAILLE_PHOTO_MAX = 2_200_000, TEXTE_MAX = 4000, ECHANGES_MAX = 16;
const LANGUES: Record<string, string> = { fr: "français", en: "anglais", it: "italien", es: "espagnol" };

type Rubrique = { id: string; nom: string; sousTitre: string; inclus: string; nonInclus: string; toujoursSurDevis: boolean;
  formules: { id: string; nom: string; description: string }[]; typesLieu: { id: string; nom: string }[];
  taches: { id: string; nom: string; groupe: string; types: string[] }[]; packs: { id: string; nom: string; tacheIds: string[] }[] };
type Element = { id: string; nom: string; formuleId: string; avecTaille: boolean; parM2: boolean };
let RUB = new Map<string, Rubrique>(), ELEMENTS = new Map<string, Element>(), TAILLES: { id: string; libelle: string }[] = [], chargeLe = 0;
/** Catalogue publié, relu toutes les 10 minutes (gardé en mémoire si le site ne répond pas). */
async function chargerCatalogue() {
  if (RUB.size && Date.now() - chargeLe < 600e3) return;
  try {
    const r = await fetch(`https://cleaneroo.fr/assets/catalogue-ia.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(String(r.status));
    const c = await r.json();
    RUB = new Map((c.rubriques as Rubrique[]).map(x => [x.id, x]));
    ELEMENTS = new Map((c.elementsTextiles as Element[]).map(e => [e.id, e]));
    TAILLES = c.taillesCanape; chargeLe = Date.now();
  } catch (e) { if (!RUB.size) throw e; }
}

/** Catalogue en texte, pour l'IA : identifiants et noms seulement. */
function catalogueTexte() {
  const r = [...RUB.values()].map(x => [
    `## ${x.id} — ${x.nom} (${x.sousTitre})${x.toujoursSurDevis ? " [toujours sur devis]" : ""}`,
    x.inclus ? `Inclus : ${x.inclus}` : "", x.nonInclus ? `Non inclus : ${x.nonInclus}` : "",
    x.formules.length ? `Formules : ${x.formules.map(f => `${f.id} (${f.nom})`).join(", ")}` : "",
    x.typesLieu.length ? `Types : ${x.typesLieu.map(t => `${t.id} (${t.nom})`).join(", ")}` : "",
    x.taches.length ? `Options : ${x.taches.map(t => `${t.id} (${t.nom}${t.types.length ? ` ; seulement pour ${t.types.join("/")}` : ""})`).join(", ")}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
  const e = [...ELEMENTS.values()].map(x => `${x.id} (${x.nom}${x.avecTaille ? ", taille à préciser" : ""}${x.parM2 ? ", en m²" : ""})`).join(", ");
  return `${r}\n\n## Éléments de « textiles » (canapés, matelas, tapis…) : ${e}\nTailles de canapé : ${TAILLES.map(t => `${t.id} (${t.libelle})`).join(", ")}`;
}

function connaissancesTexte(k: { id: string; type: string; donnees: Record<string, unknown> }[]) {
  const par = (t: string) => k.filter(x => x.type === t).map(x => x.donnees);
  return [
    "## Règles", ...par("regle").map(d => `- ${d.texte}`),
    "## Objets connus (id → prestation)", ...par("objet").map(d => `- ${d.id} : ${d.nom}${d.hors_catalogue ? ` → HORS CATALOGUE (${d.raison}) : validation humaine` : ` → ${d.rubrique}${(d.elements as string[] | undefined)?.length ? ` éléments ${(d.elements as string[]).join("/")}` : ""}${(d.taches as string[] | undefined)?.length ? ` options ${(d.taches as string[]).join("/")}` : ""}${d.typeLieu ? ` type ${d.typeLieu}` : ""}`}${(d.questions as string[] | undefined)?.length ? ` ; à savoir : ${(d.questions as string[]).join(" ; ")}` : ""}`),
    "## Matières", ...par("matiere").map(d => `- ${d.id} (${d.nom}) : eau ${d.eau} ; ${d.note}`),
    "## Étiquettes d'entretien", ...par("code_etiquette").map(d => `- ${d.code} : ${d.sens}`),
    "## Salissures (id → options conseillées par prestation ; résultat à annoncer)", ...par("salissure").map(d => `- ${d.id} (${d.nom})${d.validation_humaine ? " → VALIDATION HUMAINE" : ""} : ${JSON.stringify(d.taches || {})} ; ${JSON.stringify(d.resultat || {})}`),
  ].join("\n");
}

/** Schéma de la réponse : les identifiants sont limités aux valeurs du catalogue. */
function schema() {
  const rubs = [...RUB.keys()];
  const taches = [...new Set([...RUB.values()].flatMap(r => r.taches.map(t => t.id)))];
  const formules = ["", ...new Set([...RUB.values()].flatMap(r => r.formules.map(f => f.id)))];
  const lieux = ["", ...new Set([...RUB.values()].flatMap(r => r.typesLieu.map(t => t.id)))];
  const s = (d = "") => ({ type: "string", ...(d ? { description: d } : {}) });
  return {
    type: "object", additionalProperties: false,
    required: ["etat", "message", "questions", "objets", "raison_validation_humaine"],
    properties: {
      etat: { type: "string", enum: ["questions", "fiche", "validation_humaine"] },
      message: s("Réponse courte au client, dans sa langue, vouvoiement, sans emoji."),
      questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "texte", "choix"],
        properties: { id: s(), texte: s(), choix: { type: "array", items: { type: "string" } } } } },
      objets: { type: "array", items: { type: "object", additionalProperties: false,
        required: ["objet_id", "libelle", "rubrique_id", "matiere", "matiere_source", "salissures", "vu_sur_photo", "confirme_par_client", "formule_id", "type_lieu_id", "elements", "champs", "options", "resultat", "confiance"],
        properties: {
          objet_id: s("id d'objet connu, ou « autre »"), libelle: s("ex. « Canapé d'angle en tissu gris »"),
          rubrique_id: { type: "string", enum: rubs },
          matiere: s("id de matière connue, ou « inconnue »"), matiere_source: { type: "string", enum: ["photo", "client", "inconnue"] },
          salissures: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "source"], properties: { id: s(), source: { type: "string", enum: ["photo", "client"] } } } },
          vu_sur_photo: { type: "array", items: s() }, confirme_par_client: { type: "array", items: s() },
          formule_id: { type: "string", enum: formules }, type_lieu_id: { type: "string", enum: lieux },
          elements: { type: "array", items: { type: "object", additionalProperties: false, required: ["element_id", "quantite", "taille_id", "surface_m2"],
            properties: { element_id: { type: "string", enum: ["", ...ELEMENTS.keys()] }, quantite: { type: "integer" }, taille_id: { type: "string", enum: ["", ...TAILLES.map(t => t.id)] }, surface_m2: { type: "number" } } } },
          champs: { type: "object", additionalProperties: false, required: ["surface", "chambres", "sdb", "fenetres", "nombre_vehicules"],
            properties: { surface: { type: "number" }, chambres: { type: "integer" }, sdb: { type: "integer" }, fenetres: { type: "integer" }, nombre_vehicules: { type: "integer" } } },
          options: { type: "array", items: { type: "object", additionalProperties: false, required: ["tache_id", "niveau", "raison"],
            properties: { tache_id: { type: "string", enum: taches }, niveau: { type: "string", enum: ["obligatoire", "recommandee", "facultative"] }, raison: s("Pourquoi, en une phrase, dans la langue du client.") } } },
          resultat: { type: "object", additionalProperties: false, required: ["probable", "attenue", "limite"], properties: { probable: s(), attenue: s(), limite: s() } },
          confiance: { type: "string", enum: ["haute", "moyenne", "faible"] },
        } } },
      raison_validation_humaine: s(),
    },
  };
}

const SYSTEME = (langue: string, base: string) => `Tu es Cleaneroo AI, expert du nettoyage pour la plateforme Cleaneroo (mise en relation avec des Cleaneurs indépendants).
Le client décrit son besoin, parfois avec des photos. Tu prépares une proposition de réservation EXCLUSIVEMENT avec les identifiants du catalogue ci-dessous.
Tu ne donnes JAMAIS de prix ni de durée : le site les calcule. Tu n'inventes jamais une prestation, une option, une matière ou une tache.

Méthode :
1. Identifie chaque objet ou surface à nettoyer, sa matière, ses salissures et son état. Distingue ce que tu VOIS sur une photo (vu_sur_photo) de ce que le client a DIT (confirme_par_client).
2. Choisis la prestation (rubrique_id) qui correspond précisément à l'OBJET, pas seulement à la matière (un siège de voiture en tissu n'est pas un canapé).
3. Il manque une information nécessaire au calcul (taille, nombre, surface, type de véhicule…) ou à la sécurité (matière incertaine sensible à l'eau) : etat « questions », 1 à 3 questions courtes avec des choix quand c'est possible. Ne repose jamais une question déjà répondue. Si la demande est assez précise, n'en pose aucune.
4. Tout est clair : etat « fiche ». Remplis elements (textiles), champs (logement : surface, chambres, sdb ; vitres : fenetres ; véhicules : nombre_vehicules ; 0 si sans objet), formule_id et type_lieu_id quand la prestation en a.
5. Options : uniquement des tache_id de la prestation choisie. « obligatoire » seulement pour une raison de sécurité ou de faisabilité ; « recommandee » si le diagnostic la justifie ; « facultative » sinon. Chaque option a sa raison.
6. resultat : ce qui partira probablement, ce qui sera atténué, ce qui peut rester. Jamais de garantie de disparition.
7. Objet hors catalogue, moisissures, matière interdisant tout traitement proposé, ou doute sérieux : etat « validation_humaine » avec la raison ; l'équipe Cleaneroo reprend la demande.
8. Plusieurs besoins dans un même message : un objet par besoin.
Réponds au client en ${langue}, vouvoiement, phrases courtes, ton professionnel et chaleureux, sans emoji, sans formule commerciale.

# Catalogue Cleaneroo
${catalogueTexte()}

# Base de connaissances Cleaneroo
${base}`;

type Objet = { rubrique_id: string; formule_id: string; type_lieu_id: string; objet_id: string;
  elements: { element_id: string; quantite: number; taille_id: string; surface_m2: number }[]; options: { tache_id: string; niveau: string; raison: string }[];
  salissures: { id: string }[] };

/** Revérifie chaque identifiant contre le catalogue : un identifiant inconnu ou hors prestation est retiré et noté. */
export function nettoyer(rep: { etat: string; objets: Objet[]; raison_validation_humaine: string }, objetsHors: Set<string>, salissuresHumaines: Set<string>) {
  const ecartes: string[] = [];
  for (const o of rep.objets) {
    const r = RUB.get(o.rubrique_id);
    if (!r) { ecartes.push(`rubrique:${o.rubrique_id}`); continue; }
    if (o.formule_id && !r.formules.some(f => f.id === o.formule_id)) { ecartes.push(`formule:${o.rubrique_id}:${o.formule_id}`); o.formule_id = r.formules[0]?.id || ""; }
    if (o.type_lieu_id && !r.typesLieu.some(t => t.id === o.type_lieu_id)) { ecartes.push(`type:${o.rubrique_id}:${o.type_lieu_id}`); o.type_lieu_id = ""; }
    o.options = o.options.filter(x => {
      const t = r.taches.find(t => t.id === x.tache_id);
      const ok = !!t && (!t.types.length || !o.type_lieu_id || t.types.includes(o.type_lieu_id));
      if (!ok) ecartes.push(`option:${o.rubrique_id}:${x.tache_id}`);
      return ok;
    });
    o.elements = o.rubrique_id !== "textiles" ? [] : o.elements.filter(e => {
      const el = ELEMENTS.get(e.element_id), ok = !!el;
      if (!ok) ecartes.push(`element:${e.element_id}`);
      if (el && !el.avecTaille) e.taille_id = "";
      e.quantite = Math.min(20, Math.max(1, Math.round(e.quantite || 1)));
      return ok;
    });
    if (objetsHors.has(o.objet_id) || o.salissures.some(s => salissuresHumaines.has(s.id))) {
      rep.etat = "validation_humaine";
      rep.raison_validation_humaine ||= "Cette demande demande l'avis de notre équipe avant une proposition.";
    }
  }
  // Une fiche sans aucun objet valable n'est pas une fiche.
  rep.objets = rep.objets.filter(o => RUB.has(o.rubrique_id));
  if (rep.etat === "fiche" && !rep.objets.length) { rep.etat = "validation_humaine"; rep.raison_validation_humaine ||= "Aucune prestation du catalogue ne correspond avec certitude."; }
  return ecartes;
}

async function empreinte(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(-16)}`));
  return [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const h = entetes(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const rep = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: h });
  let analyse: Record<string, unknown> = {};
  try {
    const corps = await req.json().catch(() => ({}));
    const langue = LANGUES[corps.langue] ? corps.langue : "fr";
    const conversation = (Array.isArray(corps.conversation) ? corps.conversation : []).slice(-ECHANGES_MAX)
      .map((m: { role: string; texte: string }) => ({ role: m.role === "assistant" ? "assistant" : "user", texte: String(m.texte || "").slice(0, TEXTE_MAX) }))
      .filter((m: { texte: string }) => m.texte.trim());
    const photos = (Array.isArray(corps.photos) ? corps.photos : []).slice(0, PHOTOS_MAX).map((p: unknown) => String(p || ""))
      .filter((p: string) => /^[A-Za-z0-9+/=]+$/.test(p) && p.length <= TAILLE_PHOTO_MAX);
    if (!conversation.length || conversation[conversation.length - 1].role !== "user") return rep({ erreur: "vide" }, 400);
    if (photos.length && corps.consentement_photos !== true) return rep({ erreur: "consentement" }, 400);

    // Client connecté (facultatif) et limite d'usage.
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { data: u } = jwt ? await admin.auth.getUser(jwt).catch(() => ({ data: null })) : { data: null };
    const clientId = u?.user?.id ?? null;
    const emp = await empreinte(req);
    const depuis = (ms: number) => new Date(Date.now() - ms).toISOString();
    const [{ count: heure }, { count: jour }] = await Promise.all([
      admin.from("analyses_ia").select("id", { count: "exact", head: true }).eq("empreinte", emp).gte("cree_le", depuis(3600e3)),
      admin.from("analyses_ia").select("id", { count: "exact", head: true }).eq("empreinte", emp).gte("cree_le", depuis(86400e3)),
    ]);
    if ((heure ?? 0) >= PAR_HEURE || (jour ?? 0) >= PAR_JOUR) return rep({ erreur: "limite" }, 429);
    analyse = { client_id: clientId, empreinte: emp, langue, message: conversation.filter((m: { role: string }) => m.role === "user").map((m: { texte: string }) => m.texte).join("\n---\n").slice(0, 8000), nb_photos: photos.length };
    await chargerCatalogue();
    if (!Deno.env.get("ANTHROPIC_API_KEY")) { await admin.from("analyses_ia").insert({ ...analyse, etat: "erreur", reponse: { raison: "cle_absente" } }); return rep({ etat: "indisponible" }); }

    // Base de connaissances : toujours la version en vigueur.
    const { data: k } = await admin.from("connaissances_ia").select("id, type, donnees").eq("actif", true);
    const base = connaissancesTexte(k || []);
    const objetsHors = new Set((k || []).filter(x => x.type === "objet" && x.donnees?.hors_catalogue).map(x => String(x.donnees.id)));
    const salissuresHumaines = new Set((k || []).filter(x => x.type === "salissure" && x.donnees?.validation_humaine).map(x => String(x.donnees.id)));

    // Conversation : les photos accompagnent le premier message du client.
    const messages = conversation.map((m: { role: string; texte: string }, i: number) => ({ role: m.role,
      content: m.role === "user" && i === conversation.findIndex((x: { role: string }) => x.role === "user") && photos.length
        ? [...photos.map((p: string, j: number) => [{ type: "text", text: `Photo ${j + 1} :` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: p } }]).flat(), { type: "text", text: m.texte }]
        : m.texte }));
    const client = new Anthropic();
    const params = {
      model: "claude-opus-5-5", max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      system: SYSTEME(LANGUES[langue], base),
      output_config: { format: { type: "json_schema", schema: schema() } },
      messages,
    };
    // deno-lint-ignore no-explicit-any
    const r = await client.beta.messages.create(params as any);
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") {
      await admin.from("analyses_ia").insert({ ...analyse, etat: "erreur", reponse: { raison: r.stop_reason }, modele: r.model });
      return rep({ etat: "erreur" });
    }
    const texte = r.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
    const res = JSON.parse(texte?.text || "{}");
    const ecartes = nettoyer(res, objetsHors, salissuresHumaines);
    const { data: ligne } = await admin.from("analyses_ia").insert({ ...analyse, etat: res.etat, reponse: res, ecartes, modele: r.model }).select("id").single();
    return rep({ ...res, analyse_id: ligne?.id ?? null });
  } catch (e) {
    try { if (analyse.empreinte) await admin.from("analyses_ia").insert({ ...analyse, etat: "erreur", reponse: { raison: "panne", detail: String((e as Error).message).slice(0, 300) } }); } catch { /* rien */ }
    return rep({ etat: "erreur" }, 500);
  }
});
