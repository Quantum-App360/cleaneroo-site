// Lit un calendrier iCal (Airbnb, Booking, Abritel/Vrbo, Google...) et renvoie les réservations en JSON.
// Réservé aux comptes connectés (JWT). Seuls des sites de location connus sont acceptés (pas de proxy ouvert).
// Audit du 24/11/2026 : les redirections ne sont plus suivies aveuglément ; chacune est revérifiée (https, site de la liste),
// pour qu'un lien d'un site accepté ne puisse pas renvoyer vers une adresse interne. 3 redirections au plus.
const HOTES = [/(^|\.)airbnb\.[a-z.]+$/, /(^|\.)booking\.com$/, /(^|\.)vrbo\.com$/, /(^|\.)abritel\.fr$/, /(^|\.)homeaway\.[a-z.]+$/,
  /(^|\.)google\.com$/, /(^|\.)outlook\.(com|live\.com|office365\.com)$/, /(^|\.)office365\.com$/, /(^|\.)icloud\.com$/,
  /(^|\.)lodgify\.com$/, /(^|\.)smoobu\.com$/, /(^|\.)beds24\.com$/, /(^|\.)hostaway\.com$/, /(^|\.)guesty\.com$/,
  /(^|\.)avantio\.com$/, /(^|\.)gites-de-france\.com$/, /(^|\.)leboncoin\.fr$/, /(^|\.)tripadvisor\.[a-z.]+$/, /(^|\.)expedia\.[a-z.]+$/];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const rep = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
const accepte = (u: URL) => u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && HOTES.some(r => r.test(u.hostname.toLowerCase()));

function date(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function lire(ics: string) {
  const lignes = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const evts: { debut: string; fin: string; titre: string; bloque: boolean }[] = [];
  let e: Record<string, string> | null = null;
  for (const l of lignes) {
    if (l === "BEGIN:VEVENT") e = {};
    else if (l === "END:VEVENT" && e) {
      const debut = date(e.DTSTART || ""), fin = date(e.DTEND || e.DTSTART || "");
      if (debut && fin) {
        const titre = (e.SUMMARY || "").replace(/\\([,;nN\\])/g, "$1").slice(0, 80);
        // Airbnb : « Not available » = dates bloquées par l'hôte, « Reserved » = vraie réservation.
        const bloque = /not available|indisponible|blocked|closed/i.test(titre);
        evts.push({ debut, fin, titre, bloque });
      }
      e = null;
    } else if (e) {
      const i = l.indexOf(":");
      if (i > 0) { const k = l.slice(0, i).split(";")[0].toUpperCase(); if (!(k in e)) e[k] = l.slice(i + 1); }
    }
  }
  const auj = new Date(); auj.setDate(auj.getDate() - 31);
  const limite = auj.toISOString().slice(0, 10);
  return evts.filter(x => x.fin >= limite).sort((a, b) => a.debut.localeCompare(b.debut)).slice(0, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { url } = await req.json();
    let u: URL;
    try { u = new URL(String(url).trim().replace(/^webcal:/i, "https:")); } catch { return rep({ erreur: "lien" }, 400); }
    if (!accepte(u)) return rep({ erreur: "site" }, 400);
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    let r: Response | null = null;
    for (let saut = 0; saut <= 3; saut++) {
      r = await fetch(u.toString(), { signal: ctrl.signal, redirect: "manual", headers: { "User-Agent": "Cleaneroo-Agenda/1.0" } });
      if (r.status < 300 || r.status >= 400) break;
      const suite = r.headers.get("location");
      if (!suite || saut === 3) { clearTimeout(t); return rep({ erreur: "inaccessible" }, 502); }
      try { u = new URL(suite, u); } catch { clearTimeout(t); return rep({ erreur: "lien" }, 400); }
      if (!accepte(u)) { clearTimeout(t); return rep({ erreur: "site" }, 400); }
    }
    clearTimeout(t);
    if (!r || !r.ok) return rep({ erreur: "inaccessible", statut: r?.status }, 502);
    const texte = (await r.text()).slice(0, 2_000_000);
    if (!texte.includes("BEGIN:VCALENDAR")) return rep({ erreur: "format" }, 422);
    return rep({ evenements: lire(texte) });
  } catch (_) {
    return rep({ erreur: "inaccessible" }, 502);
  }
});
