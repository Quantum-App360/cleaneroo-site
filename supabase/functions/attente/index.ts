// Fonction serveur « attente » (26/11/2026, « Ma demande compte ») : e-mail aux inscrits de la liste d'attente dont la demande
// peut maintenant être réservée (ouverture des réservations, ou Cleaneur validé dans leur secteur), avec leur lien personnel
// « Reprendre ma demande » et la fin de leur priorité de 24 h. Appelée par la base (traiter_attentes, clé x-cle-alertes).
// Envoi par Resend si le secret RESEND_API_KEY est configuré (comme la fonction « support ») ; sinon rien n'est marqué envoyé :
// la notification dans l'espace client reste, et la liste est visible dans l'espace de gestion (Zones › Prévenir).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://cleaneroo.fr";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const LOCALE: Record<string, string> = { fr: "fr-FR", en: "en-GB", it: "it-IT", es: "es-ES" };

/** Textes de l'e-mail, dans la langue de la demande. */
const TEXTES: Record<string, (v: Record<string, string>) => { sujet: string; corps: string; bouton: string; pied: string }> = {
  fr: v => ({
    sujet: `Cleaneroo à ${v.ville} : votre demande peut être réservée`,
    corps: `Bonjour${v.prenom ? " " + v.prenom : ""},<br><br>Un Cleaneur vérifié intervient maintenant à ${v.ville}. Votre demande${v.libelle ? ` (${v.libelle})` : ""} est gardée telle que vous l'avez remplie : il ne reste qu'à choisir votre créneau et à confirmer.<br><br>Vous étiez inscrit sur la liste d'attente : <b>vous avez la priorité jusqu'au ${v.fin}</b>. Pendant ce temps, personne d'autre ne peut réserver cette prestation dans votre secteur.`,
    bouton: "Reprendre ma demande",
    pied: "Le prix est recalculé selon les tarifs en vigueur et affiché avant le paiement. Rien n'a été débité. Pour quitter la liste, ouvrez le lien et choisissez « Ne plus être prévenu ».",
  }),
  en: v => ({
    sujet: `Cleaneroo in ${v.ville}: your request can now be booked`,
    corps: `Hello${v.prenom ? " " + v.prenom : ""},<br><br>A verified Cleaner now works in ${v.ville}. Your request${v.libelle ? ` (${v.libelle})` : ""} is saved exactly as you filled it in: just choose your time slot and confirm.<br><br>You were on the waiting list: <b>you have priority until ${v.fin}</b>. Until then, nobody else can book this service in your area.`,
    bouton: "Resume my request",
    pied: "The price is recalculated with the current rates and shown before payment. Nothing has been charged. To leave the list, open the link and choose “Stop notifying me”.",
  }),
  it: v => ({
    sujet: `Cleaneroo a ${v.ville}: la tua richiesta può essere prenotata`,
    corps: `Buongiorno${v.prenom ? " " + v.prenom : ""},<br><br>Un Cleaner verificato interviene ora a ${v.ville}. La tua richiesta${v.libelle ? ` (${v.libelle})` : ""} è conservata così come l'hai compilata: basta scegliere la fascia oraria e confermare.<br><br>Eri iscritto alla lista d'attesa: <b>hai la priorità fino al ${v.fin}</b>. Nel frattempo nessun altro può prenotare questo servizio nella tua zona.`,
    bouton: "Riprendi la mia richiesta",
    pied: "Il prezzo viene ricalcolato con le tariffe in vigore e mostrato prima del pagamento. Nulla è stato addebitato. Per lasciare la lista, apri il link e scegli « Non avvisarmi più ».",
  }),
  es: v => ({
    sujet: `Cleaneroo en ${v.ville}: ya puede reservar su solicitud`,
    corps: `Hola${v.prenom ? " " + v.prenom : ""},<br><br>Un Cleaner verificado ya trabaja en ${v.ville}. Su solicitud${v.libelle ? ` (${v.libelle})` : ""} se ha guardado tal como la rellenó: solo tiene que elegir su franja horaria y confirmar.<br><br>Estaba en la lista de espera: <b>tiene prioridad hasta el ${v.fin}</b>. Mientras tanto, nadie más puede reservar este servicio en su zona.`,
    bouton: "Retomar mi solicitud",
    pied: "El precio se recalcula con las tarifas vigentes y se muestra antes del pago. No se ha cobrado nada. Para salir de la lista, abra el enlace y elija « No avisarme más ».",
  }),
};

Deno.serve(async req => {
  const rep = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const { action } = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cle } = await admin.from("config_privee").select("valeur").eq("cle", "alertes").maybeSingle();
    if (!cle?.valeur || req.headers.get("x-cle-alertes") !== cle.valeur) return rep({ erreur: "refuse" }, 403);
    if (action !== "envoyer") return rep({ erreur: "action" }, 400);
    const resend = Deno.env.get("RESEND_API_KEY");
    if (!resend) return rep({ statut: "sans_email" });
    const de = Deno.env.get("ATTENTE_EXPEDITEUR") || Deno.env.get("SUPPORT_EXPEDITEUR") || "Cleaneroo <contact@cleaneroo.fr>";
    const { data: liste } = await admin.from("attente_secteur").select("id, jeton, prenom, email, ville, libelle, langue, priorite_jusqu")
      .not("prevenu_le", "is", null).is("email_envoye_le", null).is("reprise_le", null).not("email", "is", null).order("prevenu_le").limit(50);
    let envoyes = 0;
    for (const a of liste || []) {
      const langue = TEXTES[a.langue] ? a.langue : "fr";
      const fin = a.priorite_jusqu ? new Intl.DateTimeFormat(LOCALE[langue], { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(a.priorite_jusqu)) : "";
      const t = TEXTES[langue]({ prenom: esc(a.prenom || ""), ville: esc(a.ville), libelle: esc(a.libelle || ""), fin: esc(fin) });
      const lien = `${SITE}/#/reprendre/${encodeURIComponent(a.jeton)}`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d2b2b;max-width:560px">
        <p>${t.corps}</p>
        <p style="margin:24px 0"><a href="${lien}" style="background:#1F8A80;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">${esc(t.bouton)}</a></p>
        <p style="font-size:13px;color:#5b6b6b">${esc(t.pied)}</p><p style="font-size:13px;color:#5b6b6b">Cleaneroo · cleaneroo.fr</p></div>`;
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: de, to: [a.email], subject: t.sujet, html }) });
      if (r.ok) { await admin.from("attente_secteur").update({ email_envoye_le: new Date().toISOString() }).eq("id", a.id); envoyes++; }
    }
    return rep({ statut: "ok", envoyes });
  } catch (e) {
    return rep({ erreur: "service", detail: String((e as Error).message ?? e) }, 500);
  }
});
