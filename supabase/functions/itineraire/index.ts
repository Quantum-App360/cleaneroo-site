// Itinéraire routier (lot 9 du prompt 4, 25/11/2026, choix de Michael : OpenRouteService). Fonction serveur « itineraire » :
// le navigateur n'appelle plus directement un service externe et la clé reste cachée ici (secret ORS_CLE).
// Tant que la clé n'est pas enregistrée, repli temporaire sur le serveur de démonstration OSRM (non autorisé pour un usage commercial :
// à ne pas garder après le lancement). Entrée : { a: { lat, lon }, b: { lat, lon } } ; sortie : { points: [[lat, lon]…], km, min, source }.
// Garde-fous : coordonnées en France (métropole et Corse), trajet de 300 km au plus, 120 demandes par minute et par adresse IP.
const SITES = ["https://cleaneroo.fr", "https://www.cleaneroo.fr", "https://quantum-app360.github.io", "http://localhost:8123", "http://localhost:8765"];
const entetes = (origine: string) => ({
  "Access-Control-Allow-Origin": SITES.includes(origine) ? origine : SITES[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});
type P = { lat: number; lon: number };
const valide = (p: P) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat > 41 && p.lat < 51.5 && p.lon > -5.5 && p.lon < 10;
const km = (a: P, b: P) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
const compteur = new Map<string, { n: number; t: number }>();

async function ors(a: P, b: P, cle: string) {
  const r = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?start=${a.lon},${a.lat}&end=${b.lon},${b.lat}`,
    { headers: { Authorization: cle, Accept: "application/geo+json" }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const f = (await r.json()).features?.[0];
  if (!f) return null;
  return { points: f.geometry.coordinates.map(([lon, lat]: number[]) => [lat, lon]), km: f.properties.summary.distance / 1000,
    min: Math.max(1, Math.round(f.properties.summary.duration / 60)), source: "ors" };
}
async function osrm(a: P, b: P) {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`,
    { signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const route = (await r.json()).routes?.[0];
  if (!route) return null;
  return { points: route.geometry.coordinates.map(([lon, lat]: number[]) => [lat, lon]), km: route.distance / 1000,
    min: Math.max(1, Math.round(route.duration / 60)), source: "osrm-demo" };
}

Deno.serve(async (req) => {
  const h = entetes(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ erreur: "methode" }), { status: 405, headers: h });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  const now = Date.now(), c = compteur.get(ip);
  if (c && now - c.t < 60000) { if (++c.n > 120) return new Response(JSON.stringify({ erreur: "trop" }), { status: 429, headers: h }); }
  else compteur.set(ip, { n: 1, t: now });
  if (compteur.size > 5000) compteur.clear();
  let corps: { a?: P; b?: P };
  try { corps = await req.json(); } catch { return new Response(JSON.stringify({ erreur: "corps" }), { status: 400, headers: h }); }
  const a = { lat: Number(corps.a?.lat), lon: Number(corps.a?.lon) }, b = { lat: Number(corps.b?.lat), lon: Number(corps.b?.lon) };
  if (!valide(a) || !valide(b) || km(a, b) > 300) return new Response(JSON.stringify({ erreur: "coordonnees" }), { status: 400, headers: h });
  const cle = Deno.env.get("ORS_CLE");
  try {
    const r = (cle ? await ors(a, b, cle).catch(() => null) : null) ?? await osrm(a, b).catch(() => null);
    if (r) return new Response(JSON.stringify(r), { headers: { ...h, "Cache-Control": "private, max-age=600" } });
  } catch { /* service indisponible */ }
  return new Response(JSON.stringify({ erreur: "indisponible" }), { status: 503, headers: h });
});
