// Langues du site : français (référence), anglais, italien, espagnol.
// Les pages sont écrites en français ; après chaque affichage, traduire(racine) remplace les textes par ceux de la langue choisie.
// Le catalogue (prestations, formules, tâches, lieux) est traduit à la source par traduireCatalogue().
// Même liste de langues que l'application Android (values-en, values-it, values-es).

export const LANGUES = {
  fr: { nom: "Français", drapeau: `<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ED2939"/></svg>` },
  en: { nom: "English", drapeau: `<svg viewBox="0 0 60 30"><clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>` },
  it: { nom: "Italiano", drapeau: `<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#CE2B37"/></svg>` },
  es: { nom: "Español", drapeau: `<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y=".5" width="3" height="1" fill="#F1BF00"/></svg>` },
};

const CLE = "cleaneroo-langue";
function detecter() {
  try { const l = localStorage.getItem(CLE); if (l && LANGUES[l]) return l; } catch { /* rien */ }
  // Français par défaut : les autres langues ne s'affichent que si le visiteur les choisit (drapeaux).
  return "fr";
}
export const langue = detecter();
export function choisirLangue(l) {
  try { localStorage.setItem(CLE, l); } catch { /* rien */ }
  location.reload();
}
const IDX = { en: 0, it: 1, es: 2 }[langue];

/* ------------------------------------------------------------------ Textes de l'interface : [français, anglais, italien, espagnol] */
// Textes de l'interface : assets/js/traductions.js, chargé seulement hors français (lot 9, performance).
const T = IDX === undefined ? [] : (await import("./traductions.js")).T;

const DICO = new Map();
if (IDX !== undefined) for (const l of T) DICO.set(l[0], l[IDX + 1]);
// Phrases longues cherchées aussi à l'intérieur des textes composés (ex. « Ouverture le … . Soyez prêts … »).
let PHRASES = null;

