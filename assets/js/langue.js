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
  const n = (navigator.language || "fr").slice(0, 2);
  return LANGUES[n] ? n : "fr";
}
export const langue = detecter();
export function choisirLangue(l) {
  try { localStorage.setItem(CLE, l); } catch { /* rien */ }
  location.reload();
}
const IDX = { en: 0, it: 1, es: 2 }[langue];

/* ------------------------------------------------------------------ Textes de l'interface : [français, anglais, italien, espagnol] */
const T = [
  // En-tête, navigation, pied de page
  ["Prestations", "Services", "Servizi", "Servicios"],
  ["Comment ça marche", "How it works", "Come funziona", "Cómo funciona"],
  ["Comment ça marche ?", "How does it work?", "Come funziona?", "¿Cómo funciona?"],
  ["Devenir Cleaneur", "Become a Cleaneur", "Diventa Cleaneur", "Hazte Cleaneur"],
  ["Mes demandes", "My requests", "Le mie richieste", "Mis solicitudes"],
  ["Estimer mon prix", "Get my price", "Calcola il prezzo", "Calcular mi precio"],
  ["Je m'inscris", "Sign up", "Iscriviti", "Inscribirme"],
  ["Je m'inscris ›", "Sign up ›", "Iscriviti ›", "Inscribirme ›"],
  ["Menu", "Menu", "Menu", "Menú"],
  ["Navigation principale", "Main navigation", "Navigazione principale", "Navegación principal"],
  ["Cleaneroo, accueil", "Cleaneroo, home", "Cleaneroo, home", "Cleaneroo, inicio"],
  ["Confidentialité", "Privacy", "Privacy", "Privacidad"],
  ["Conditions d'utilisation", "Terms of use", "Condizioni d'uso", "Condiciones de uso"],
  ["Mentions légales", "Legal notice", "Note legali", "Aviso legal"],
  ["Bientôt disponible sur", "Coming soon on", "Presto disponibile su", "Muy pronto en"],
  ["Vos interventions de ménage, 100 % digitalisées", "Your cleaning services, 100% digital", "I tuoi interventi di pulizia, 100% digitali", "Tus servicios de limpieza, 100 % digitales"],
  ["Vos interventions de ménage, 100 % digitalisées.", "Your cleaning services, 100% digital.", "I tuoi interventi di pulizia, 100% digitali.", "Tus servicios de limpieza, 100 % digitales."],
  ["Cleaneroo · Vos interventions de ménage, 100 % digitalisées", "Cleaneroo · Your cleaning services, 100% digital", "Cleaneroo · I tuoi interventi di pulizia, 100% digitali", "Cleaneroo · Tus servicios de limpieza, 100 % digitales"],
  ["Éponge Cleaneroo", "Cleaneroo sponge", "Spugna Cleaneroo", "Esponja Cleaneroo"],

  // Lancement et inscription
  ["Lancement le 31 décembre 2026", "Launching on 31 December 2026", "Lancio il 31 dicembre 2026", "Lanzamiento el 31 de diciembre de 2026"],
  ["Soyez prêts pour une nouvelle dimension du nettoyage, 100 % digitalisé.", "Get ready for a new dimension of cleaning, 100% digital.", "Preparatevi a una nuova dimensione della pulizia, 100% digitale.", "Preparaos para una nueva dimensión de la limpieza, 100 % digital."],
  ["Je m'inscris pour le lancement", "Sign up for the launch", "Iscriviti per il lancio", "Inscríbete para el lanzamiento"],
  ["Inscrivez-vous pour le lancement", "Sign up for the launch", "Iscriviti per il lancio", "Inscríbete para el lanzamiento"],
  ["Ouverture le", "Opening on", "Apertura il", "Apertura el"],
  ["31 décembre 2026", "31 December 2026", "31 dicembre 2026", "31 de diciembre de 2026"],
  ["Les premiers inscrits sont prévenus en priorité.", "The first to sign up are notified first.", "I primi iscritti saranno avvisati per primi.", "Los primeros inscritos serán avisados con prioridad."],
  ["Je cherche un nettoyage", "I need a cleaning", "Cerco una pulizia", "Busco una limpieza"],
  ["Je veux devenir Cleaneur", "I want to become a Cleaneur", "Voglio diventare Cleaneur", "Quiero ser Cleaneur"],
  ["Je gère des locations / une conciergerie", "I manage rentals / a concierge service", "Gestisco affitti / una concierge", "Gestiono alquileres / una conserjería"],
  ["Prénom", "First name", "Nome", "Nombre"],
  ["Nom", "Last name", "Cognome", "Apellidos"],
  ["E-mail", "Email", "E-mail", "Correo electrónico"],
  ["Téléphone", "Phone", "Telefono", "Teléfono"],
  ["Téléphone (facultatif)", "Phone (optional)", "Telefono (facoltativo)", "Teléfono (opcional)"],
  ["Code postal", "Postcode", "CAP", "Código postal"],
  ["Ville", "City", "Città", "Ciudad"],
  ["Un message ? (facultatif)", "A message? (optional)", "Un messaggio? (facoltativo)", "¿Un mensaje? (opcional)"],
  ["Ex. : 3 appartements Airbnb à Fréjus", "E.g. 3 Airbnb flats in Fréjus", "Es.: 3 appartamenti Airbnb a Fréjus", "Ej.: 3 apartamentos Airbnb en Fréjus"],
  ["J'accepte d'être contacté par Cleaneroo pour le lancement.", "I agree to be contacted by Cleaneroo about the launch.", "Accetto di essere contattato da Cleaneroo per il lancio.", "Acepto que Cleaneroo me contacte para el lanzamiento."],
  ["Indiquez votre prénom.", "Please enter your first name.", "Inserisci il tuo nome.", "Indica tu nombre."],
  ["Adresse e-mail invalide.", "Invalid email address.", "Indirizzo e-mail non valido.", "Correo electrónico no válido."],
  ["Code postal à 5 chiffres.", "5-digit postcode.", "CAP di 5 cifre.", "Código postal de 5 cifras."],
  ["Cochez la case pour que nous puissions vous prévenir.", "Tick the box so we can let you know.", "Spunta la casella per essere avvisato.", "Marca la casilla para que podamos avisarte."],
  ["Inscription…", "Signing up…", "Iscrizione…", "Inscribiendo…"],
  ["L'inscription n'a pas abouti. Vérifiez votre connexion et réessayez.", "Sign-up failed. Check your connection and try again.", "Iscrizione non riuscita. Controlla la connessione e riprova.", "La inscripción no se ha completado. Comprueba tu conexión e inténtalo de nuevo."],
  ["Merci, vous êtes inscrit ✓", "Thank you, you're signed up ✓", "Grazie, sei iscritto ✓", "Gracias, ya estás inscrito ✓"],
  ["Vous êtes déjà inscrit ✓", "You're already signed up ✓", "Sei già iscritto ✓", "Ya estás inscrito ✓"],
  ["Nous vous préviendrons avant l'ouverture du", "We'll let you know before the opening on", "Ti avviseremo prima dell'apertura del", "Te avisaremos antes de la apertura del"],

  // Accueil
  ["Ménage, vitres, canapés, bureaux… un Cleaneur vérifié près de chez vous.", "Cleaning, windows, sofas, offices… a verified Cleaneur near you.", "Pulizie, vetri, divani, uffici… un Cleaneur verificato vicino a te.", "Limpieza, cristales, sofás, oficinas… un Cleaneur verificado cerca de ti."],
  ["Réservation", "Booking", "Prenotazione", "Reserva"],
  ["Suivi en direct", "Live tracking", "Monitoraggio in diretta", "Seguimiento en directo"],
  ["Compte rendu photo", "Photo report", "Report fotografico", "Informe con fotos"],
  ["Réserver un nettoyage", "Book a cleaning", "Prenota una pulizia", "Reservar una limpieza"],
  ["Réserver maintenant", "Book now", "Prenota ora", "Reservar ahora"],
  ["Nos prestations", "Our services", "I nostri servizi", "Nuestros servicios"],
  ["Le prix s'affiche dès que vous décrivez votre besoin.", "The price appears as soon as you describe your needs.", "Il prezzo appare appena descrivi la tua esigenza.", "El precio aparece en cuanto describes lo que necesitas."],
  ["Voir les 13 prestations ›", "See all 13 services ›", "Vedi i 13 servizi ›", "Ver los 13 servicios ›"],
  ["Le propre, à moitié prix.", "Clean, at half price.", "Il pulito, a metà prezzo.", "Limpio, a mitad de precio."],
  ["50 % de crédit d'impôt sur le ménage à domicile, déduit tout de suite avec l'avance immédiate.", "50% French tax credit on home cleaning, deducted straight away with the immediate advance scheme.", "50% di credito d'imposta francese sulle pulizie a domicilio, detratto subito con l'anticipo immediato.", "50 % de crédito fiscal francés en la limpieza a domicilio, descontado al momento con el anticipo inmediato."],
  ["Du clic à la validation, tout se passe en ligne.", "From click to sign-off, everything happens online.", "Dal clic alla convalida, tutto avviene online.", "Del clic a la validación, todo ocurre en línea."],
  ["Ménage", "Home cleaning", "Pulizie", "Limpieza"],
  ["Ponctuel ou régulier", "One-off or regular", "Occasionale o regolare", "Puntual o regular"],
  ["Entre deux voyageurs", "Between two guests", "Tra due ospiti", "Entre dos huéspedes"],
  ["Canapé", "Sofa", "Divano", "Sofá"],
  ["Shampoing, détachage", "Shampoo, stain removal", "Shampoo, smacchiatura", "Champú, quitamanchas"],
  ["Vitres", "Windows", "Vetri", "Cristales"],
  ["Fenêtres et baies", "Windows and bay windows", "Finestre e vetrate", "Ventanas y ventanales"],
  ["Voiture", "Car", "Auto", "Coche"],
  ["Intérieur, extérieur — À la carte", "Inside, outside — à la carte", "Interno, esterno — à la carte", "Interior, exterior — a la carta"],
  ["Bureaux", "Offices", "Uffici", "Oficinas"],
  ["Locaux et commerces", "Premises and shops", "Locali e negozi", "Locales y comercios"],
  ["13 univers de nettoyage, un seul parcours de réservation.", "13 cleaning worlds, one booking journey.", "13 universi di pulizia, un unico percorso di prenotazione.", "13 universos de limpieza, un solo recorrido de reserva."],
  ["Sur devis", "On quotation", "Su preventivo", "Con presupuesto"],

  // Étapes
  ["ÉTAPE", "STEP", "PASSO", "PASO"],
  ["Réservez en 2 minutes", "Book in 2 minutes", "Prenota in 2 minuti", "Reserva en 2 minutos"],
  ["Choisissez la prestation, répondez à quelques questions, ajoutez des photos et choisissez votre créneau. Le prix s'affiche tout de suite.", "Choose the service, answer a few questions, add photos and pick your slot. The price appears straight away.", "Scegli il servizio, rispondi a qualche domanda, aggiungi foto e scegli la fascia oraria. Il prezzo appare subito.", "Elige el servicio, responde a unas preguntas, añade fotos y elige tu franja horaria. El precio aparece al momento."],
  ["Choisissez votre Cleaneur", "Choose your Cleaneur", "Scegli il tuo Cleaneur", "Elige a tu Cleaneur"],
  ["Des Cleaneurs vérifiés (identité, SIRET, assurance) se proposent. Comparez prix, note et distance : c'est vous qui choisissez.", "Verified Cleaneurs (ID, business number, insurance) apply. Compare price, rating and distance: you choose.", "Cleaneur verificati (identità, partita IVA, assicurazione) si candidano. Confronta prezzo, voto e distanza: scegli tu.", "Cleaneurs verificados (identidad, número fiscal, seguro) se proponen. Compara precio, nota y distancia: tú eliges."],
  ["Suivez l'intervention en direct", "Follow the service live", "Segui l'intervento in diretta", "Sigue el servicio en directo"],
  ["« En route », arrivée confirmée par géolocalisation, selfie du jour : vous savez qui vient, et quand.", "\"On the way\", arrival confirmed by geolocation, daily selfie: you know who's coming, and when.", "«In arrivo», arrivo confermato dalla geolocalizzazione, selfie del giorno: sai chi viene, e quando.", "«En camino», llegada confirmada por geolocalización, selfie del día: sabes quién viene y cuándo."],
  ["Recevez le compte rendu", "Receive the report", "Ricevi il report", "Recibe el informe"],
  ["Tâches cochées et horodatées, photos avant / après, signature du Cleaneur : tout est dans votre espace.", "Ticked and time-stamped tasks, before/after photos, the Cleaneur's signature: it's all in your space.", "Compiti spuntati e con orario, foto prima/dopo, firma del Cleaneur: tutto nel tuo spazio.", "Tareas marcadas y con hora, fotos de antes y después, firma del Cleaneur: todo en tu espacio."],
  ["Validez, puis payez", "Approve, then pay", "Convalida, poi paga", "Valida y luego paga"],
  ["Vous n'êtes débité qu'après avoir validé. Crédit d'impôt de 50 % déduit tout de suite ; pourboire et avis si vous le souhaitez.", "You're only charged after you approve. 50% tax credit deducted straight away; tip and review if you wish.", "Paghi solo dopo aver convalidato. Credito d'imposta del 50% detratto subito; mancia e recensione se vuoi.", "Solo se te cobra después de validar. Crédito fiscal del 50 % descontado al momento; propina y opinión si quieres."],
  ["Côté Cleaneur", "For Cleaneurs", "Lato Cleaneur", "Para el Cleaneur"],
  ["Je pars, puis j'arrive (géolocalisé) · Selfie du jour · Tâches et photos guidées · Signature et compte rendu · Paiement après validation.", "On my way, then arrived (geolocated) · Daily selfie · Guided tasks and photos · Signature and report · Payment after approval.", "Parto, poi arrivo (geolocalizzato) · Selfie del giorno · Compiti e foto guidati · Firma e report · Pagamento dopo la convalida.", "Salgo y llego (geolocalizado) · Selfie del día · Tareas y fotos guiadas · Firma e informe · Pago tras la validación."],
  ["Vos garanties", "Your guarantees", "Le tue garanzie", "Tus garantías"],
  ["Débit seulement après validation · Garantie Cleaneroo · Crédit d'impôt de 50 % · Cleaneurs vérifiés · Annulation gratuite jusqu'à 48 h avant.", "Charged only after approval · Cleaneroo Guarantee · 50% tax credit · Verified Cleaneurs · Free cancellation up to 48 h before.", "Addebito solo dopo la convalida · Garanzia Cleaneroo · Credito d'imposta del 50% · Cleaneur verificati · Annullamento gratuito fino a 48 h prima.", "Cobro solo tras la validación · Garantía Cleaneroo · Crédito fiscal del 50 % · Cleaneurs verificados · Cancelación gratuita hasta 48 h antes."],
  ["Affiche « Comment ça marche ? »", "\"How does it work?\" poster", "Poster «Come funziona?»", "Cartel «¿Cómo funciona?»"],

  // Devenir Cleaneur
  ["Travaillez à votre rythme, près de chez vous.", "Work at your own pace, close to home.", "Lavora con i tuoi ritmi, vicino a casa.", "Trabaja a tu ritmo, cerca de casa."],
  ["Missions proches", "Nearby jobs", "Missioni vicine", "Misiones cercanas"],
  ["Compte rendu guidé", "Guided report", "Report guidato", "Informe guiado"],
  ["Paiement sécurisé", "Secure payment", "Pagamento sicuro", "Pago seguro"],
  ["Avoir un statut d'indépendant", "Be self-employed", "Essere lavoratore autonomo", "Ser trabajador autónomo"],
  ["Préparer vos documents (pièce d'identité, SIRET, RC Pro, attestation de vigilance URSSAF)", "Prepare your documents (ID, SIRET number, professional liability insurance, URSSAF certificate)", "Prepara i documenti (documento d'identità, SIRET, RC professionale, attestato URSSAF)", "Prepara tus documentos (documento de identidad, SIRET, seguro de responsabilidad civil, certificado URSSAF)"],
  ["Déposer votre dossier (zone, prestations ; chaque document vérifié avant activation)", "Submit your application (area, services; every document checked before activation)", "Invia la tua candidatura (zona, servizi; ogni documento verificato prima dell'attivazione)", "Envía tu solicitud (zona, servicios; cada documento verificado antes de la activación)"],
  ["Suivre la charte qualité", "Follow the quality charter", "Seguire la carta della qualità", "Seguir la carta de calidad"],
  ["Choisir vos missions (prix et horaires proposés, libre d'accepter)", "Choose your jobs (price and times offered, free to accept)", "Scegliere le missioni (prezzo e orari proposti, libero di accettare)", "Elegir tus misiones (precio y horarios propuestos, libre de aceptar)"],
  ["Être payé (validation client → commission prélevée → versement)", "Get paid (client approval → commission deducted → payout)", "Essere pagato (convalida del cliente → commissione trattenuta → versamento)", "Cobrar (validación del cliente → comisión descontada → pago)"],

  // Pages légales
  ["Cleaneroo collecte uniquement les informations nécessaires à votre demande de nettoyage : nom, coordonnées, adresse d'intervention, description du besoin, photos que vous ajoutez et créneau choisi.", "Cleaneroo only collects the information needed for your cleaning request: name, contact details, service address, description of your needs, photos you add and chosen time slot.", "Cleaneroo raccoglie solo le informazioni necessarie alla tua richiesta di pulizia: nome, recapiti, indirizzo dell'intervento, descrizione dell'esigenza, foto che aggiungi e fascia oraria scelta.", "Cleaneroo solo recoge la información necesaria para tu solicitud de limpieza: nombre, datos de contacto, dirección del servicio, descripción de la necesidad, fotos que añades y franja elegida."],
  ["Ces informations servent à trouver un Cleaneur, à organiser l'intervention et à vous en rendre compte. Elles ne sont jamais vendues ni utilisées pour de la publicité. Les données sont hébergées dans l'Union européenne.", "This information is used to find a Cleaneur, organise the service and report back to you. It is never sold or used for advertising. Data is hosted in the European Union.", "Queste informazioni servono a trovare un Cleaneur, organizzare l'intervento e darti un resoconto. Non sono mai vendute né usate per pubblicità. I dati sono ospitati nell'Unione europea.", "Esta información sirve para encontrar un Cleaneur, organizar el servicio e informarte. Nunca se vende ni se usa para publicidad. Los datos se alojan en la Unión Europea."],
  ["Le code d'accès à votre logement n'est communiqué qu'au Cleaneur retenu, le jour de l'intervention.", "The access code to your home is only shared with the chosen Cleaneur, on the day of the service.", "Il codice d'accesso alla tua casa è comunicato solo al Cleaneur scelto, il giorno dell'intervento.", "El código de acceso a tu vivienda solo se comunica al Cleaneur elegido, el día del servicio."],
  ["Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données en écrivant à", "You can ask at any time to access, correct or delete your data by writing to", "Puoi chiedere in qualsiasi momento l'accesso, la correzione o la cancellazione dei tuoi dati scrivendo a", "Puedes pedir en cualquier momento el acceso, la rectificación o la supresión de tus datos escribiendo a"],
  [". Les factures sont conservées le temps imposé par la loi.", ". Invoices are kept for the period required by law.", ". Le fatture sono conservate per il tempo previsto dalla legge.", ". Las facturas se conservan el tiempo que exige la ley."],
  ["Le site n'utilise ni traceur publicitaire ni cookie de mesure d'audience.", "The site uses no advertising trackers or analytics cookies.", "Il sito non usa tracciatori pubblicitari né cookie di misurazione dell'audience.", "El sitio no usa rastreadores publicitarios ni cookies de medición de audiencia."],
  ["Cleaneroo met en relation des clients et des Cleaneurs indépendants vérifiés. Rien n'est ajouté à votre commande sans votre accord ; vous n'êtes débité qu'après avoir validé le compte rendu de l'intervention.", "Cleaneroo connects clients with verified independent Cleaneurs. Nothing is added to your order without your consent; you are only charged after approving the service report.", "Cleaneroo mette in contatto clienti e Cleaneur indipendenti verificati. Nulla viene aggiunto al tuo ordine senza il tuo consenso; paghi solo dopo aver convalidato il report dell'intervento.", "Cleaneroo pone en contacto a clientes con Cleaneurs independientes verificados. No se añade nada a tu pedido sin tu acuerdo; solo se te cobra tras validar el informe del servicio."],
  ["Annulation gratuite jusqu'à 48 h avant l'intervention, puis 25 % du prix accepté. Un litige ou une déclaration de dommage (Garantie Cleaneroo) peut être ouvert dans les 48 h suivant l'intervention.", "Free cancellation up to 48 h before the service, then 25% of the agreed price. A dispute or damage claim (Cleaneroo Guarantee) can be opened within 48 h after the service.", "Annullamento gratuito fino a 48 h prima dell'intervento, poi il 25% del prezzo accettato. Una contestazione o una denuncia di danno (Garanzia Cleaneroo) può essere aperta entro 48 h dall'intervento.", "Cancelación gratuita hasta 48 h antes del servicio; después, el 25 % del precio aceptado. Una reclamación o declaración de daños (Garantía Cleaneroo) puede abrirse en las 48 h siguientes al servicio."],
  ["Le prix affiché est une estimation : le montant final ne peut pas la dépasser sans votre accord.", "The price shown is an estimate: the final amount cannot exceed it without your consent.", "Il prezzo indicato è una stima: l'importo finale non può superarla senza il tuo consenso.", "El precio mostrado es una estimación: el importe final no puede superarla sin tu acuerdo."],
  ["Éditeur :", "Publisher:", "Editore:", "Editor:"],
  ["Contact :", "Contact:", "Contatto:", "Contacto:"],
  ["Hébergement :", "Hosting:", "Hosting:", "Alojamiento:"],
  ["Nom de domaine :", "Domain name:", "Nome di dominio:", "Nombre de dominio:"],
  ["GitHub Pages (GitHub, Inc.) ; données de réservation hébergées dans l'Union européenne.", "GitHub Pages (GitHub, Inc.); booking data hosted in the European Union.", "GitHub Pages (GitHub, Inc.); dati di prenotazione ospitati nell'Unione europea.", "GitHub Pages (GitHub, Inc.); datos de reserva alojados en la Unión Europea."],
  ["cleaneroo.fr, enregistré chez IONOS.", "cleaneroo.fr, registered with IONOS.", "cleaneroo.fr, registrato presso IONOS.", "cleaneroo.fr, registrado en IONOS."],
  ["Cleaneroo — [raison sociale, adresse et numéro SIRET à compléter].", "Cleaneroo — [company name, address and SIRET number to be completed].", "Cleaneroo — [ragione sociale, indirizzo e numero SIRET da completare].", "Cleaneroo — [razón social, dirección y número SIRET por completar]."],

  // Mes demandes / suivi
  ["Aucune demande depuis ce navigateur.", "No requests from this browser.", "Nessuna richiesta da questo browser.", "Ninguna solicitud desde este navegador."],
  ["Vous avez réservé depuis un autre appareil ? Ouvrez le lien de suivi reçu après la réservation : la demande s'ajoutera ici.", "Booked from another device? Open the tracking link you received after booking: the request will be added here.", "Hai prenotato da un altro dispositivo? Apri il link di monitoraggio ricevuto dopo la prenotazione: la richiesta comparirà qui.", "¿Has reservado desde otro dispositivo? Abre el enlace de seguimiento recibido tras la reserva: la solicitud aparecerá aquí."],
  ["Flexible (7 jours)", "Flexible (7 days)", "Flessibile (7 giorni)", "Flexible (7 días)"],
  ["Demande introuvable", "Request not found", "Richiesta non trovata", "Solicitud no encontrada"],
  ["Ce lien de suivi n'est pas valable. Vérifiez qu'il est complet.", "This tracking link is not valid. Check that it is complete.", "Questo link di monitoraggio non è valido. Verifica che sia completo.", "Este enlace de seguimiento no es válido. Comprueba que esté completo."],
  ["En cours de vérification", "Being checked", "In verifica", "En revisión"],
  ["En ligne · candidatures", "Online · applications", "Online · candidature", "En línea · candidaturas"],
  ["Confirmée", "Confirmed", "Confermata", "Confirmada"],
  ["Cleaneur en route", "Cleaneur on the way", "Cleaneur in arrivo", "Cleaneur en camino"],
  ["Cleaneur sur place", "Cleaneur on site", "Cleaneur sul posto", "Cleaneur en el lugar"],
  ["En cours", "In progress", "In corso", "En curso"],
  ["À valider", "To approve", "Da convalidare", "Por validar"],
  ["Terminée", "Completed", "Completata", "Terminada"],
  ["Annulée", "Cancelled", "Annullata", "Cancelada"],
  ["Nous vérifions votre demande. Ensuite, les Cleaneurs compatibles sont prévenus.", "We're checking your request. Then matching Cleaneurs are notified.", "Stiamo verificando la tua richiesta. Poi i Cleaneur compatibili saranno avvisati.", "Estamos revisando tu solicitud. Después avisaremos a los Cleaneurs compatibles."],
  ["Pré-réservation enregistrée. Les réservations ouvrent le 31 décembre 2026 : nous vous recontacterons pour fixer le créneau, en priorité.", "Pre-booking saved. Bookings open on 31 December 2026: we'll contact you first to set the time slot.", "Pre-prenotazione registrata. Le prenotazioni aprono il 31 dicembre 2026: ti ricontatteremo con priorità per fissare l'orario.", "Prerreserva registrada. Las reservas abren el 31 de diciembre de 2026: te contactaremos con prioridad para fijar la franja horaria."],
  ["Votre demande est en ligne : les Cleaneurs compatibles peuvent se proposer. Vous choisirez parmi leurs propositions.", "Your request is online: matching Cleaneurs can apply. You'll choose among their offers.", "La tua richiesta è online: i Cleaneur compatibili possono candidarsi. Sceglierai tra le loro proposte.", "Tu solicitud está en línea: los Cleaneurs compatibles pueden proponerse. Elegirás entre sus propuestas."],
  ["Votre nettoyage est réservé. Vous serez prévenu quand le Cleaneur sera en route.", "Your cleaning is booked. You'll be notified when the Cleaneur is on the way.", "La tua pulizia è prenotata. Sarai avvisato quando il Cleaneur sarà in arrivo.", "Tu limpieza está reservada. Te avisaremos cuando el Cleaneur esté en camino."],
  ["La prestation est terminée : consultez le compte rendu et validez-le.", "The service is complete: check the report and approve it.", "Il servizio è terminato: consulta il report e convalidalo.", "El servicio ha terminado: consulta el informe y valídalo."],
  ["Prestation terminée et validée. Merci de votre confiance !", "Service completed and approved. Thank you for your trust!", "Servizio terminato e convalidato. Grazie per la fiducia!", "Servicio terminado y validado. ¡Gracias por tu confianza!"],
  ["Cette demande est annulée. Aucun débit n'a été effectué.", "This request is cancelled. No charge has been made.", "Questa richiesta è annullata. Nessun addebito effettuato.", "Esta solicitud está cancelada. No se ha realizado ningún cobro."],
  ["Intervention en cours, suivez-la ici en direct.", "Service in progress, follow it live here.", "Intervento in corso, seguilo qui in diretta.", "Servicio en curso, síguelo aquí en directo."],
  ["Quand :", "When:", "Quando:", "Cuándo:"],
  ["Où :", "Where:", "Dove:", "Dónde:"],
  ["Durée estimée :", "Estimated duration:", "Durata stimata:", "Duración estimada:"],
  ["Prix :", "Price:", "Prezzo:", "Precio:"],
  ["Choix du Cleaneur :", "Choice of Cleaneur:", "Scelta del Cleaneur:", "Elección del Cleaneur:"],
  ["parmi les candidatures", "from applications", "tra le candidature", "entre las candidaturas"],
  ["réservation directe", "direct booking", "prenotazione diretta", "reserva directa"],
  ["sur devis", "on quotation", "su preventivo", "con presupuesto"],
  ["Flexible, candidatures sur 7 jours", "Flexible, applications over 7 days", "Flessibile, candidature su 7 giorni", "Flexible, candidaturas durante 7 días"],
  ["Votre lien de suivi", "Your tracking link", "Il tuo link di monitoraggio", "Tu enlace de seguimiento"],
  ["Gardez-le : il permet de suivre et d'annuler votre demande depuis n'importe quel appareil.", "Keep it: it lets you track and cancel your request from any device.", "Conservalo: ti permette di seguire e annullare la richiesta da qualsiasi dispositivo.", "Guárdalo: te permite seguir y cancelar tu solicitud desde cualquier dispositivo."],
  ["Copier le lien", "Copy link", "Copia il link", "Copiar el enlace"],
  ["Lien copié ✓", "Link copied ✓", "Link copiato ✓", "Enlace copiado ✓"],
  ["Annuler la demande", "Cancel request", "Annulla la richiesta", "Cancelar la solicitud"],
  ["Annulation gratuite : aucun Cleaneur n'est encore confirmé.", "Free cancellation: no Cleaneur has been confirmed yet.", "Annullamento gratuito: nessun Cleaneur è ancora confermato.", "Cancelación gratuita: todavía no hay ningún Cleaneur confirmado."],

  // Réservation : structure
  ["Réserver un nettoyage", "Book a cleaning", "Prenota una pulizia", "Reservar una limpieza"],
  ["Choisissez votre prestation : le prix s'affiche dès que vous décrivez votre besoin.", "Choose your service: the price appears as soon as you describe your needs.", "Scegli il servizio: il prezzo appare appena descrivi la tua esigenza.", "Elige tu servicio: el precio aparece en cuanto describes lo que necesitas."],
  ["Pour qui ?", "For whom?", "Per chi?", "¿Para quién?"],
  ["Personnel", "Personal", "Personale", "Particular"],
  ["Professionnel", "Business", "Professionale", "Profesional"],
  ["Votre prestation", "Your service", "Il tuo servizio", "Tu servicio"],
  ["Décrivez le besoin", "Describe your needs", "Descrivi l'esigenza", "Describe lo que necesitas"],
  ["Votre besoin", "Your needs", "La tua esigenza", "Lo que necesitas"],
  ["Interventions réalisées par des professionnels qualifiés et équipés, sur devis après évaluation. La désinsectisation et la dératisation relèvent d'entreprises certifiées et ne sont pas proposées.", "Carried out by qualified, equipped professionals, on quotation after assessment. Pest control and rodent control require certified companies and are not offered.", "Interventi eseguiti da professionisti qualificati e attrezzati, su preventivo dopo valutazione. Disinfestazione e derattizzazione spettano a imprese certificate e non sono offerte.", "Servicios realizados por profesionales cualificados y equipados, con presupuesto tras evaluación. La desinsectación y la desratización corresponden a empresas certificadas y no se ofrecen."],
  ["Type de logement", "Type of home", "Tipo di alloggio", "Tipo de vivienda"],
  ["Type de lieu", "Type of place", "Tipo di luogo", "Tipo de lugar"],
  ["Gabarit du véhicule", "Vehicle size", "Dimensioni del veicolo", "Tamaño del vehículo"],
  ["Type de sol", "Type of floor", "Tipo di pavimento", "Tipo de suelo"],
  ["Type d'établissement", "Type of establishment", "Tipo di struttura", "Tipo de establecimiento"],
  ["Choisissez votre formule", "Choose your package", "Scegli la tua formula", "Elige tu fórmula"],
  ["Inclus dans votre forfait", "Included in your package", "Incluso nella tua formula", "Incluido en tu fórmula"],
  ["Dimensions", "Size", "Dimensioni", "Dimensiones"],
  ["Nombre de fenêtres", "Number of windows", "Numero di finestre", "Número de ventanas"],
  ["Surface des tapis", "Rug area", "Superficie dei tappeti", "Superficie de alfombras"],
  ["Surface", "Area", "Superficie", "Superficie"],
  ["Chambres", "Bedrooms", "Camere", "Dormitorios"],
  ["Salles de bain", "Bathrooms", "Bagni", "Baños"],
  ["Niveaux", "Floors", "Piani", "Plantas"],
  ["+15 min par niveau supplémentaire", "+15 min per extra floor", "+15 min per piano in più", "+15 min por planta adicional"],
  ["Au-delà de 300 m² : devis obligatoire.", "Over 300 m²: quotation required.", "Oltre 300 m²: preventivo obbligatorio.", "Más de 300 m²: presupuesto obligatorio."],
  ["Étapes à valider en photo", "Steps to confirm by photo", "Passaggi da convalidare con foto", "Pasos a validar con foto"],
  ["Étapes (pack conseillé : 8)", "Steps (recommended pack: 8)", "Passaggi (pacchetto consigliato: 8)", "Pasos (pack recomendado: 8)"],
  ["Une étape « Chambre » est répétée par chambre, « Salle de bain » par salle de bain.", "A \"Bedroom\" step is repeated for each bedroom, \"Bathroom\" for each bathroom.", "Un passaggio «Camera» si ripete per ogni camera, «Bagno» per ogni bagno.", "Un paso «Dormitorio» se repite por dormitorio, «Baño» por baño."],
  ["Consommables à contrôler", "Supplies to check", "Materiali di consumo da controllare", "Consumibles a revisar"],
  ["Café, papier toilette, savon, liquide vaisselle, sacs poubelle (+10 min)", "Coffee, toilet paper, soap, washing-up liquid, bin bags (+10 min)", "Caffè, carta igienica, sapone, detersivo per piatti, sacchi spazzatura (+10 min)", "Café, papel higiénico, jabón, lavavajillas, bolsas de basura (+10 min)"],
  ["Le Cleaneur n'apporte jamais de consommables : ils doivent être sur place.", "The Cleaneur never brings supplies: they must be on site.", "Il Cleaneur non porta mai materiali di consumo: devono essere sul posto.", "El Cleaneur nunca lleva consumibles: deben estar en el lugar."],
  ["État de saleté", "How dirty is it?", "Livello di sporco", "Nivel de suciedad"],
  ["Fin de chantier : jamais « standard ». Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.", "After building work: never \"standard\". The level of dirt will be assessed once all photos are usable.", "Fine cantiere: mai «standard». Il livello di sporco sarà stimato appena tutte le foto saranno utilizzabili.", "Fin de obra: nunca «estándar». El nivel de suciedad se estimará cuando todas las fotos sean utilizables."],
  ["Tâches complémentaires", "Extra tasks", "Compiti aggiuntivi", "Tareas adicionales"],
  ["Nos formules", "Our packages", "Le nostre formule", "Nuestras fórmulas"],
  ["La remise s'applique tant que toutes les tâches de la formule restent cochées. Une seule formule remisée par demande.", "The discount applies as long as all the package's tasks stay ticked. One discounted package per request.", "Lo sconto si applica finché tutti i compiti della formula restano spuntati. Una sola formula scontata per richiesta.", "El descuento se aplica mientras todas las tareas de la fórmula sigan marcadas. Una sola fórmula con descuento por solicitud."],
  ["Une autre demande ?", "Anything else?", "Un'altra richiesta?", "¿Otra petición?"],
  ["Ex. : nettoyer la cage du lapin", "E.g. clean the rabbit's cage", "Es.: pulire la gabbia del coniglio", "Ej.: limpiar la jaula del conejo"],
  ["Ajouter", "Add", "Aggiungi", "Añadir"],
  ["Retirer", "Remove", "Rimuovi", "Quitar"],
  ["Chaque tâche particulière compte 15 min dans l'estimation ; le Cleaneur la confirme.", "Each special task counts as 15 min in the estimate; the Cleaneur confirms it.", "Ogni compito particolare vale 15 min nella stima; il Cleaneur lo conferma.", "Cada tarea especial cuenta 15 min en la estimación; el Cleaneur la confirma."],
  ["Des animaux vivent dans le logement", "Pets live in the home", "In casa vivono animali", "Hay animales en la vivienda"],
  ["Durée d'engagement", "Commitment period", "Durata dell'impegno", "Duración del compromiso"],
  ["Sans engagement", "No commitment", "Senza impegno", "Sin compromiso"],
  ["3 mois −5 %", "3 months −5%", "3 mesi −5%", "3 meses −5 %"],
  ["6 mois −10 %", "6 months −10%", "6 mesi −10%", "6 meses −10 %"],
  ["12 mois −15 %", "12 months −15%", "12 mesi −15%", "12 meses −15 %"],
  ["Plus vous vous engagez, moins chaque passage vous coûte. Le même Cleaneur à chaque passage, si possible.", "The longer you commit, the less each visit costs. The same Cleaneur every time, where possible.", "Più ti impegni, meno costa ogni passaggio. Lo stesso Cleaneur a ogni passaggio, se possibile.", "Cuanto más te comprometes, menos cuesta cada visita. El mismo Cleaneur en cada visita, si es posible."],
  ["Choisissez votre besoin.", "Choose your need.", "Scegli la tua esigenza.", "Elige lo que necesitas."],
  ["Photos et précisions", "Photos and details", "Foto e dettagli", "Fotos y detalles"],
  ["Photos obligatoires pour cette prestation : elles permettent d'estimer le travail.", "Photos are required for this service: they help estimate the work.", "Foto obbligatorie per questo servizio: permettono di stimare il lavoro.", "Fotos obligatorias para este servicio: permiten estimar el trabajo."],
  ["Facultatif, mais les photos aident le Cleaneur à bien préparer l'intervention.", "Optional, but photos help the Cleaneur prepare properly.", "Facoltativo, ma le foto aiutano il Cleaneur a preparare bene l'intervento.", "Opcional, pero las fotos ayudan al Cleaneur a preparar bien el servicio."],
  ["Vos photos", "Your photos", "Le tue foto", "Tus fotos"],
  ["+ Ajouter des photos", "+ Add photos", "+ Aggiungi foto", "+ Añadir fotos"],
  ["12 photos maximum. Elles sont réduites avant l'envoi.", "12 photos maximum. They are resized before sending.", "Massimo 12 foto. Vengono ridotte prima dell'invio.", "12 fotos como máximo. Se reducen antes del envío."],
  ["Une précision pour le Cleaneur ?", "A note for the Cleaneur?", "Una precisazione per il Cleaneur?", "¿Una indicación para el Cleaneur?"],
  ["Ex. : arrivée des voyageurs à 16 h", "E.g. guests arrive at 4 pm", "Es.: arrivo degli ospiti alle 16", "Ej.: llegada de los huéspedes a las 16 h"],
  ["Ajoutez au moins une photo.", "Add at least one photo.", "Aggiungi almeno una foto.", "Añade al menos una foto."],
  ["Adresse et créneau", "Address and time slot", "Indirizzo e orario", "Dirección y franja horaria"],
  ["Adresse de l'intervention", "Service address", "Indirizzo dell'intervento", "Dirección del servicio"],
  ["Adresse", "Address", "Indirizzo", "Dirección"],
  ["Elle sert au calcul du déplacement et à l'arrivée du Cleaneur.", "It's used to work out travel and for the Cleaneur's arrival.", "Serve a calcolare lo spostamento e per l'arrivo del Cleaneur.", "Sirve para calcular el desplazamiento y para la llegada del Cleaneur."],
  ["Accès au lieu", "Access to the place", "Accesso al luogo", "Acceso al lugar"],
  ["Je serai présent", "I'll be there", "Sarò presente", "Estaré presente"],
  ["Concierge / tiers", "Concierge / third party", "Portiere / terzi", "Conserje / tercero"],
  ["Boîte à clés", "Key box", "Cassetta delle chiavi", "Caja de llaves"],
  ["Accès autonome", "Self access", "Accesso autonomo", "Acceso autónomo"],
  ["Nom de la personne", "Person's name", "Nome della persona", "Nombre de la persona"],
  ["Son téléphone", "Their phone", "Il suo telefono", "Su teléfono"],
  ["Emplacement de la boîte à clés", "Key box location", "Posizione della cassetta delle chiavi", "Ubicación de la caja de llaves"],
  ["Code de la boîte", "Box code", "Codice della cassetta", "Código de la caja"],
  ["Code ou instructions d'accès", "Access code or instructions", "Codice o istruzioni d'accesso", "Código o instrucciones de acceso"],
  ["Le code n'est communiqué qu'au Cleaneur retenu, le jour de l'intervention.", "The code is only shared with the chosen Cleaneur, on the day of the service.", "Il codice è comunicato solo al Cleaneur scelto, il giorno dell'intervento.", "El código solo se comunica al Cleaneur elegido, el día del servicio."],
  ["Chez les professionnels, une personne doit être présente pour accueillir le Cleaneur.", "At business premises, someone must be there to welcome the Cleaneur.", "Presso i professionisti, una persona deve essere presente per accogliere il Cleaneur.", "En locales profesionales, alguien debe estar presente para recibir al Cleaneur."],
  ["Créneau", "Time slot", "Orario", "Franja horaria"],
  ["Je suis flexible", "I'm flexible", "Sono flessibile", "Soy flexible"],
  ["Vous recevez des candidatures sur 7 jours", "You receive applications over 7 days", "Ricevi candidature per 7 giorni", "Recibes candidaturas durante 7 días"],
  ["Choisissez un jour.", "Choose a day.", "Scegli un giorno.", "Elige un día."],
  ["Bordure verte : créneau malin, −10 %. Dimanche : +25 %.", "Green border: smart slot, −10%. Sunday: +25%.", "Bordo verde: fascia conveniente, −10%. Domenica: +25%.", "Borde verde: franja inteligente, −10 %. Domingo: +25 %."],
  ["Créneau malin −10 %", "Smart slot −10%", "Fascia conveniente −10%", "Franja inteligente −10 %"],
  ["Forte demande", "High demand", "Forte domanda", "Alta demanda"],
  ["Peu de disponibilités", "Limited availability", "Poca disponibilità", "Poca disponibilidad"],
  ["Indiquez l'adresse complète.", "Enter the full address.", "Inserisci l'indirizzo completo.", "Indica la dirección completa."],
  ["Indiquez comment le Cleaneur accède au lieu.", "Say how the Cleaneur gets in.", "Indica come il Cleaneur accede al luogo.", "Indica cómo accede el Cleaneur al lugar."],
  ["Choisissez un créneau.", "Choose a time slot.", "Scegli un orario.", "Elige una franja horaria."],
  ["Les réservations ouvrent le", "Bookings open on", "Le prenotazioni aprono il", "Las reservas abren el"],
  [". Envoyez votre pré-réservation dès maintenant : nous vous recontacterons en priorité pour fixer le créneau.", ". Send your pre-booking now: we'll contact you first to set the time slot.", ". Invia subito la tua pre-prenotazione: ti ricontatteremo con priorità per fissare l'orario.", ". Envía tu prerreserva ahora: te contactaremos con prioridad para fijar la franja horaria."],
  ["Votre estimation", "Your estimate", "La tua stima", "Tu estimación"],
  ["Lancement le 31 décembre 2026.", "Launching on 31 December 2026.", "Lancio il 31 dicembre 2026.", "Lanzamiento el 31 de diciembre de 2026."],
  ["Votre pré-réservation est gratuite et sans engagement.", "Your pre-booking is free and without commitment.", "La tua pre-prenotazione è gratuita e senza impegno.", "Tu prerreserva es gratuita y sin compromiso."],
  ["Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.", "A qualified professional assesses your needs and sends you a quotation. No commitment.", "Un professionista qualificato valuta la tua esigenza e ti propone un preventivo. Nessun impegno.", "Un profesional cualificado evalúa tu necesidad y te propone un presupuesto. Sin compromiso."],
  ["Total estimé", "Estimated total", "Totale stimato", "Total estimado"],
  ["Après crédit d'impôt (50 %)", "After tax credit (50%)", "Dopo il credito d'imposta (50%)", "Tras el crédito fiscal (50 %)"],
  ["Prix approximatif : le montant final ne peut pas le dépasser sans votre accord.", "Approximate price: the final amount cannot exceed it without your consent.", "Prezzo indicativo: l'importo finale non può superarlo senza il tuo consenso.", "Precio aproximado: el importe final no puede superarlo sin tu acuerdo."],
  ["Au-delà de 6 h de travail, la mission est confiée à 2 Cleaneurs.", "Over 6 hours of work, the job goes to 2 Cleaneurs.", "Oltre 6 ore di lavoro, la missione è affidata a 2 Cleaneur.", "Más de 6 h de trabajo: la misión se confía a 2 Cleaneurs."],
  ["50 % des dépenses pour les prestations éligibles réalisées à votre domicile (résidence principale ou secondaire), dans la limite des plafonds légaux (12 000 € par an, majorés dans certains cas).", "50% of spending on eligible services at your home (main or second residence), within legal limits (€12,000 a year, higher in some cases). French tax residents only.", "50% delle spese per i servizi idonei svolti a casa tua (residenza principale o secondaria), nei limiti di legge (12.000 € l'anno, maggiorati in alcuni casi). Solo per residenti fiscali in Francia.", "50 % del gasto en servicios elegibles realizados en tu domicilio (residencia principal o secundaria), dentro de los límites legales (12 000 € al año, ampliados en algunos casos). Solo residentes fiscales en Francia."],
  ["Comment choisir votre Cleaneur ?", "How to choose your Cleaneur?", "Come scegliere il tuo Cleaneur?", "¿Cómo elegir a tu Cleaneur?"],
  ["Je choisis parmi les candidatures", "I choose from the applications", "Scelgo tra le candidature", "Elijo entre las candidaturas"],
  ["Les Cleaneurs vous proposent un horaire et un prix. Vous êtes prévenu à chaque candidature et vous choisissez.", "Cleaneurs offer you a time and a price. You're notified of each application and you choose.", "I Cleaneur ti propongono un orario e un prezzo. Sei avvisato a ogni candidatura e scegli tu.", "Los Cleaneurs te proponen un horario y un precio. Te avisamos de cada candidatura y tú eliges."],
  ["Réservation directe", "Direct booking", "Prenotazione diretta", "Reserva directa"],
  ["Le premier Cleaneur qui se positionne au prix estimé, sans frais supplémentaire, obtient la mission.", "The first Cleaneur to accept at the estimated price, with no extra cost, gets the job.", "Il primo Cleaneur che si propone al prezzo stimato, senza costi aggiuntivi, ottiene la missione.", "El primer Cleaneur que acepta al precio estimado, sin coste adicional, obtiene la misión."],
  ["Aucun Cleaneur n'est accepté automatiquement sans votre choix.", "No Cleaneur is ever accepted automatically without your choice.", "Nessun Cleaneur viene accettato automaticamente senza la tua scelta.", "Ningún Cleaneur se acepta automáticamente sin tu elección."],
  ["Vos coordonnées", "Your contact details", "I tuoi recapiti", "Tus datos de contacto"],
  ["Aucun paiement maintenant : vous ne serez débité qu'après avoir validé la prestation. Annulation gratuite jusqu'à 48 h avant ; ensuite 25 % du prix accepté.", "No payment now: you'll only be charged after approving the service. Free cancellation up to 48 h before; then 25% of the agreed price.", "Nessun pagamento ora: ti sarà addebitato solo dopo aver convalidato il servizio. Annullamento gratuito fino a 48 h prima; poi il 25% del prezzo accettato.", "Ningún pago ahora: solo se te cobrará tras validar el servicio. Cancelación gratuita hasta 48 h antes; después, el 25 % del precio aceptado."],
  ["J'accepte les", "I accept the", "Accetto le", "Acepto las"],
  ["conditions d'utilisation", "terms of use", "condizioni d'uso", "condiciones de uso"],
  ["et la", "and the", "e la", "y la"],
  ["politique de confidentialité", "privacy policy", "informativa sulla privacy", "política de privacidad"],
  ["Complétez vos coordonnées.", "Complete your contact details.", "Completa i tuoi recapiti.", "Completa tus datos de contacto."],
  ["Acceptez les conditions pour envoyer la demande.", "Accept the terms to send the request.", "Accetta le condizioni per inviare la richiesta.", "Acepta las condiciones para enviar la solicitud."],
  ["Envoyer ma demande", "Send my request", "Invia la mia richiesta", "Enviar mi solicitud"],
  ["Envoyer ma pré-réservation", "Send my pre-booking", "Invia la mia pre-prenotazione", "Enviar mi prerreserva"],
  ["Envoi en cours…", "Sending…", "Invio in corso…", "Enviando…"],
  ["Continuer", "Continue", "Continua", "Continuar"],
  ["‹ Retour", "‹ Back", "‹ Indietro", "‹ Atrás"],
  ["‹ Prestations", "‹ Services", "‹ Servizi", "‹ Servicios"],
  ["Moins", "Less", "Meno", "Menos"],
  ["Plus", "More", "Più", "Más"],
  ["Léger", "Light", "Leggero", "Ligero"],
  ["Normal", "Normal", "Normale", "Normal"],
  ["Marqué", "Noticeable", "Evidente", "Marcado"],
  ["Intense", "Heavy", "Intenso", "Intenso"],
  ["Déplacement", "Travel", "Spostamento", "Desplazamiento"],
  ["inclus", "included", "incluso", "incluido"],
  ["à confirmer", "to be confirmed", "da confermare", "por confirmar"],
  ["Complément minimum de commande", "Minimum order top-up", "Integrazione ordine minimo", "Complemento de pedido mínimo"],
  ["Désinfection approfondie", "Deep disinfection", "Disinfezione approfondita", "Desinfección a fondo"],
  ["Logement très encombré", "Very cluttered home", "Alloggio molto ingombro", "Vivienda muy abarrotada"],
  ["Après sinistre", "After a disaster (fire, flood)", "Dopo un sinistro", "Tras un siniestro"],
  ["Nettoyage après décès", "Cleaning after a death", "Pulizia dopo un decesso", "Limpieza tras un fallecimiento"],
  ["créneau fixé à l'ouverture", "time slot set at opening", "orario fissato all'apertura", "franja fijada en la apertura"],
  ["flexible", "flexible", "flessibile", "flexible"],
  ["Annuler cette demande ? Aucun frais ne sera appliqué.", "Cancel this request? No fee will be charged.", "Annullare questa richiesta? Nessun costo sarà applicato.", "¿Cancelar esta solicitud? No se aplicará ningún cargo."],
  ["L'envoi n'a pas abouti", "Sending failed", "Invio non riuscito", "El envío ha fallado"],
  ["Vérifiez votre connexion et réessayez.", "Check your connection and try again.", "Controlla la connessione e riprova.", "Comprueba tu conexión e inténtalo de nuevo."],
  ["Studio", "Studio", "Monolocale", "Estudio"],
  ["Appartement", "Flat", "Appartamento", "Piso"],
  ["Maison", "House", "Casa", "Casa"],
  ["Duplex / loft", "Duplex / loft", "Duplex / loft", "Dúplex / loft"],
];

const DICO = new Map();
if (IDX !== undefined) for (const l of T) DICO.set(l[0], l[IDX + 1]);
// Phrases longues cherchées aussi à l'intérieur des textes composés (ex. « Ouverture le … . Soyez prêts … »).
let PHRASES = null;

/* ------------------------------------------------------------------ Textes avec une partie variable */
export const LOCALE = { fr: "fr-FR", en: "en-GB", it: "it-IT", es: "es-ES" }[langue];
const MOTIFS = IDX === undefined ? [] : [
  [/^Étape (\d+) sur (\d+)$/, (m, a, b) => [`Step ${a} of ${b}`, `Passo ${a} di ${b}`, `Paso ${a} de ${b}`][IDX]],
  [/^Total estimé (.+)$/, (m, p) => [`Estimated total ${p}`, `Totale stimato ${p}`, `Total estimado ${p}`][IDX]],
  [/^ÉTAPE (\d+)$/, (m, n) => [`STEP ${n}`, `PASSO ${n}`, `PASO ${n}`][IDX]],
  [/^dès (.+) \/ h$/, (m, p) => [`from ${p} / h`, `da ${p} / h`, `desde ${p} / h`][IDX]],
  [/^Réf\. (.+)$/, (m, r) => [`Ref. ${r}`, `Rif. ${r}`, `Ref. ${r}`][IDX]],
  [/^estimé (.+)$/, (m, p) => [`estimated ${p}`, `stimato ${p}`, `estimado ${p}`][IDX]],
  [/^Remise pack \(−(\d+) %\)$/, (m, n) => [`Package discount (−${n}%)`, `Sconto formula (−${n}%)`, `Descuento de fórmula (−${n} %)`][IDX]],
  [/^Majoration dimanche \(\+(\d+) %\)$/, (m, n) => [`Sunday surcharge (+${n}%)`, `Maggiorazione domenica (+${n}%)`, `Recargo dominical (+${n} %)`][IDX]],
  [/^Créneau malin \(−(\d+) %\)$/, (m, n) => [`Smart slot (−${n}%)`, `Fascia conveniente (−${n}%)`, `Franja inteligente (−${n} %)`][IDX]],
  [/^Engagement (\d+) mois \(−(\d+) %\)$/, (m, a, b) => [`${a}-month commitment (−${b}%)`, `Impegno ${a} mesi (−${b}%)`, `Compromiso de ${a} meses (−${b} %)`][IDX]],
  [/^Tâches particulières \((\d+)\)$/, (m, n) => [`Special tasks (${n})`, `Compiti particolari (${n})`, `Tareas especiales (${n})`][IDX]],
  [/^Salissure (.+) \(\+(\d+) %\)$/, (m, s, n) => [`Dirt level ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n}%)`, `Sporco ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n}%)`, `Suciedad ${traduireTexte(s[0].toUpperCase() + s.slice(1)).toLowerCase()} (+${n} %)`][IDX]],
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
export function traduire(racine = document.body) {
  if (IDX === undefined) return;
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && !["SCRIPT", "STYLE", "TEXTAREA"].includes(n.parentNode.nodeName) ? 1 : 2 });
  const noeuds = []; while (w.nextNode()) noeuds.push(w.currentNode);
  for (const n of noeuds) { const t = traduireTexte(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
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
    moving: [["Moving and restoration", "A fresh start, floor to ceiling", "Full clean of the empty home. Cleaning only: Cleaneroo does no painting, filling or repairs."], ["Trasloco e ripristino", "Un nuovo inizio, dal pavimento al soffitto", "Pulizia completa dell'alloggio vuoto. Solo pulizia: Cleaneroo non fa pittura, stuccatura né riparazioni."], ["Mudanza y puesta a punto", "Un nuevo comienzo, del suelo al techo", "Limpieza completa de la vivienda vacía. Solo limpieza: Cleaneroo no hace pintura, masilla ni reparaciones."]],
    car: [["Vehicles", "Interior and exterior cleaning", "100% à la carte: choose your tasks."], ["Veicoli", "Pulizia interna ed esterna", "100% à la carte: scegli i compiti."], ["Vehículos", "Limpieza interior y exterior", "100 % a la carta: elige las tareas."]],
    textiles: [["Sofas and textiles", "Sofas, mattresses and rugs"], ["Divani e tessili", "Divani, materassi e tappeti"], ["Sofás y textiles", "Sofás, colchones y alfombras"]],
    construction: [["After building work", "Get rid of dust after works"], ["Fine cantiere", "Eliminare la polvere dopo i lavori"], ["Fin de obra", "Eliminar el polvo tras las obras"]],
    kitchen: [["Kitchens", "Deep cleaning and degreasing"], ["Cucine", "Pulizia profonda e sgrassatura"], ["Cocinas", "Limpieza a fondo y desengrase"]],
    office: [["Offices and shops", "Clean, welcoming premises"], ["Uffici e negozi", "Locali puliti e accoglienti"], ["Oficinas y comercios", "Locales limpios y acogedores"]],
    communal: [["Communal areas", "Stairs, halls and shared spaces"], ["Parti comuni", "Scale, ingressi e spazi comuni"], ["Zonas comunes", "Escaleras, vestíbulos y espacios comunes"]],
    windows: [["Windows and shopfronts", "Windows, shopfronts and conservatories"], ["Vetri e vetrine", "Finestre, vetrine e verande"], ["Cristales y escaparates", "Ventanas, escaparates y porches"]],
    outdoor: [["Outdoor areas", "Terraces, balconies and garages"], ["Spazi esterni", "Terrazze, balconi e garage"], ["Espacios exteriores", "Terrazas, balcones y garajes"]],
    event: [["Before and after events", "Enjoy your event to the full"], ["Prima e dopo l'evento", "Goditi appieno il tuo evento"], ["Antes y después de eventos", "Disfruta plenamente de tu evento"]],
    special: [["Specialist services", "Assessed by a qualified professional"], ["Servizi specializzati", "Una valutazione da un professionista qualificato"], ["Servicios especializados", "Una evaluación por un profesional cualificado"]],
  },
  // Noms simples (formules, tâches, lieux, packs) : français → [anglais, italien, espagnol]
  noms: {
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
export function selecteurLangue() {
  return `<div class="langues" role="group" aria-label="Langue / Language">${Object.entries(LANGUES).map(([code, l]) =>
    `<button type="button" class="drapeau ${code === langue ? "choisi" : ""}" data-langue="${code}" title="${l.nom}" aria-label="${l.nom}" aria-pressed="${code === langue}">${l.drapeau}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-langue]");
  if (b && b.dataset.langue !== langue) choisirLangue(b.dataset.langue);
});
document.documentElement.lang = langue;