/* ------------------------------------------------------------------ Textes avec une partie variable */
export const LOCALE = { fr: "fr-FR", en: "en-GB", it: "it-IT", es: "es-ES" }[langue];
const MOTIFS = IDX === undefined ? [] : [
  [/^Clés reçues à (\d+ h(?: \d+)?)(\. Photo du tableau de bord enregistrée)?\.$/, (x, h, p) => [`Keys received at ${h}.${p ? " Dashboard photo saved." : ""}`, `Chiavi ricevute alle ${h}.${p ? " Foto del cruscotto salvata." : ""}`, `Llaves recibidas a las ${h}.${p ? " Foto del salpicadero guardada." : ""}`][IDX]],
  [/^Clés rendues (dans la boîte à clés|à l'accueil|en main propre|à la personne désignée) à (\d+ h(?: \d+)?)\.$/, (x, l, h) => { const L = { "dans la boîte à clés": ["in the key box", "nella cassetta portachiavi", "en la caja de llaves"], "à l'accueil": ["at reception", "alla reception", "en la recepción"], "en main propre": ["in person", "di persona", "en mano"], "à la personne désignée": ["to the designated person", "alla persona indicata", "a la persona designada"] }[l]; return [`Keys returned ${L[0]} at ${h}.`, `Chiavi restituite ${L[1]} alle ${h}.`, `Llaves devueltas ${L[2]} a las ${h}.`][IDX]; }],
  [/^Votre Cleaneur arrive demain à (.+)\. Pensez à l'accès au logement\.$/, (x, h) => [`Your Cleaneur arrives tomorrow at ${h}. Remember access to the property.`, `Il tuo Cleaneur arriva domani alle ${h}. Pensa all'accesso all'alloggio.`, `Su Cleaneur llega mañana a las ${h}. Piense en el acceso al alojamiento.`][IDX]],
  [/^(.*) à (\d+ h(?: \d+)?)\. Vérifiez l'accès et le matériel à prévoir\.$/, (x, v, h) => [`${v} at ${h}. Check access and the equipment to bring.`, `${v} alle ${h}. Verifica l'accesso e il materiale da portare.`, `${v} a las ${h}. Compruebe el acceso y el material necesario.`][IDX]],
  [/^(.+) est en route$/, (x, p) => [`${p} is on the way`, `${p} è in arrivo`, `${p} está en camino`][IDX]],
  [/^(.+) est arrivé\(e\) sur place$/, (x, p) => [`${p} has arrived`, `${p} è arrivato/a`, `${p} ha llegado`][IDX]],
  [/^(.+) interviendra chez vous\.$/, (x, p) => [`${p} will come to your place.`, `${p} interverrà da te.`, `${p} irá a tu casa.`][IDX]],
  [/^(.+) a annoncé un retard$/, (x, p) => [`${p} has announced a delay`, `${p} ha annunciato un ritardo`, `${p} ha anunciado un retraso`][IDX]],
  [/^(.+) est-il arrivé \?$/, (x, p) => [`Has ${p} arrived?`, `${p} è arrivato?`, `¿Ha llegado ${p}?`][IDX]],
  [/^Client noté ([\d,]+) \/ 5 \((\d+)\)$/, (x, n, c) => [`Customer rated ${n.replace(",", ".")} / 5 (${c})`, `Cliente valutato ${n} / 5 (${c})`, `Cliente valorado ${n} / 5 (${c})`][IDX]],
  [/^Appelez d'abord le client\. Après (\d+) min d'attente sur place, déclarez l'accès impossible : la mission est annulée et vous recevez une indemnité de (.+)\. En cas de danger, partez tout de suite\.$/, (x, n, mt) => [`Call the customer first. After ${n} min waiting on site, report no access: the job is cancelled and you receive compensation of ${mt}. If in danger, leave immediately.`, `Chiama prima il cliente. Dopo ${n} min di attesa sul posto, dichiara l'accesso impossibile: la missione è annullata e ricevi un indennizzo di ${mt}. In caso di pericolo, vai via subito.`, `Llama primero al cliente. Tras ${n} min de espera en el lugar, declara el acceso imposible: la misión se cancela y recibes una indemnización de ${mt}. En caso de peligro, vete de inmediato.`][IDX]],
  [/^Dans les (\d+) h après la fin du ménage, signalez un problème ou déclarez un dommage \(Garantie Cleaneroo, jusqu'à (.+)\)\. Nous examinons votre demande sous 72 h\.$/, (x, h, mt) => [`Within ${h} h of the end of the clean, report a problem or declare damage (Cleaneroo Guarantee, up to ${mt}). We review your request within 72 h.`, `Entro ${h} h dalla fine della pulizia, segnala un problema o dichiara un danno (Garanzia Cleaneroo, fino a ${mt}). Esaminiamo la tua richiesta entro 72 h.`, `En las ${h} h siguientes al final de la limpieza, informa de un problema o declara un daño (Garantía Cleaneroo, hasta ${mt}). Revisamos tu solicitud en 72 h.`][IDX]],
  [/^(\d+) photo\(s\)$/, (x, n) => [`${n} photo(s)`, `${n} foto`, `${n} foto(s)`][IDX]],
  [/^Mission d'urgence : prime de (.+) comprise$/, (m, p) => [`Urgent job: ${p} bonus included`, `Missione urgente: premio di ${p} incluso`, `Misión urgente: prima de ${p} incluida`][IDX]],
  [/^\+ (.+) de prime d'urgence$/, (m, p) => [`+ ${p} urgent bonus`, `+ ${p} di premio d'urgenza`, `+ ${p} de prima de urgencia`][IDX]],
  [/^Pénalités$/, () => [`Penalties`, `Penali`, `Penalizaciones`][IDX]],
  [/^(|) Avertissements : (\d+) \/ (\d+)$/, (m, e, n, x) => [`${e} Warnings: ${n} / ${x}`, `${e} Avvisi: ${n} / ${x}`, `${e} Avisos: ${n} / ${x}`][IDX]],
  [/^Aucun avertissement\. Vous avez droit à (\d+) avertissements : au suivant, votre compte est banni\.$/, (m, x) => [`No warnings. You are allowed ${x} warnings: at the next one, your account is banned.`, `Nessun avviso. Hai diritto a ${x} avvisi: al successivo, il tuo account viene bandito.`, `Ningún aviso. Tienes derecho a ${x} avisos: al siguiente, tu cuenta queda expulsada.`][IDX]],
  [/^Encore (\d+) avertissement possible : au-delà de (\d+), votre compte est banni\.$/, (m, r, x) => [`${r} more warning allowed: beyond ${x}, your account is banned.`, `Ancora ${r} avviso possibile: oltre ${x}, il tuo account viene bandito.`, `Queda ${r} aviso posible: más allá de ${x}, tu cuenta queda expulsada.`][IDX]],
  [/^Dernier avertissement : au prochain manquement, votre compte sera banni\.$/, () => [`Last warning: at the next breach, your account will be banned.`, `Ultimo avviso: alla prossima mancanza, il tuo account verrà bandito.`, `Último aviso: en el próximo incumplimiento, tu cuenta será expulsada.`][IDX]],
  [/^Vous avez dépassé les (\d+) avertissements autorisés : vous ne pouvez plus prendre de missions\. Écrivez à contact@cleaneroo\.fr pour en parler\.$/, (m, x) => [`You've gone beyond the ${x} warnings allowed: you can no longer take jobs. Write to contact@cleaneroo.fr to discuss it.`, `Hai superato i ${x} avvisi consentiti: non puoi più prendere missioni. Scrivi a contact@cleaneroo.fr per parlarne.`, `Has superado los ${x} avisos permitidos: ya no puedes aceptar misiones. Escribe a contact@cleaneroo.fr para hablarlo.`][IDX]],
  // Conditions d'utilisation : formules des Cleaneurs (chiffres lus dans REGLES)
  [/^deux formules au choix : Gratuit \(sans abonnement, commission de (.+?) %\) ou Pro \((.+?) par mois, commission de (.+?) %\)\. Les Cleaneurs inscrits jusqu'au 31 janvier 2027 ont la formule Pro offerte pendant (.+?) mois, à partir de leur première mission\. En cas d'impayé de l'abonnement Pro, (.+?) jours après la date de facturation prévue, le compte est bloqué et les missions réservées sont redistribuées\.$/,
    (m, a, b, c, e, f) => [
      `two plans to choose from: Free (no subscription, ${a}% commission) or Pro (${b} per month, ${c}% commission). Cleaneurs who sign up by 31 January 2027 get the Pro plan free for ${e} months, from their first job. If the Pro subscription is unpaid, ${f} days after the scheduled billing date, the account is blocked and booked jobs are reassigned.`,
      `due formule a scelta: Gratuito (senza abbonamento, commissione del ${a}%) o Pro (${b} al mese, commissione del ${c}%). I Cleaneur iscritti entro il 31 gennaio 2027 hanno la formula Pro offerta per ${e} mesi, dalla loro prima missione. In caso di mancato pagamento dell'abbonamento Pro, ${f} giorni dopo la data di fatturazione prevista, l'account viene bloccato e le missioni prenotate vengono riassegnate.`,
      `dos fórmulas a elegir: Gratis (sin suscripción, comisión del ${a} %) o Pro (${b} al mes, comisión del ${c} %). Los Cleaneurs inscritos hasta el 31 de enero de 2027 tienen la fórmula Pro gratis durante ${e} meses, desde su primera misión. En caso de impago de la suscripción Pro, ${f} días después de la fecha de facturación prevista, la cuenta se bloquea y las misiones reservadas se reasignan.`][IDX]],
  [/^(\d+) missions?$/, (m, n) => [`${n} job${n > 1 ? "s" : ""}`, `${n} mission${n > 1 ? "i" : "e"}`, `${n} misi${n > 1 ? "ones" : "ón"}`][IDX]],
  [/^(\d+) adresses? enregistrées?$/, (m, n) => [`${n} saved address${n > 1 ? "es" : ""}`, `${n} indirizz${n > 1 ? "i" : "o"} salvat${n > 1 ? "i" : "o"}`, `${n} direcci${n > 1 ? "ones" : "ón"} guardada${n > 1 ? "s" : ""}`][IDX]],
  [/^Départs sur (\d+) jours$/, (m, n) => [`Check-outs in ${n} days`, `Partenze in ${n} giorni`, `Salidas en ${n} días`][IDX]],
  [/^Chaque départ des (\d+) prochains jours sans ménage prévu\.$/, (m, n) => [`Every check-out in the next ${n} days with no clean planned.`, `Ogni partenza dei prossimi ${n} giorni senza pulizia prevista.`, `Cada salida de los próximos ${n} días sin limpieza prevista.`][IDX]],
  [/^Départ le (.+)$/, (m, d) => [`Check-out on ${d}`, `Partenza il ${d}`, `Salida el ${d}`][IDX]],
  [/^(\d+) documents obligatoires ajoutés$/, (m, n) => [`${n} required documents added`, `${n} documenti obbligatori aggiunti`, `${n} documentos obligatorios añadidos`][IDX]],
  [/^Lien du calendrier (.+)$/, (m, s) => [`${s === "Autre calendrier" ? "Other calendar" : s} calendar link`, `Link del calendario ${s === "Autre calendrier" ? "(altro)" : s}`, `Enlace del calendario ${s === "Autre calendrier" ? "(otro)" : s}`][IDX]],
  [/^Étape (\d+) sur (\d+)$/, (m, a, b) => [`Step ${a} of ${b}`, `Passo ${a} di ${b}`, `Paso ${a} de ${b}`][IDX]],
  [/^Total estimé (.+)$/, (m, p) => [`Estimated total ${p}`, `Totale stimato ${p}`, `Total estimado ${p}`][IDX]],
  [/^ÉTAPE (\d+)$/, (m, n) => [`STEP ${n}`, `PASSO ${n}`, `PASO ${n}`][IDX]],
  [/^dès (.+) \/ h$/, (m, p) => [`from ${p} / h`, `da ${p} / h`, `desde ${p} / h`][IDX]],
  [/^dès (.+) le ménage$/, (m, p) => [`from ${p} per clean`, `da ${p} a pulizia`, `desde ${p} por limpieza`][IDX]],
  [/^dès (.+) l'élément$/, (m, p) => [`from ${p} per item`, `da ${p} a elemento`, `desde ${p} por artículo`][IDX]],
  [/^Formule Standard dès (\d[\d\s]*(?:,\d\d)?\s€)$/, (m, p) => [`Standard package from ${p}`, `Formula Standard da ${p}`, `Fórmula Estándar desde ${p}`][IDX]],
  [/^dès (\d[\d\s]*(?:,\d\d)?\s€)$/, (m, p) => [`from ${p}`, `da ${p}`, `desde ${p}`][IDX]],
  [/^(\d+) passages planifiés : chaque passage est une demande séparée, au même prix\.$/, (m, n) => [`${n} visits scheduled: each visit is a separate request, at the same price.`, `${n} passaggi pianificati: ogni passaggio è una richiesta separata, allo stesso prezzo.`, `${n} visitas programadas: cada visita es una solicitud aparte, al mismo precio.`][IDX]],
  [/^Tâches marquées à la surface : prix pour (\d+) m², au prorata au-delà\.$/, (m, n) => [`Area-based tasks: price for ${n} m², pro rata above.`, `Compiti in base alla superficie: prezzo per ${n} m², in proporzione oltre.`, `Tareas según superficie: precio para ${n} m², a prorrata por encima.`][IDX]],
  // Lignes du panier : « Canapé d'angle 2 – 2,5 m × 1 » (nom et taille traduits à part)
  [/^(.+) × (\d+)$/, (m, a, q) => `${traduireTexte(a)} × ${q}`],
  [/^Réf\. (.+)$/, (m, r) => [`Ref. ${r}`, `Rif. ${r}`, `Ref. ${r}`][IDX]],
  [/^estimé (.+)$/, (m, p) => [`estimated ${p}`, `stimato ${p}`, `estimado ${p}`][IDX]],
  [/^Remise pack \(−(\d+) %\)$/, (m, n) => [`Package discount (−${n}%)`, `Sconto formula (−${n}%)`, `Descuento de fórmula (−${n} %)`][IDX]],
  [/^Majoration dimanche \(\+(\d+) %\)$/, (m, n) => [`Sunday surcharge (+${n}%)`, `Maggiorazione domenica (+${n}%)`, `Recargo dominical (+${n} %)`][IDX]],
  [/^Créneau malin \(−(\d+) %\)$/, (m, n) => [`Smart slot (−${n}%)`, `Fascia conveniente (−${n}%)`, `Franja inteligente (−${n} %)`][IDX]],
  [/^Engagement (\d+) mois \(−(\d+) %\)$/, (m, a, b) => [`${a}-month commitment (−${b}%)`, `Impegno ${a} mesi (−${b}%)`, `Compromiso de ${a} meses (−${b} %)`][IDX]],
  [/^(.+?) par lit : draps et housses lavés, séchés et pliés\.$/, (m, a) => [`${a} per bed: sheets and covers washed, dried and folded.`, `${a} a letto: lenzuola e copripiumini lavati, asciugati e piegati.`, `${a} por cama: sábanas y fundas lavadas, secadas y dobladas.`][IDX]],   // motif:{0} par lit : draps et housses lavés, séchés et pliés.
  [/^Tarif zone Prestige \(\+(.+?) %\)$/, (m, a) => [`Prestige area rate (+${a}%)`, `Tariffa zona Prestige (+${a}%)`, `Tarifa zona Prestigio (+${a} %)`][IDX]],   // motif:Tarif zone Prestige (+{0} %)
  [/^Tarif zone Économique \(−(.+?) %\)$/, (m, a) => [`Economy area rate (−${a}%)`, `Tariffa zona Economica (−${a}%)`, `Tarifa zona Económica (−${a} %)`][IDX]],   // motif:Tarif zone Économique (−{0} %)
  [/^Tâches particulières \((\d+)\)$/, (m, n) => [`Special tasks (${n})`, `Compiti particolari (${n})`, `Tareas especiales (${n})`][IDX]],
  [/^Salissure (.+) \(−(\d+) %\)$/, (m, s, n) => [`Dirt level ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (−${n}%)`, `Sporco ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (−${n}%)`, `Suciedad ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (−${n} %)`][IDX]],
  [/^Salissure (.+) \(\+(\d+) %\)$/, (m, s, n) => [`Dirt level ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n}%)`, `Sporco ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n}%)`, `Suciedad ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n} %)`][IDX]],
  [/^Ménage et location saisonnière à (.+)$/, (m, v) => [`Cleaning and holiday rentals in ${v}`, `Pulizie e affitti brevi a ${v}`, `Limpieza y alquiler vacacional en ${v}`][IDX]],
  [/^Ménage à (.+) · Cleaneur vérifié · Cleaneroo$/, (m, v) => [`Cleaning in ${v} · Verified Cleaneur · Cleaneroo`, `Pulizie a ${v} · Cleaneur verificato · Cleaneroo`, `Limpieza en ${v} · Cleaneur verificado · Cleaneroo`][IDX]],
  [/^Exemples de prix à (.+)$/, (m, v) => [`Example prices in ${v}`, `Esempi di prezzi a ${v}`, `Ejemplos de precios en ${v}`][IDX]],
  [/^Cleaneroo à (.+)$/, (m, v) => [`Cleaneroo in ${v}`, `Cleaneroo a ${v}`, `Cleaneroo en ${v}`][IDX]],
  [/^(.+) · (.+) et alentours$/, (m, d, v) => [`${d} · ${v} and surroundings`, `${d} · ${v} e dintorni`, `${d} · ${v} y alrededores`][IDX]],
  [/^soit (.+) après crédit d'impôt, si éligible$/, (m, p) => [`i.e. ${p} after tax credit, if eligible`, `ossia ${p} dopo il credito d'imposta, se idoneo`, `es decir, ${p} tras el crédito fiscal, si es elegible`][IDX]],
  [/^soit (.+) après crédit d'impôt$/, (m, p) => [`i.e. ${p} after tax credit`, `ossia ${p} dopo il credito d'imposta`, `es decir, ${p} tras el crédito fiscal`][IDX]],
  [/^Arrivée entre (\d+) h et (\d+) h · (.+)$/, (m, a, b, d) => [`Arrival between ${a}:00 and ${b}:00 · ${d}`, `Arrivo tra le ${a} e le ${b} · ${d}`, `Llegada entre las ${a} h y las ${b} h · ${d}`][IDX]],
  [/^soit (.+) après crédit d'impôt de 50 %$/, (m, p) => [`i.e. ${p} after the 50% tax credit`, `cioè ${p} dopo il credito d'imposta del 50 %`, `es decir, ${p} tras el crédito fiscal del 50 %`][IDX]],
  [/^Cleaneroo et (.+) : comparatif( · Cleaneroo)?$/, (m, c, s) => [`Cleaneroo and ${c}: comparison`, `Cleaneroo e ${c}: confronto`, `Cleaneroo y ${c}: comparativa`][IDX] + (s || "")],
  [/^Source (.+) :$/, (m, c) => [`${c} source:`, `Fonte ${c}:`, `Fuente ${c}:`][IDX]],
  [/^(\d+) icônes : en tuile et en ligne, à 20, 28 et 48 px\.$/, (m, n) => [`${n} icons: in a tile and inline, at 20, 28 and 48 px.`, `${n} icone: in riquadro e in linea, a 20, 28 e 48 px.`, `${n} iconos: en mosaico y en línea, a 20, 28 y 48 px.`][IDX]],
  // <rubriques-motifs> (généré)
  [/^Chambre\ (.+?)$/, (m, a0) => [`Bedroom ${traduireTexte(a0)}`, `Camera ${traduireTexte(a0)}`, `Dormitorio ${traduireTexte(a0)}`][IDX]],
  [/^Salle\ de\ bain\ (.+?)$/, (m, a0) => [`Bathroom ${traduireTexte(a0)}`, `Bagno ${traduireTexte(a0)}`, `Baño ${traduireTexte(a0)}`][IDX]],
  [/^Pièce\ (.+?)\ ·\ vue\ d'ensemble$/, (m, a0) => [`Room ${traduireTexte(a0)} · overall view`, `Stanza ${traduireTexte(a0)} · vista d'insieme`, `Habitación ${traduireTexte(a0)} · vista general`][IDX]],
  [/^Surface\ totale\ :\ (.+?)\ m²\ \((.+?)\ m²\ ×\ (.+?)\ paliers\)\.$/, (m, a0, a1, a2) => [`Total area: ${traduireTexte(a0)} m² (${traduireTexte(a1)} m² × ${traduireTexte(a2)} landings).`, `Superficie totale: ${traduireTexte(a0)} m² (${traduireTexte(a1)} m² × ${traduireTexte(a2)} pianerottoli).`, `Superficie total: ${traduireTexte(a0)} m² (${traduireTexte(a1)} m² × ${traduireTexte(a2)} rellanos).`][IDX]],
  // </rubriques-motifs>
  [/^(Studio|Appartement|Maison|Duplex \/ loft|Adresse) · (.+)$/, (m, t, v) => `${traduireTexte(t)} · ${v}`],
  [/^(\d+) km autour de (?!chez moi$)(.+)$/, (m, n, v) => [`${n} km around ${v}`, `${n} km intorno a ${v}`, `${n} km alrededor de ${v}`][IDX]],
  [/^(\d+) km autour de chez moi$/, (m, n) => [`${n} km around my home`, `${n} km intorno a casa mia`, `${n} km alrededor de mi casa`][IDX]],
  [/^Bonjour (.+)$/, (m, n) => [`Hello ${n}`, `Ciao ${n}`, `Hola ${n}`][IDX]],
  [/^Bonjour$/, () => ["Hello", "Ciao", "Hola"][IDX]],
  [/^· (\d+) ch\.$/, (m, n) => [`· ${n} bd`, `· ${n} cam.`, `· ${n} hab.`][IDX]],
  [/^Il manque : (.+)\.$/, (m, l) => [`Missing: `, `Mancano: `, `Falta: `][IDX] + l.split(", ").map(traduireTexte).join(", ") + "."],
  [/^J-(\d+)$/, (m, n) => [`D-${n}`, `G-${n}`, `D-${n}`][IDX]],
  [/^Pré-réservation$/, () => ["Pre-booking", "Pre-prenotazione", "Prerreserva"][IDX]],
  [/^(.+) · (\d+ h(?: \d+)?|\d+ min)$/, (m, a, d) => `${traduireTexte(a)} · ${traduireDuree(d)}`],
  [/^(\d+ h(?: \d+)?|\d+ min)$/, (m, d) => traduireDuree(d)],
  [/^(\d+ h(?: \d+)?|\d+ min)( · 2 Cleaneurs)?$/, (m, d, deux) => traduireDuree(d) + (deux ? " · 2 Cleaneurs" : "")],
];

function traduireDuree(d) {
  const m = d.match(/^(\d+) h(?: (\d+))?$/);
  if (m) return m[2] ? `${m[1]} h ${m[2]}` : `${m[1]} h`;
  return d.replace(" min", " min");
}

/** Traduit une chaîne isolée (sans balise). */
export function traduireTexte(s) {
  if (IDX === undefined) return s;
  const t = s.trim();
  if (!t) return s;
  if (DICO.has(t)) return s.replace(t, DICO.get(t));
  for (const [re, f] of MOTIFS) { const m = t.match(re); if (m) return s.replace(t, f(...m)); }
  // Texte composé : on remplace chaque phrase connue qu'il contient (les plus longues d'abord).
  if (!PHRASES) PHRASES = [...DICO.keys()].filter(k => k.length >= 8).sort((a, b) => b.length - a.length);
  let r = t;
  for (const k of PHRASES) if (r.includes(k)) r = r.split(k).join(DICO.get(k));
  return r === t ? s : s.replace(t, r);
}

/** Traduit tous les textes et attributs d'un morceau de page. */
/** Espaces insécables : « 100 % », « 29 € », « 8 h 15 », « 20 km », « ? » ne sont jamais coupés en fin de ligne (comme l'appli). */
export function insecables(s) {
  if (!s.includes(" ")) return s;
  return s.replace(/(\d) (%|€|h|km|m²|min)(?!\p{L})/gu, "$1 $2").replace(/(\d h) (\d)/g, "$1 $2")
    .replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ");
}

export function traduire(racine = document.body) {
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && !["SCRIPT", "STYLE", "TEXTAREA"].includes(n.parentNode.nodeName) ? 1 : 2 });
  const noeuds = []; while (w.nextNode()) noeuds.push(w.currentNode);
  for (const n of noeuds) { const t = insecables(traduireTexte(n.nodeValue)); if (t !== n.nodeValue) n.nodeValue = t; }
  if (IDX === undefined) return;
  racine.querySelectorAll?.("[placeholder],[title],[aria-label],[alt]").forEach(el => {
    for (const a of ["placeholder", "title", "aria-label", "alt"]) if (el.hasAttribute(a)) { const v = el.getAttribute(a); const t = traduireTexte(v); if (t !== v) el.setAttribute(a, t); }
  });
}

/** Pour les boîtes de dialogue du navigateur (confirm, alert). */
export const tr = s => traduireTexte(s);

/* ------------------------------------------------------------------ Catalogue (noms des prestations, formules, tâches, lieux) */
const C = {
  rubriques: {
    home: [["Home", "Regular or one-off cleaning", "Dusting of reachable surfaces, vacuuming and mopping, kitchen, bathroom and toilet, bins, beds made."], ["Casa", "Pulizie occasionali o regolari", "Spolveratura delle superfici accessibili, aspirapolvere e lavaggio pavimenti, cucina, bagno e WC, spazzatura, letti rifatti."], ["Vivienda", "Limpieza puntual o regular", "Quitar el polvo de superficies accesibles, aspirar y fregar suelos, cocina, baño y aseo, basura, camas hechas."]],
    rental: [["Holiday rental", "Ready for your next guests", "Full clean between two guests, beds made with the linen provided on site, kitchen and bathrooms disinfected, inventory and supplies checked, photos of every room for the host."], ["Affitto breve", "Pronto per i prossimi ospiti", "Pulizia completa tra due ospiti, letti rifatti con la biancheria presente, cucina e bagni disinfettati, controllo inventario e materiali, foto di ogni stanza per l'host."], ["Alquiler vacacional", "Listo para tus próximos huéspedes", "Limpieza completa entre dos huéspedes, camas hechas con la ropa disponible, cocina y baños desinfectados, control de inventario y consumibles, fotos de cada estancia para el anfitrión."]],
    moving: [["Moving", "A fresh start, floor to ceiling", "Full clean of the empty home. Cleaning only: Cleaneroo does no painting, filling or repairs."], ["Trasloco", "Un nuovo inizio, dal pavimento al soffitto", "Pulizia completa dell'alloggio vuoto. Solo pulizia: Cleaneroo non fa pittura, stuccatura né riparazioni."], ["Mudanza", "Un nuevo comienzo, del suelo al techo", "Limpieza completa de la vivienda vacía. Solo limpieza: Cleaneroo no hace pintura, masilla ni reparaciones."]],
    car: [["Vehicles", "Interior and exterior cleaning", "Standard, Premium or custom package. At home or on the street, waterless wash only (rinse-free products)."], ["Veicoli", "Pulizia interna ed esterna", "Formula Standard, Premium o su misura. A domicilio o su strada pubblica, solo lavaggio senz'acqua (prodotti senza risciacquo)."], ["Vehículos", "Limpieza interior y exterior", "Fórmula Estándar, Premium o a medida. En casa o en la vía pública, solo lavado sin agua (productos sin aclarado)."]],
    textiles: [["Sofas and textiles", "Sofas, mattresses and rugs"], ["Divani e tessili", "Divani, materassi e tappeti"], ["Sofás y textiles", "Sofás, colchones y alfombras"]],
    construction: [["After building work", "Get rid of dust after works"], ["Fine cantiere", "Eliminare la polvere dopo i lavori"], ["Fin de obra", "Eliminar el polvo tras las obras"]],
    kitchen: [["Kitchens", "Deep cleaning and degreasing"], ["Cucine", "Pulizia profonda e sgrassatura"], ["Cocinas", "Limpieza a fondo y desengrase"]],
    office: [["Offices and practices", "Offices, medical practices and agencies"], ["Uffici e studi", "Uffici, studi medici e agenzie"], ["Oficinas y consultas", "Oficinas, consultas médicas y agencias"]],
    commerce: [["Shops and warehouses", "Boutiques, stores, workshops and warehouses"], ["Negozi e magazzini", "Boutique, negozi, laboratori e magazzini"], ["Comercios y almacenes", "Tiendas, comercios, talleres y almacenes"]],
    communal: [["Buildings and common areas", "Floors, hall and annexes: priced by number of floors"], ["Edifici e parti comuni", "Piani, atrio e locali annessi: prezzo secondo il numero di piani"], ["Edificios y zonas comunes", "Plantas, vestíbulo y anexos: precio según el número de plantas"]],
    windows: [["Windows and shopfronts", "Windows, shopfronts and conservatories"], ["Vetri e vetrine", "Finestre, vetrine e verande"], ["Cristales y escaparates", "Ventanas, escaparates y porches"]],
    outdoor: [["Outdoor areas", "Terraces, balconies and garages"], ["Spazi esterni", "Terrazze, balconi e garage"], ["Espacios exteriores", "Terrazas, balcones y garajes"]],
    event: [["Before and after events", "Enjoy your event to the full"], ["Prima e dopo l'evento", "Goditi appieno il tuo evento"], ["Antes y después de eventos", "Disfruta plenamente de tu evento"]],
    special: [["Specialist services", "Pests, disasters and disinfection"], ["Servizi specializzati", "Infestanti, sinistri e disinfezione"], ["Servicios especializados", "Plagas, siniestros y desinfección"]],
  },
  // Noms simples (formules, tâches, lieux, packs) : français → [anglais, italien, espagnol]
  noms: {
    "Cafards et blattes (désinsectisation)": ["Cockroaches (pest control)", "Scarafaggi e blatte (disinfestazione)", "Cucarachas (desinsectación)"],
    "Punaises de lit": ["Bed bugs", "Cimici dei letti", "Chinches de cama"],
    "Rats et souris (dératisation)": ["Rats and mice (rodent control)", "Ratti e topi (derattizzazione)", "Ratas y ratones (desratización)"],
    "Nid de guêpes ou de frelons": ["Wasp or hornet nest", "Nido di vespe o calabroni", "Nido de avispas o avispones"],
    "Intervention à la date de votre choix": ["Job on the date of your choice", "Intervento nella data che preferisci", "Intervención en la fecha que elijas"],
    "Intervention sous 24 à 48 h · +30 %": ["Job within 24 to 48 h · +30%", "Intervento entro 24-48 h · +30 %", "Intervención en 24 a 48 h · +30 %"],
    "Micro-ondes (intérieur)": ["Microwave (inside)", "Microonde (interno)", "Microondas (interior)"],
    "Intérieur des placards de cuisine": ["Inside the kitchen cupboards", "Interno dei pensili della cucina", "Interior de los armarios de cocina"],
    "Vitres intérieures et extérieures": ["Windows inside and out", "Vetri interni ed esterni", "Cristales interiores y exteriores"],
    "Dépoussiérage des hauteurs et luminaires": ["Dusting high surfaces and lights", "Spolveratura delle parti alte e dei lampadari", "Quitar el polvo de zonas altas y lámparas"],
    "Plinthes, portes et interrupteurs": ["Skirting boards, doors and switches", "Battiscopa, porte e interruttori", "Rodapiés, puertas e interruptores"],
    "Intérieur des placards et armoires": ["Inside cupboards and wardrobes", "Interno di armadi e guardaroba", "Interior de armarios y roperos"],
    "Repassage (1 heure)": ["Ironing (1 hour)", "Stiratura (1 ora)", "Planchado (1 hora)"],
    "Lessive et pliage du linge": ["Laundry and folding", "Bucato e piegatura", "Colada y doblado de la ropa"],
    "Terrasse (balayage et lavage)": ["Terrace (sweeping and washing)", "Terrazza (spazzatura e lavaggio)", "Terraza (barrido y fregado)"],
    "Détachage ciblé": ["Targeted stain removal", "Smacchiatura mirata", "Desmanchado localizado"],
    "Anti-acariens": ["Anti-dust mite", "Antiacaro", "Antiácaros"],
    "Désodorisation": ["Deodorising", "Deodorazione", "Desodorización"],
    "Protection anti-taches": ["Stain protection", "Protezione antimacchia", "Protección antimanchas"],
    "Séchage accéléré": ["Fast drying", "Asciugatura rapida", "Secado rápido"],
    "Ménage ponctuel": ["One-off clean", "Pulizia occasionale", "Limpieza puntual"], "Un ménage complet, une seule fois.": ["A full clean, just once.", "Una pulizia completa, una sola volta.", "Una limpieza completa, una sola vez."],
    "Entretien régulier": ["Regular cleaning", "Manutenzione regolare", "Mantenimiento regular"], "Chaque semaine ou tous les 15 jours, idéalement avec le même Cleaneur.": ["Weekly or every two weeks, ideally with the same Cleaneur.", "Ogni settimana o ogni 15 giorni, idealmente con lo stesso Cleaneur.", "Cada semana o cada 15 días, idealmente con el mismo Cleaneur."],
    "Grand ménage": ["Deep clean", "Pulizia profonda", "Limpieza a fondo"], "Un nettoyage en profondeur, du sol au plafond.": ["A thorough clean, floor to ceiling.", "Una pulizia approfondita, dal pavimento al soffitto.", "Una limpieza a fondo, del suelo al techo."],
    "Après un court séjour (1–4 nuits)": ["After a short stay (1–4 nights)", "Dopo un breve soggiorno (1–4 notti)", "Tras una estancia corta (1–4 noches)"], "Rotation standard.": ["Standard turnover.", "Cambio standard.", "Rotación estándar."],
    "Après un séjour d'une semaine (5–9 nuits)": ["After a one-week stay (5–9 nights)", "Dopo un soggiorno di una settimana (5–9 notti)", "Tras una estancia de una semana (5–9 noches)"], "Rotation approfondie.": ["Thorough turnover.", "Cambio approfondito.", "Rotación a fondo."],
    "Après un long séjour (10 nuits et +)": ["After a long stay (10+ nights)", "Dopo un lungo soggiorno (10+ notti)", "Tras una estancia larga (10+ noches)"], "Rotation complète.": ["Full turnover.", "Cambio completo.", "Rotación completa."],
    "Grand ménage périodique": ["Periodic deep clean", "Pulizia profonda periodica", "Limpieza a fondo periódica"], "Remise à niveau complète du logement.": ["Complete refresh of the home.", "Rimessa a nuovo completa dell'alloggio.", "Puesta a punto completa de la vivienda."],
    "Nettoyage d'emménagement": ["Move-in clean", "Pulizia di ingresso", "Limpieza de entrada"], "Nettoyage de départ / état des lieux": ["Move-out / inventory clean", "Pulizia di uscita / verbale", "Limpieza de salida / inventario"], "Remise en état": ["Restoration clean", "Ripristino", "Puesta a punto"],
    "Canapé": ["Sofa", "Divano", "Sofá"], "Matelas": ["Mattress", "Materasso", "Colchón"], "Tapis et moquettes": ["Rugs and carpets", "Tappeti e moquette", "Alfombras y moquetas"],
    "Nettoyage de fin de chantier": ["After-works clean", "Pulizia di fine cantiere", "Limpieza de fin de obra"], "Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.": ["The level of dirt will be assessed once all photos are usable.", "Il livello di sporco sarà stimato appena tutte le foto saranno utilizzabili.", "El nivel de suciedad se estimará cuando todas las fotos sean utilizables."],
    "Après service": ["After service", "Dopo il servizio", "Después del servicio"], "Dégraissage approfondi": ["Deep degreasing", "Sgrassatura profonda", "Desengrase a fondo"], "Grand nettoyage avant contrôle sanitaire": ["Deep clean before a health inspection", "Pulizia profonda prima del controllo sanitario", "Limpieza a fondo antes de la inspección sanitaria"],
    "Nettoyage ponctuel": ["One-off clean", "Pulizia occasionale", "Limpieza puntual"], "Remise en état des locaux": ["Premises restoration", "Ripristino dei locali", "Puesta a punto de los locales"], "Ponctuel": ["One-off", "Occasionale", "Puntual"],
    "15 min par fenêtre, minimum 1 h 30.": ["15 min per window, minimum 1 h 30.", "15 min per finestra, minimo 1 h 30.", "15 min por ventana, mínimo 1 h 30."], "Après travaux": ["After works", "Dopo i lavori", "Tras obras"],
    "Remise en état et démoussage": ["Restoration and moss removal", "Ripristino e rimozione del muschio", "Puesta a punto y eliminación de musgo"], "Entretien saisonnier": ["Seasonal upkeep", "Manutenzione stagionale", "Mantenimiento de temporada"],
    "Avant l'événement": ["Before the event", "Prima dell'evento", "Antes del evento"], "Après": ["After", "Dopo", "Después"], "Avant et après (2 passages)": ["Before and after (2 visits)", "Prima e dopo (2 passaggi)", "Antes y después (2 visitas)"], "Standard": ["Standard", "Standard", "Estándar"],
    "Intérieur du four": ["Inside the oven", "Interno del forno", "Interior del horno"], "Intérieur du réfrigérateur": ["Inside the fridge", "Interno del frigorifero", "Interior del frigorífico"], "Hotte et filtres": ["Hood and filters", "Cappa e filtri", "Campana y filtros"],
    "Micro-ondes": ["Microwave", "Microonde", "Microondas"], "Placards de cuisine": ["Kitchen cupboards", "Pensili della cucina", "Armarios de cocina"], "Vaisselle": ["Washing-up", "Stoviglie", "Vajilla"],
    "Vitres int. et ext.": ["Windows in and out", "Vetri int. ed est.", "Cristales int. y ext."], "Hauteurs et luminaires": ["High surfaces and lights", "Parti alte e lampadari", "Zonas altas y lámparas"], "Plinthes": ["Skirting boards", "Battiscopa", "Zócalos"],
    "Placards et armoires": ["Cupboards and wardrobes", "Armadi e guardaroba", "Armarios y roperos"], "Changement des draps": ["Changing the sheets", "Cambio delle lenzuola", "Cambio de sábanas"], "Repassage (1 h)": ["Ironing (1 h)", "Stiratura (1 h)", "Planchado (1 h)"],
    "Lessive et pliage": ["Laundry and folding", "Bucato e piegatura", "Colada y doblado"], "Balcon": ["Balcony", "Balcone", "Balcón"], "Terrasse": ["Terrace", "Terrazza", "Terraza"], "Sortie des poubelles": ["Taking out the bins", "Portare fuori la spazzatura", "Sacar la basura"],
    "Aspiration complète": ["Full vacuuming", "Aspirazione completa", "Aspirado completo"], "Plastiques et tableau de bord": ["Plastics and dashboard", "Plastiche e cruscotto", "Plásticos y salpicadero"], "Vitres intérieures": ["Interior windows", "Vetri interni", "Cristales interiores"],
    "Plastiques nettoyage + protection": ["Plastics clean + protection", "Plastiche pulizia + protezione", "Plásticos limpieza + protección"], "Shampoing sièges tissu": ["Fabric seat shampoo", "Shampoo sedili in tessuto", "Champú de asientos de tela"], "Cuir nettoyé et nourri": ["Leather cleaned and conditioned", "Pelle pulita e nutrita", "Cuero limpiado y nutrido"],
    "Moquettes et tapis": ["Carpets and mats", "Moquette e tappetini", "Moquetas y alfombrillas"], "Coffre": ["Boot", "Bagagliaio", "Maletero"], "Ciel de toit": ["Headliner", "Cielo dell'abitacolo", "Techo interior"], "Poils d'animaux": ["Pet hair", "Peli di animali", "Pelo de animales"],
    "Anti-odeurs": ["Odour removal", "Anti-odori", "Antiolores"], "Lavage à la main": ["Hand wash", "Lavaggio a mano", "Lavado a mano"], "Vitres extérieures": ["Exterior windows", "Vetri esterni", "Cristales exteriores"], "Jantes et pneus": ["Wheels and tyres", "Cerchi e pneumatici", "Llantas y neumáticos"],
    "Décontamination des jantes": ["Wheel decontamination", "Decontaminazione cerchi", "Descontaminación de llantas"], "Bas de caisse": ["Sills", "Sottoporta", "Bajos"], "Cire": ["Wax", "Cera", "Cera"], "Optiques de phares": ["Headlight lenses", "Fari", "Ópticas de faros"],
    "Polissage 1 étape": ["One-step polish", "Lucidatura 1 fase", "Pulido en 1 paso"], "Compartiment moteur": ["Engine bay", "Vano motore", "Compartimento del motor"],
    "Essentiel": ["Essential", "Essenziale", "Esencial"], "Confort": ["Comfort", "Comfort", "Confort"], "Prestige": ["Prestige", "Prestige", "Prestigio"],
    "Bureaux": ["Offices", "Uffici", "Oficinas"], "Local commercial / boutique": ["Commercial premises / shop", "Locale commerciale / negozio", "Local comercial / tienda"], "Magasin / supérette": ["Store / convenience store", "Negozio / minimarket", "Tienda / supermercado"],
    "Cabinet médical": ["Medical practice", "Studio medico", "Consulta médica"], "Agence / accueil du public": ["Agency / public reception", "Agenzia / sportello al pubblico", "Agencia / atención al público"], "Showroom / galerie": ["Showroom / gallery", "Showroom / galleria", "Showroom / galería"],
    "Entrepôt": ["Warehouse", "Magazzino", "Almacén"], "Atelier": ["Workshop", "Laboratorio", "Taller"], "Salle de sport": ["Gym", "Palestra", "Gimnasio"],
    "Particulier": ["Private home", "Privato", "Particular"], "Restaurant": ["Restaurant", "Ristorante", "Restaurante"], "Hôtel": ["Hotel", "Hotel", "Hotel"], "Collectivité / cantine": ["Institution / canteen", "Collettività / mensa", "Colectividad / comedor"],
    "Boulangerie, traiteur, labo": ["Bakery, caterer, lab", "Panetteria, gastronomia, laboratorio", "Panadería, catering, obrador"], "Food truck": ["Food truck", "Food truck", "Food truck"],
    "Immeuble résidentiel / copropriété": ["Residential building", "Condominio", "Edificio residencial / comunidad"], "Résidence services": ["Serviced residence", "Residenza con servizi", "Residencia con servicios"], "Immeuble de bureaux": ["Office building", "Edificio per uffici", "Edificio de oficinas"], "Parking / sous-sol": ["Car park / basement", "Parcheggio / seminterrato", "Aparcamiento / sótano"],
    "Fenêtres d'un logement": ["Home windows", "Finestre di un'abitazione", "Ventanas de una vivienda"], "Baies vitrées et véranda": ["Bay windows and conservatory", "Vetrate e veranda", "Ventanales y porche"], "Vitrine de commerce": ["Shopfront", "Vetrina di negozio", "Escaparate"], "Bureaux et façades vitrées": ["Offices and glass façades", "Uffici e facciate in vetro", "Oficinas y fachadas acristaladas"],
    "Terrasse / balcon": ["Terrace / balcony", "Terrazza / balcone", "Terraza / balcón"], "Jardin, allées et cour": ["Garden, paths and yard", "Giardino, vialetti e cortile", "Jardín, caminos y patio"], "Garage, cave ou abri": ["Garage, cellar or shed", "Garage, cantina o capanno", "Garaje, bodega o cobertizo"],
    "Abords de piscine": ["Pool surroundings", "Bordo piscina", "Alrededores de la piscina"], "Cour d'immeuble / parking": ["Building yard / car park", "Cortile condominiale / parcheggio", "Patio del edificio / aparcamiento"],
    "Mariage / réception": ["Wedding / reception", "Matrimonio / ricevimento", "Boda / recepción"], "Fête privée à domicile": ["Private party at home", "Festa privata a casa", "Fiesta privada en casa"], "Séminaire d'entreprise": ["Corporate seminar", "Seminario aziendale", "Seminario de empresa"],
    "Salon / exposition": ["Trade show / exhibition", "Fiera / esposizione", "Feria / exposición"], "Anniversaire en salle": ["Birthday in a hall", "Compleanno in sala", "Cumpleaños en salón"],
    "Carrelage": ["Tiles", "Piastrelle", "Baldosas"], "Parquet": ["Wooden floor", "Parquet", "Parqué"], "Béton ciré": ["Polished concrete", "Cemento spatolato", "Hormigón pulido"], "Lino / PVC": ["Lino / vinyl", "Linoleum / PVC", "Linóleo / PVC"], "Moquette": ["Carpet", "Moquette", "Moqueta"], "Pierre naturelle": ["Natural stone", "Pietra naturale", "Piedra natural"],
    "Citadine": ["City car", "Citycar", "Urbano"], "Berline": ["Saloon", "Berlina", "Berlina"], "SUV": ["SUV", "SUV", "SUV"], "Utilitaire": ["Van", "Furgone", "Furgoneta"],
  // <locaux-noms>
    "Parking de l'immeuble (balayage, jusqu'à 500 m²)": ["Building car park (sweeping, up to 500 m²)", "Parcheggio dell'edificio (spazzatura, fino a 500 m²)", "Aparcamiento del edificio (barrido, hasta 500 m²)"],
    "Cour et allées (balayage, lavage)": ["Courtyard and paths (sweeping, washing)", "Cortile e vialetti (spazzatura, lavaggio)", "Patio y caminos (barrido, lavado)"],
    "Espaces verts (ramassage des feuilles et déchets)": ["Green spaces (collecting leaves and litter)", "Aree verdi (raccolta di foglie e rifiuti)", "Zonas verdes (recogida de hojas y residuos)"],
    "Inventaire ou changement de collection": ["Stocktake or new collection", "Inventario o cambio di collezione", "Inventario o cambio de colección"],
  // </locaux-noms>
  // <rubriques-noms> (généré)
    "Logement vide, nettoyé avant votre arrivée": ["Empty home, cleaned before you arrive", "Alloggio vuoto, pulito prima del tuo arrivo", "Vivienda vacía, limpiada antes de tu llegada"],
    "Logement vidé, remis au propre pour l'état des lieux de sortie": ["Emptied home, cleaned for the move-out inspection", "Alloggio svuotato, pulito per il verbale di uscita", "Vivienda vaciada, limpiada para la inspección de salida"],
    "Logement très encrassé : calcaire, graisse, traces incrustées · analyse des photos": ["Very dirty home: limescale, grease, ingrained marks · photo analysis", "Alloggio molto sporco: calcare, grasso, segni incrostati · analisi delle foto", "Vivienda muy sucia: cal, grasa, marcas incrustadas · análisis de las fotos"],
    "Intérieur des placards et penderies": ["Inside cupboards and wardrobes", "Interno di armadi e guardaroba", "Interior de armarios y roperos"],
    "Vitres et encadrements": ["Windows and frames", "Vetri e telai", "Cristales y marcos"],
    "Volets et stores": ["Shutters and blinds", "Persiane e tende", "Persianas y estores"],
    "Traces sur les murs (lessivage localisé)": ["Marks on walls (spot washing)", "Segni sui muri (lavaggio localizzato)", "Marcas en las paredes (lavado localizado)"],
    "Traces d'adhésif et de scotch": ["Adhesive and tape marks", "Tracce di adesivo e nastro", "Restos de adhesivo y cinta"],
    "Détartrage renforcé (robinetterie, parois, joints)": ["Deep descaling (taps, screens, grout)", "Decalcificazione profonda (rubinetteria, pareti, fughe)", "Descalcificación a fondo (grifería, mamparas, juntas)"],
    "Désinfection renforcée des sanitaires": ["Deep disinfection of sanitary fittings", "Disinfezione profonda dei sanitari", "Desinfección a fondo de los sanitarios"],
    "Balcon ou terrasse": ["Balcony or terrace", "Balcone o terrazza", "Balcón o terraza"],
    "Cave ou garage (balayage, dépoussiérage)": ["Cellar or garage (sweeping, dusting)", "Cantina o garage (spazzatura, spolveratura)", "Sótano o garaje (barrido, quitar el polvo)"],
    "Aspiration complète (sièges, tapis, coffre)": ["Full vacuuming (seats, mats, boot)", "Aspirazione completa (sedili, tappetini, bagagliaio)", "Aspirado completo (asientos, alfombrillas, maletero)"],
    "Dépoussiérage plastiques et tableau de bord": ["Dusting plastics and dashboard", "Spolveratura plastiche e cruscotto", "Quitar el polvo de plásticos y salpicadero"],
    "Plastiques intérieurs : nettoyage + protection": ["Interior plastics: cleaning + protection", "Plastiche interne: pulizia + protezione", "Plásticos interiores: limpieza + protección"],
    "Shampoing des sièges tissu": ["Fabric seat shampoo", "Shampoo dei sedili in tessuto", "Champú de asientos de tela"],
    "Nettoyage et nourrissage du cuir": ["Leather cleaning and conditioning", "Pulizia e nutrimento della pelle", "Limpieza y nutrición del cuero"],
    "Shampoing moquettes et tapis": ["Carpet and mat shampoo", "Shampoo moquette e tappetini", "Champú de moquetas y alfombrillas"],
    "Nettoyage du coffre": ["Boot cleaning", "Pulizia del bagagliaio", "Limpieza del maletero"],
    "Traitement anti-odeurs": ["Odour treatment", "Trattamento anti-odori", "Tratamiento antiolores"],
    "Lavage extérieur à la main": ["Exterior hand wash", "Lavaggio esterno a mano", "Lavado exterior a mano"],
    "Jantes et pneus (nettoyage + brillant pneus)": ["Wheels and tyres (cleaning + tyre shine)", "Cerchi e pneumatici (pulizia + lucido gomme)", "Llantas y neumáticos (limpieza + abrillantado)"],
    "Décontamination des jantes (dépôts de freins)": ["Wheel decontamination (brake dust)", "Decontaminazione dei cerchi (polvere dei freni)", "Descontaminación de llantas (polvo de frenos)"],
    "Bas de caisse et passages de roues": ["Sills and wheel arches", "Sottoporta e passaruota", "Bajos y pasos de rueda"],
    "Cire de protection carrosserie": ["Protective body wax", "Cera protettiva per carrozzeria", "Cera protectora de carrocería"],
    "Rénovation des optiques de phares": ["Headlight restoration", "Rinnovo dei fari", "Renovación de faros"],
    "Polissage carrosserie (lustrage 1 étape)": ["Body polishing (one-step)", "Lucidatura carrozzeria (1 fase)", "Pulido de carrocería (1 paso)"],
    "Compartiment moteur (nettoyage à sec)": ["Engine bay (dry cleaning)", "Vano motore (pulizia a secco)", "Compartimento del motor (limpieza en seco)"],
    "Détachage ciblé (taches tenaces)": ["Targeted stain removal (stubborn stains)", "Smacchiatura mirata (macchie ostinate)", "Desmanchado localizado (manchas difíciles)"],
    "Traitement anti-acariens": ["Anti-dust mite treatment", "Trattamento antiacaro", "Tratamiento antiácaros"],
    "Séchage accéléré (ventilation)": ["Fast drying (ventilation)", "Asciugatura rapida (ventilazione)", "Secado rápido (ventilación)"],
    "Aspiration en profondeur · Shampoing par injection-extraction · Traitement des taches courantes": ["Deep vacuuming · Injection-extraction shampoo · Treatment of common stains", "Aspirazione profonda · Shampoo a iniezione-estrazione · Trattamento delle macchie comuni", "Aspirado en profundidad · Champú por inyección-extracción · Tratamiento de manchas comunes"],
    "Retrait des étiquettes et films de protection": ["Removal of labels and protective films", "Rimozione di etichette e pellicole protettive", "Retirada de etiquetas y películas protectoras"],
    "Résidus de plâtre ou de peinture au sol": ["Plaster or paint residue on the floor", "Residui di gesso o vernice sul pavimento", "Restos de yeso o pintura en el suelo"],
    "Évacuation de déchets légers (sacs)": ["Removal of light waste (bags)", "Smaltimento di rifiuti leggeri (sacchi)", "Retirada de residuos ligeros (bolsas)"],
    "Aspiration des poussières de chantier (filtre HEPA) · Sols lavés selon leur nature · Vitres et menuiseries intérieures · Sanitaires et cuisine · Retrait des traces et étiquettes courantes": ["Vacuuming of building dust (HEPA filter) · Floors washed according to their type · Interior windows and joinery · Bathrooms and kitchen · Removal of common marks and labels", "Aspirazione delle polveri di cantiere (filtro HEPA) · Pavimenti lavati secondo il materiale · Vetri e serramenti interni · Sanitari e cucina · Rimozione di segni ed etichette comuni", "Aspirado del polvo de obra (filtro HEPA) · Suelos fregados según su material · Cristales y carpintería interior · Baños y cocina · Retirada de marcas y etiquetas habituales"],
    "Murs et faïence": ["Walls and tiles", "Pareti e piastrelle", "Paredes y azulejos"],
    "Plinthes, angles et gorges": ["Skirting, corners and coves", "Battiscopa, angoli e sgusci", "Rodapiés, esquinas y medias cañas"],
    "Siphons et caniveaux de sol (démontage, curage)": ["Floor traps and drains (dismantling, cleaning out)", "Sifoni e canaline a pavimento (smontaggio, spurgo)", "Sifones y canaletas de suelo (desmontaje, limpieza)"],
    "Plafond et luminaires": ["Ceiling and lights", "Soffitto e lampade", "Techo y luminarias"],
    "Grilles et bouches d'aération": ["Vents and grilles", "Griglie e bocchette d'aerazione", "Rejillas y bocas de ventilación"],
    "Vitres et portes vitrées": ["Windows and glass doors", "Vetri e porte a vetri", "Cristales y puertas de cristal"],
    "Portes, poignées et interrupteurs (désinfection)": ["Doors, handles and switches (disinfection)", "Porte, maniglie e interruttori (disinfezione)", "Puertas, tiradores e interruptores (desinfección)"],
    "Éviers, robinetterie et détartrage": ["Sinks, taps and descaling", "Lavelli, rubinetteria e decalcificazione", "Fregaderos, grifería y descalcificación"],
    "Dégivrage et nettoyage d'un congélateur": ["Defrosting and cleaning a freezer", "Sbrinamento e pulizia di un congelatore", "Descongelado y limpieza de un congelador"],
    "Étagères et rayonnages de la réserve": ["Storeroom shelves and racks", "Ripiani e scaffali della dispensa", "Estantes y estanterías del almacén"],
    "Chariots, bacs gastro et ustensiles": ["Trolleys, gastronorm trays and utensils", "Carrelli, bacinelle gastronorm e utensili", "Carros, bandejas gastronorm y utensilios"],
    "Poubelles et local poubelles (lavage, désinfection)": ["Bins and bin store (washing, disinfection)", "Cestini e locale rifiuti (lavaggio, disinfezione)", "Cubos y cuarto de basuras (lavado, desinfección)"],
    "Vestiaires et sanitaires du personnel": ["Staff changing rooms and toilets", "Spogliatoi e servizi del personale", "Vestuarios y aseos del personal"],
    "Salle de service : tables, chaises et sols (jusqu'à 40 couverts)": ["Dining room: tables, chairs and floors (up to 40 covers)", "Sala: tavoli, sedie e pavimenti (fino a 40 coperti)", "Comedor: mesas, sillas y suelos (hasta 40 cubiertos)"],
    "Désinfection des surfaces en contact alimentaire": ["Disinfection of food-contact surfaces", "Disinfezione delle superfici a contatto con alimenti", "Desinfección de superficies en contacto con alimentos"],
    "Fiche de traçabilité HACCP": ["HACCP traceability sheet", "Scheda di tracciabilità HACCP", "Ficha de trazabilidad APPCC"],
    "Bureaux et open space, sols, corbeilles, sanitaires": ["Offices and open space, floors, bins, toilets", "Uffici e open space, pavimenti, cestini, servizi", "Oficinas y espacios abiertos, suelos, papeleras, aseos"],
    "Cabinet médical / paramédical": ["Medical / paramedical practice", "Studio medico / paramedico", "Consulta médica / paramédica"],
    "Entrepôt / remise / stockage": ["Warehouse / shed / storage", "Magazzino / rimessa / deposito", "Almacén / cobertizo / depósito"],
    "Atelier / local d'activité": ["Workshop / business premises", "Laboratorio / locale di attività", "Taller / local de actividad"],
    "Salle de sport / studio": ["Gym / studio", "Palestra / studio", "Gimnasio / estudio"],
    "Désinfection claviers, souris et téléphones": ["Disinfecting keyboards, mice and phones", "Disinfezione di tastiere, mouse e telefoni", "Desinfección de teclados, ratones y teléfonos"],
    "Dépoussiérage des écrans et du matériel informatique": ["Dusting screens and IT equipment", "Spolveratura di schermi e apparecchi informatici", "Quitar el polvo de pantallas y equipos informáticos"],
    "Salles de réunion (tables, chaises, écrans)": ["Meeting rooms (tables, chairs, screens)", "Sale riunioni (tavoli, sedie, schermi)", "Salas de reuniones (mesas, sillas, pantallas)"],
    "Cloisons vitrées intérieures": ["Interior glass partitions", "Pareti vetrate interne", "Mamparas de cristal interiores"],
    "Salle d'attente (sièges, tables, présentoirs)": ["Waiting room (seats, tables, displays)", "Sala d'attesa (sedute, tavoli, espositori)", "Sala de espera (asientos, mesas, expositores)"],
    "Paillasson et sas d'entrée": ["Doormat and entrance lobby", "Zerbino e bussola d'ingresso", "Felpudo y vestíbulo de entrada"],
    "Kitchenette / coin café (frigo, micro-ondes, cafetière)": ["Kitchenette / coffee corner (fridge, microwave, coffee maker)", "Angolo cottura / caffè (frigo, microonde, macchina del caffè)", "Office / zona de café (nevera, microondas, cafetera)"],
    "Vitrine (faces intérieure et extérieure)": ["Shop window (inside and outside)", "Vetrina (lato interno ed esterno)", "Escaparate (cara interior y exterior)"],
    "Comptoir, caisses et terminaux de paiement": ["Counter, tills and card terminals", "Bancone, casse e terminali di pagamento", "Mostrador, cajas y terminales de pago"],
    "Présentoirs, étagères et rayonnages de vente": ["Sales displays, shelves and racks", "Espositori, ripiani e scaffali di vendita", "Expositores, estantes y estanterías de venta"],
    "Cabines d'essayage (miroirs, rideaux)": ["Fitting rooms (mirrors, curtains)", "Camerini di prova (specchi, tende)", "Probadores (espejos, cortinas)"],
    "Miroirs et vitrines d'exposition": ["Mirrors and display cases", "Specchi e vetrine espositive", "Espejos y vitrinas de exposición"],
    "Réserve / arrière-boutique": ["Stockroom / back shop", "Magazzino / retrobottega", "Almacén / trastienda"],
    "Lavage mécanisé des sols (autolaveuse)": ["Machine floor washing (scrubber-dryer)", "Lavaggio meccanizzato dei pavimenti (lavasciuga)", "Fregado mecanizado de suelos (fregadora)"],
    "Shampoing moquette": ["Carpet shampoo", "Shampoo moquette", "Champú de moqueta"],
    "Décapage et protection des sols (cire)": ["Floor stripping and protection (wax)", "Decappaggio e protezione dei pavimenti (cera)", "Decapado y protección de suelos (cera)"],
    "Dégraissage des sols d'atelier (huiles, traces)": ["Degreasing workshop floors (oil, marks)", "Sgrassatura dei pavimenti d'officina (olii, tracce)", "Desengrase de suelos de taller (aceites, marcas)"],
    "Désinfection des tapis et sols de sport": ["Disinfecting sports mats and floors", "Disinfezione di tappetini e pavimenti sportivi", "Desinfección de esterillas y suelos deportivos"],
    "Désinfection renforcée des points de contact": ["Thorough disinfection of touchpoints", "Disinfezione approfondita dei punti di contatto", "Desinfección a fondo de puntos de contacto"],
    "Réassort des consommables sanitaires": ["Restocking toilet supplies", "Rifornimento dei materiali per i servizi", "Reposición de consumibles de aseo"],
    "Désinfection des cabinets (table d'examen, surfaces)": ["Disinfecting consulting rooms (examination table, surfaces)", "Disinfezione degli ambulatori (lettino, superfici)", "Desinfección de consultas (camilla, superficies)"],
    "Désinfection des appareils de sport": ["Disinfecting gym equipment", "Disinfezione degli attrezzi sportivi", "Desinfección de aparatos deportivos"],
    "Vestiaires et douches": ["Changing rooms and showers", "Spogliatoi e docce", "Vestuarios y duchas"],
    "Dépoussiérage des rayonnages de stockage": ["Dusting storage racks", "Spolveratura delle scaffalature", "Quitar el polvo de estanterías de almacén"],
    "Quais de chargement et allées de circulation": ["Loading bays and aisles", "Banchine di carico e corsie", "Muelles de carga y pasillos"],
    "Établis et postes d'atelier": ["Workbenches and workstations", "Banchi e postazioni d'officina", "Bancos y puestos de taller"],
    "Toiles d'araignées et hauteurs accessibles": ["Cobwebs and accessible high areas", "Ragnatele e parti alte accessibili", "Telarañas y zonas altas accesibles"],
    "Évacuation des cartons et déchets légers (sacs)": ["Removal of boxes and light waste (bags)", "Smaltimento di cartoni e rifiuti leggeri (sacchi)", "Retirada de cajas y residuos ligeros (bolsas)"],
    "Sortie et lavage des conteneurs poubelles": ["Taking out and washing bins", "Uscita e lavaggio dei bidoni", "Sacar y lavar los contenedores"],
    "Remise en état des locaux": ["Premises restoration", "Ripristino dei locali", "Puesta a punto de los locales"],
    "Hall, escaliers, paliers, rampes": ["Hall, stairs, landings, handrails", "Atrio, scale, pianerottoli, corrimano", "Vestíbulo, escaleras, rellanos, barandillas"],
    "Résidence services (seniors, étudiants)": ["Serviced residence (seniors, students)", "Residenza con servizi (anziani, studenti)", "Residencia con servicios (mayores, estudiantes)"],
    "Vitrerie du hall et porte d'entrée": ["Hall glazing and front door", "Vetrate dell'atrio e porta d'ingresso", "Cristales del vestíbulo y puerta de entrada"],
    "Boîtes aux lettres et interphone": ["Letterboxes and intercom", "Cassette delle lettere e citofono", "Buzones e interfono"],
    "Paillasson et sas": ["Doormat and lobby", "Zerbino e bussola", "Felpudo y vestíbulo"],
    "Lavage des escaliers": ["Washing the stairs", "Lavaggio delle scale", "Fregado de escaleras"],
    "Rampes, mains courantes et interrupteurs (désinfection)": ["Rails, handrails and switches (disinfection)", "Ringhiere, corrimano e interruttori (disinfezione)", "Barandillas, pasamanos e interruptores (desinfección)"],
    "Ascenseur (cabine, miroirs, seuils)": ["Lift (car, mirrors, thresholds)", "Ascensore (cabina, specchi, soglie)", "Ascensor (cabina, espejos, umbrales)"],
    "Portes palières et plinthes": ["Landing doors and skirting", "Porte di pianerottolo e battiscopa", "Puertas de rellano y rodapiés"],
    "Toiles d'araignées et hauteurs": ["Cobwebs and high areas", "Ragnatele e parti alte", "Telarañas y zonas altas"],
    "Local poubelles (lavage, désinfection)": ["Bin store (washing, disinfection)", "Locale rifiuti (lavaggio, disinfezione)", "Cuarto de basuras (lavado, desinfección)"],
    "Sortie et rentrée des conteneurs": ["Taking bins out and in", "Uscita e rientro dei bidoni", "Sacar y entrar los contenedores"],
    "Local vélos et poussettes": ["Bike and pram store", "Locale bici e passeggini", "Cuarto de bicis y carritos"],
    "Couloirs de caves": ["Cellar corridors", "Corridoi delle cantine", "Pasillos de trasteros"],
    "Balayage mécanisé du parking": ["Machine sweeping of the car park", "Spazzatura meccanizzata del parcheggio", "Barrido mecanizado del aparcamiento"],
    "Traitement des taches d'huile": ["Oil stain treatment", "Trattamento delle macchie d'olio", "Tratamiento de manchas de aceite"],
    "Rampes d'accès et caniveaux": ["Access ramps and gutters", "Rampe d'accesso e canaline", "Rampas de acceso y canaletas"],
    "Vitres, faces intérieure et extérieure accessibles": ["Windows, accessible inside and outside faces", "Vetri, lati interno ed esterno accessibili", "Cristales, caras interior y exterior accesibles"],
    "Encadrements et rebords": ["Frames and sills", "Telai e davanzali", "Marcos y alféizares"],
    "Rails de baie vitrée": ["Sliding door tracks", "Binari della vetrata", "Carriles del ventanal"],
    "Moustiquaires": ["Insect screens", "Zanzariere", "Mosquiteras"],
    "Retrait d'étiquettes et adhésifs": ["Removing labels and adhesives", "Rimozione di etichette e adesivi", "Retirada de etiquetas y adhesivos"],
    "Enseigne et lettrage de vitrine": ["Sign and window lettering", "Insegna e scritte della vetrina", "Rótulo y letras del escaparate"],
    "Toiture de véranda (côté intérieur ou accès sécurisé)": ["Conservatory roof (inside or secure access)", "Tetto della veranda (lato interno o accesso sicuro)", "Techo del porche acristalado (interior o acceso seguro)"],
    "Volets et persiennes": ["Shutters and louvres", "Persiane e scuri", "Contraventanas y persianas"],
    "Stores intérieurs": ["Interior blinds", "Tende interne", "Estores interiores"],
    "Rideau métallique (face extérieure)": ["Roller shutter (outside face)", "Saracinesca (lato esterno)", "Persiana metálica (cara exterior)"],
    "Vitrages en hauteur (perche à eau pure, jusqu'à 6 m)": ["High glazing (pure-water pole, up to 6 m)", "Vetrate in altezza (asta ad acqua pura, fino a 6 m)", "Cristales en altura (pértiga de agua pura, hasta 6 m)"],
    "Balayage et lavage des sols": ["Sweeping and washing the floors", "Spazzatura e lavaggio dei pavimenti", "Barrido y fregado de suelos"],
    "Cour d'immeuble / parking extérieur": ["Building courtyard / outdoor car park", "Cortile condominiale / parcheggio esterno", "Patio del edificio / aparcamiento exterior"],
    "Plages et margelles": ["Pool deck and coping", "Bordi e solarium", "Playas y bordillos"],
    "Nettoyage haute pression des sols": ["High-pressure floor cleaning", "Pulizia ad alta pressione dei pavimenti", "Limpieza a alta presión de suelos"],
    "Démoussage et traitement anti-mousse": ["Moss removal and anti-moss treatment", "Rimozione del muschio e trattamento antimuschio", "Eliminación de musgo y tratamiento antimusgo"],
    "Joints de dallage": ["Paving joints", "Fughe della pavimentazione", "Juntas del enlosado"],
    "Taches d'huile et de rouille": ["Oil and rust stains", "Macchie d'olio e di ruggine", "Manchas de aceite y óxido"],
    "Mobilier de jardin": ["Garden furniture", "Mobili da giardino", "Muebles de jardín"],
    "Garde-corps et vitrages de balcon": ["Balcony railings and glazing", "Parapetti e vetrate del balcone", "Barandillas y cristales del balcón"],
    "Barbecue et plancha": ["Barbecue and griddle", "Barbecue e piastra", "Barbacoa y plancha"],
    "Gouttières basses (accessibles depuis le sol)": ["Low gutters (reachable from the ground)", "Grondaie basse (raggiungibili da terra)", "Canalones bajos (accesibles desde el suelo)"],
    "Toiles d'araignées et recoins": ["Cobwebs and corners", "Ragnatele e angoli", "Telarañas y rincones"],
    "Rangement et tri du garage": ["Tidying and sorting the garage", "Riordino e smistamento del garage", "Orden y clasificación del garaje"],
    "Ramassage des feuilles": ["Leaf collection", "Raccolta delle foglie", "Recogida de hojas"],
    "Évacuation des déchets verts (sacs)": ["Removal of green waste (bags)", "Smaltimento dei rifiuti verdi (sacchi)", "Retirada de restos vegetales (bolsas)"],
    "Évacuation des encombrants légers (sacs)": ["Removal of light bulky items (bags)", "Smaltimento di ingombranti leggeri (sacchi)", "Retirada de enseres ligeros (bolsas)"],
    "Salle, sols, tables, sanitaires": ["Hall, floors, tables, toilets", "Sala, pavimenti, tavoli, servizi", "Sala, suelos, mesas, aseos"],
    "Pièces de réception, cuisine, sanitaires": ["Reception rooms, kitchen, toilets", "Sale di ricevimento, cucina, servizi", "Salones, cocina, aseos"],
    "Séminaire / événement d'entreprise": ["Seminar / corporate event", "Seminario / evento aziendale", "Seminario / evento de empresa"],
    "Anniversaire / fête en salle": ["Birthday / party in a hall", "Compleanno / festa in sala", "Cumpleaños / fiesta en salón"],
    "Passage terminé avant le début": ["Visit finished before the start", "Passaggio terminato prima dell'inizio", "Visita terminada antes del inicio"],
    "Passage à partir de la fin": ["Visit from the end", "Passaggio a partire dalla fine", "Visita a partir del final"],
    "Un passage avant le début, un autre à partir de la fin": ["One visit before the start, another from the end", "Un passaggio prima dell'inizio, un altro dalla fine", "Una visita antes del inicio y otra a partir del final"],
    "Tables et chaises": ["Tables and chairs", "Tavoli e sedie", "Mesas y sillas"],
    "Sols : taches de boissons et piétinement": ["Floors: drink stains and foot traffic", "Pavimenti: macchie di bevande e calpestio", "Suelos: manchas de bebidas y pisadas"],
    "Extérieurs (mégots, confettis)": ["Outdoors (cigarette ends, confetti)", "Esterni (mozziconi, coriandoli)", "Exteriores (colillas, confeti)"],
    "Vaisselle et verrerie (par tranche de 50 convives)": ["Dishes and glassware (per 50 guests)", "Stoviglie e bicchieri (ogni 50 invitati)", "Vajilla y cristalería (por cada 50 invitados)"],
    "Cuisine traiteur / office": ["Caterer's kitchen / pantry", "Cucina del catering / office", "Cocina del catering / office"],
    "Cuisine de la maison": ["Home kitchen", "Cucina di casa", "Cocina de la casa"],
    "Ramassage et tri des déchets": ["Collecting and sorting waste", "Raccolta e smistamento dei rifiuti", "Recogida y clasificación de residuos"],
    "Évacuation des déchets (sacs)": ["Removal of waste (bags)", "Smaltimento dei rifiuti (sacchi)", "Retirada de residuos (bolsas)"],
    "Passage sanitaires pendant l'événement": ["Toilet check during the event", "Passaggio nei servizi durante l'evento", "Repaso de aseos durante el evento"],
    "Évaluation sur place, protocole et produits adaptés": ["On-site assessment, suitable protocol and products", "Valutazione sul posto, protocollo e prodotti adatti", "Evaluación in situ, protocolo y productos adecuados"],
    "Logement très encombré ou insalubre": ["Very cluttered or unsanitary home", "Alloggio molto ingombro o insalubre", "Vivienda muy abarrotada o insalubre"],
    "Visite d'évaluation, tri, désencombrement et nettoyage": ["Assessment visit, sorting, decluttering and cleaning", "Sopralluogo, smistamento, sgombero e pulizia", "Visita de evaluación, clasificación, vaciado y limpieza"],
    "Après sinistre (dégât des eaux, suies)": ["After a disaster (water damage, soot)", "Dopo un sinistro (danni d'acqua, fuliggine)", "Tras un siniestro (daños por agua, hollín)"],
    "Évaluation des dégâts, nettoyage des surfaces et des suies": ["Damage assessment, cleaning of surfaces and soot", "Valutazione dei danni, pulizia di superfici e fuliggine", "Evaluación de daños, limpieza de superficies y hollín"],
    "Intervention discrète, désinfection et remise en état": ["Discreet intervention, disinfection and restoration", "Intervento discreto, disinfezione e ripristino", "Intervención discreta, desinfección y puesta a punto"],
    "Intervention planifiée": ["Planned intervention", "Intervento programmato", "Intervención planificada"],
    "Visite d'évaluation, puis devis détaillé": ["Assessment visit, then a detailed quote", "Sopralluogo, poi preventivo dettagliato", "Visita de evaluación y después presupuesto detallado"],
    "Intervention urgente": ["Urgent intervention", "Intervento urgente", "Intervención urgente"],
    "Prise de contact prioritaire, évaluation sous 48 h": ["Priority contact, assessment within 48 h", "Contatto prioritario, valutazione entro 48 h", "Contacto prioritario, evaluación en 48 h"],
  // </rubriques-noms>
  },
};

/** Remplace, dans le catalogue chargé, les textes français par ceux de la langue choisie. */
export function traduireCatalogue(RUBRIQUES, TYPES_LIEU, formulesPour) {
  if (IDX === undefined) return;
  const n = s => (C.noms[s] ? C.noms[s][IDX] : s);
  for (const r of RUBRIQUES) {
    const t = C.rubriques[r.id]?.[IDX];
    if (t) { r.nom = t[0]; r.sousTitre = t[1]; if (t[2]) r.inclus = t[2]; }
    for (const f of r.formules) { f.nom = n(f.nom); f.description = n(f.description); }
    for (const x of r.taches) x.nom = n(x.nom);
    for (const p of r.packs) p.nom = n(p.nom);
  }
  for (const liste of Object.values(TYPES_LIEU)) for (const l of liste) l.nom = n(l.nom);
  // Les formules par défaut (créées à la demande) sont traduites à l'affichage : leurs noms rejoignent le dictionnaire.
  for (const [fr, tr] of Object.entries(C.noms)) if (!DICO.has(fr)) DICO.set(fr, tr[IDX]);
  PHRASES = null;
}

/* ------------------------------------------------------------------ Sélecteur de langue à drapeaux */
/** Menu des langues : le drapeau de la langue choisie, les 4 drapeaux au clic (prend peu de place dans l'en-tête). */
export function selecteurLangue() {
  return `<details class="langues"><summary aria-label="Langue / Language" title="Langue / Language"><span class="drapeau choisi">${LANGUES[langue].drapeau}</span><span class="code">${langue.toUpperCase()}</span></summary>
    <div class="menu-langues" role="group" aria-label="Langue / Language">${Object.entries(LANGUES).map(([code, l]) =>
    `<button type="button" class="${code === langue ? "choisi" : ""}" data-langue="${code}" aria-pressed="${code === langue}"><span class="drapeau">${l.drapeau}</span>${l.nom}</button>`).join("")}</div></details>`;
}
// Garde : ce fichier est aussi chargé par le serveur (fonction « paiement »), où il n'y a pas de page.
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-langue]");
    if (b && b.dataset.langue !== langue) choisirLangue(b.dataset.langue);
  });
  document.documentElement.lang = langue;
}
