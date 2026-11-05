// Villes des pages « Ménage à … » (/menage/<slug>/). Pages générées par outils/generer_pages.py à partir de cette liste.
// Le bloc entre les marqueurs est du JSON strict : le script de génération le lit tel quel.
// texte : paragraphe local propre à chaque ville, dans les 4 langues [fr, en, it, es] (aucun chiffre local inventé).
export const VILLES = /* <villes> */ [
  {
    "nom": "Fréjus", "slug": "frejus", "codePostal": "83600", "departement": "Var",
    "voisines": ["Saint-Raphaël", "Puget-sur-Argens", "Roquebrune-sur-Argens", "Les Adrets-de-l'Estérel"],
    "texte": [
      "Entre la base nature, Port-Fréjus et les quartiers résidentiels de Saint-Aygulf, Fréjus mêle résidences principales et appartements loués à la semaine l'été. Cleaneroo s'adapte aux deux : ménage régulier pour votre logement, rotation rapide entre deux voyageurs pour votre location, avec un compte rendu photo à chaque passage.",
      "Between the nature base, Port-Fréjus and the residential areas of Saint-Aygulf, Fréjus mixes main homes and flats rented by the week in summer. Cleaneroo adapts to both: regular cleaning for your home, a quick turnover between two guests for your rental, with a photo report every time.",
      "Tra la base nature, Port-Fréjus e i quartieri residenziali di Saint-Aygulf, Fréjus unisce abitazioni principali e appartamenti affittati a settimana in estate. Cleaneroo si adatta a entrambi: pulizia regolare per la tua casa, cambio rapido tra due ospiti per il tuo affitto, con un resoconto fotografico a ogni passaggio.",
      "Entre la base nature, Port-Fréjus y los barrios residenciales de Saint-Aygulf, Fréjus combina viviendas principales y apartamentos alquilados por semanas en verano. Cleaneroo se adapta a ambos: limpieza regular para tu vivienda, cambio rápido entre dos huéspedes para tu alquiler, con un informe fotográfico en cada visita."
    ]
  },
  {
    "nom": "Saint-Raphaël", "slug": "saint-raphael", "codePostal": "83700", "departement": "Var",
    "voisines": ["Fréjus", "Agay", "Boulouris", "Puget-sur-Argens"],
    "texte": [
      "Du centre-ville au bord de mer jusqu'aux calanques d'Agay et de Boulouris, Saint-Raphaël compte de nombreuses résidences secondaires et villas fermées une partie de l'année. Avant votre arrivée ou après le départ de vos locataires, un Cleaneur vérifié remet le logement en état et vous envoie les photos.",
      "From the town centre by the sea to the coves of Agay and Boulouris, Saint-Raphaël has many second homes and villas closed part of the year. Before you arrive or after your tenants leave, a verified Cleaneur gets the home ready and sends you the photos.",
      "Dal centro sul mare fino alle calanche di Agay e Boulouris, Saint-Raphaël conta molte seconde case e ville chiuse per parte dell'anno. Prima del tuo arrivo o dopo la partenza degli inquilini, un Cleaneur verificato rimette in ordine l'alloggio e ti invia le foto.",
      "Del centro junto al mar hasta las calas de Agay y Boulouris, Saint-Raphaël cuenta con muchas segundas residencias y villas cerradas parte del año. Antes de tu llegada o tras la salida de tus inquilinos, un Cleaneur verificado deja la vivienda lista y te envía las fotos."
    ]
  },
  {
    "nom": "Sainte-Maxime", "slug": "sainte-maxime", "codePostal": "83120", "departement": "Var",
    "voisines": ["Grimaud", "Le Plan-de-la-Tour", "Saint-Tropez", "Les Issambres"],
    "texte": [
      "Face au golfe de Saint-Tropez, Sainte-Maxime vit au rythme des saisons : appartements de vacances, villas sur les hauteurs et locations courtes qui s'enchaînent en été. Pour les propriétaires et les conciergeries, le ménage entre deux séjours se réserve en quelques clics, avec linge, consommables et contrôle photo.",
      "Facing the Gulf of Saint-Tropez, Sainte-Maxime lives to the rhythm of the seasons: holiday flats, villas on the hills and short stays one after another in summer. For owners and concierge services, cleaning between two stays is booked in a few clicks, with linen, supplies and photo check.",
      "Di fronte al golfo di Saint-Tropez, Sainte-Maxime vive al ritmo delle stagioni: appartamenti per le vacanze, ville sulle colline e affitti brevi che si susseguono in estate. Per proprietari e conciergerie, la pulizia tra due soggiorni si prenota in pochi clic, con biancheria, materiali di consumo e controllo fotografico.",
      "Frente al golfo de Saint-Tropez, Sainte-Maxime vive al ritmo de las temporadas: apartamentos vacacionales, villas en las colinas y estancias cortas que se suceden en verano. Para propietarios y conserjerías, la limpieza entre dos estancias se reserva en unos clics, con ropa de cama, consumibles y control fotográfico."
    ]
  },
  {
    "nom": "Cannes", "slug": "cannes", "codePostal": "06400", "departement": "Alpes-Maritimes",
    "voisines": ["Le Cannet", "Mandelieu-la-Napoule", "Mougins", "Vallauris"],
    "texte": [
      "À Cannes, les congrès et les festivals remplissent les appartements loués à la nuit plusieurs fois par an, en plus de la saison d'été. Quand les arrivées s'enchaînent, la réservation directe permet de confier le ménage au premier Cleaneur disponible au prix affiché, et le suivi en direct vous dit quand le logement est prêt.",
      "In Cannes, conferences and festivals fill flats rented by the night several times a year, on top of the summer season. When arrivals follow one another, direct booking hands the cleaning to the first available Cleaneur at the price shown, and live tracking tells you when the home is ready.",
      "A Cannes, congressi e festival riempiono più volte l'anno gli appartamenti affittati a notte, oltre alla stagione estiva. Quando gli arrivi si susseguono, la prenotazione diretta affida la pulizia al primo Cleaneur disponibile al prezzo indicato, e il monitoraggio in diretta ti dice quando l'alloggio è pronto.",
      "En Cannes, los congresos y festivales llenan varias veces al año los apartamentos alquilados por noches, además de la temporada de verano. Cuando las llegadas se encadenan, la reserva directa confía la limpieza al primer Cleaneur disponible al precio indicado, y el seguimiento en directo te avisa cuando la vivienda está lista."
    ]
  },
  {
    "nom": "Antibes", "slug": "antibes", "codePostal": "06600", "departement": "Alpes-Maritimes",
    "voisines": ["Juan-les-Pins", "Biot", "Vallauris", "Villeneuve-Loubet"],
    "texte": [
      "D'Antibes à Juan-les-Pins et au cap, on trouve aussi bien des appartements de vieille ville que des villas avec terrasse et piscine. Cleaneroo couvre le ménage intérieur, les vitres et baies vitrées, mais aussi les terrasses et extérieurs, avec un prix affiché avant de réserver.",
      "From Antibes to Juan-les-Pins and the cape, you find old-town flats as well as villas with terraces and pools. Cleaneroo covers indoor cleaning, windows and bay windows, as well as terraces and outdoor areas, with a price shown before you book.",
      "Da Antibes a Juan-les-Pins e al capo si trovano sia appartamenti nel centro storico sia ville con terrazza e piscina. Cleaneroo si occupa della pulizia interna, dei vetri e delle vetrate, ma anche di terrazze e spazi esterni, con un prezzo indicato prima di prenotare.",
      "De Antibes a Juan-les-Pins y el cabo, hay tanto apartamentos en el casco antiguo como villas con terraza y piscina. Cleaneroo se encarga de la limpieza interior, los cristales y ventanales, y también de terrazas y exteriores, con un precio mostrado antes de reservar."
    ]
  },
  {
    "nom": "Nice", "slug": "nice", "codePostal": "06000", "departement": "Alpes-Maritimes",
    "voisines": ["Saint-Laurent-du-Var", "Villefranche-sur-Mer", "Cagnes-sur-Mer", "Saint-André-de-la-Roche"],
    "texte": [
      "À Nice, beaucoup d'appartements anciens sans ascenseur côtoient les locations meublées du Vieux-Nice et de la Promenade, louées toute l'année. Pour un ménage régulier comme pour une remise en état après un départ, vous décrivez le logement, le prix s'affiche, et vous ne payez qu'après avoir validé le compte rendu.",
      "In Nice, many older flats without a lift sit alongside furnished rentals in the Old Town and on the Promenade, let all year round. For regular cleaning or a full clean after someone moves out, you describe the home, the price appears, and you only pay once you have approved the report.",
      "A Nizza, molti appartamenti d'epoca senza ascensore convivono con gli affitti arredati della città vecchia e della Promenade, affittati tutto l'anno. Per una pulizia regolare o un ripristino dopo una partenza, descrivi l'alloggio, il prezzo appare e paghi solo dopo aver convalidato il resoconto.",
      "En Niza, muchos pisos antiguos sin ascensor conviven con los alquileres amueblados del casco antiguo y de la Promenade, alquilados todo el año. Para una limpieza regular o una puesta a punto tras una salida, describes la vivienda, aparece el precio y solo pagas después de validar el informe."
    ]
  },
  {
    "nom": "Draguignan", "slug": "draguignan", "codePostal": "83300", "departement": "Var",
    "voisines": ["Trans-en-Provence", "Les Arcs", "Flayosc", "Lorgues"],
    "texte": [
      "Dans la Dracénie, les maisons individuelles avec jardin sont nombreuses, tout comme les gîtes et mas loués aux vacanciers de l'arrière-pays. Cleaneroo propose le ménage de la maison, le nettoyage des extérieurs et la remise en état avant ou après un déménagement, réalisés par des Cleaneurs vérifiés du secteur.",
      "Around Draguignan, there are many detached houses with gardens, as well as gîtes and farmhouses rented to holidaymakers in the hinterland. Cleaneroo offers house cleaning, outdoor cleaning and a full clean before or after a move, carried out by verified local Cleaneurs.",
      "Nella zona di Draguignan sono numerose le case indipendenti con giardino, così come gli agriturismi e i casali affittati ai villeggianti dell'entroterra. Cleaneroo offre la pulizia della casa, degli spazi esterni e il ripristino prima o dopo un trasloco, eseguiti da Cleaneur verificati della zona.",
      "En la zona de Draguignan abundan las casas con jardín, así como las casas rurales y masías alquiladas a los veraneantes del interior. Cleaneroo ofrece la limpieza de la casa, de los exteriores y la puesta a punto antes o después de una mudanza, realizadas por Cleaneurs verificados de la zona."
    ]
  },
  {
    "nom": "Toulon", "slug": "toulon", "codePostal": "83000", "departement": "Var",
    "voisines": ["La Seyne-sur-Mer", "La Valette-du-Var", "Le Pradet", "Six-Fours-les-Plages"],
    "texte": [
      "À Toulon, entre le centre ancien, le Mourillon et les quartiers résidentiels, on trouve des logements familiaux, des appartements d'étudiants et de nombreux bureaux et commerces. Particuliers comme professionnels réservent au même endroit : ménage du logement, bureaux, vitrines ou parties communes d'immeuble.",
      "In Toulon, between the old centre, Le Mourillon and the residential districts, there are family homes, student flats and many offices and shops. Individuals and professionals book in the same place: home cleaning, offices, shop windows or building common areas.",
      "A Tolone, tra il centro storico, Le Mourillon e i quartieri residenziali, si trovano abitazioni familiari, appartamenti per studenti e numerosi uffici e negozi. Privati e professionisti prenotano nello stesso posto: pulizia della casa, uffici, vetrine o parti comuni dei condomini.",
      "En Toulon, entre el centro histórico, Le Mourillon y los barrios residenciales, hay viviendas familiares, pisos de estudiantes y numerosas oficinas y comercios. Particulares y profesionales reservan en el mismo sitio: limpieza de la vivienda, oficinas, escaparates o zonas comunes de edificios."
    ]
  },
  {
    "nom": "Ajaccio", "slug": "ajaccio", "codePostal": "20000", "departement": "Corse-du-Sud",
    "voisines": ["Porticcio", "Alata", "Bastelicaccia", "Afa"],
    "texte": [
      "Entre la vieille ville, la route des Sanguinaires et la rive sud du golfe vers Porticcio, Ajaccio accueille de nombreux vacanciers dans des appartements et villas loués pour la saison. Que vous soyez sur place ou sur le continent, vous suivez le ménage à distance : arrivée confirmée, tâches cochées et photos avant / après.",
      "Between the old town, the Sanguinaires road and the south shore of the gulf towards Porticcio, Ajaccio welcomes many holidaymakers in flats and villas rented for the season. Whether you are on the island or on the mainland, you follow the cleaning remotely: confirmed arrival, ticked tasks and before / after photos.",
      "Tra la città vecchia, la strada delle Sanguinaires e la sponda sud del golfo verso Porticcio, Ajaccio accoglie molti villeggianti in appartamenti e ville affittati per la stagione. Che tu sia sul posto o sul continente, segui la pulizia a distanza: arrivo confermato, compiti spuntati e foto prima / dopo.",
      "Entre el casco antiguo, la carretera de las Sanguinarias y la orilla sur del golfo hacia Porticcio, Ajaccio recibe a muchos veraneantes en apartamentos y villas alquilados por temporada. Tanto si estás allí como en el continente, sigues la limpieza a distancia: llegada confirmada, tareas marcadas y fotos antes / después."
    ]
  },
  {
    "nom": "Porto-Vecchio", "slug": "porto-vecchio", "codePostal": "20137", "departement": "Corse-du-Sud",
    "voisines": ["Lecci", "Sotta", "Zonza", "Bonifacio"],
    "texte": [
      "Autour de Porto-Vecchio, les villas et résidences de vacances proches des plages se louent surtout l'été, avec des changements de locataires souvent le même jour de la semaine. La réservation en série et la mémorisation des étapes par logement permettent de préparer toute la saison en une fois.",
      "Around Porto-Vecchio, holiday villas and residences near the beaches are mostly rented in summer, with tenants often changing on the same day of the week. Series booking and saving the steps for each home let you prepare the whole season in one go.",
      "Intorno a Porto-Vecchio, le ville e le residenze per le vacanze vicine alle spiagge si affittano soprattutto d'estate, con cambi di inquilini spesso nello stesso giorno della settimana. La prenotazione in serie e la memorizzazione dei passaggi per alloggio permettono di preparare tutta la stagione in una volta.",
      "Alrededor de Porto-Vecchio, las villas y residencias vacacionales cerca de las playas se alquilan sobre todo en verano, con cambios de inquilinos a menudo el mismo día de la semana. La reserva en serie y la memorización de los pasos por vivienda permiten preparar toda la temporada de una vez."
    ]
  }
] /* </villes> */;

export const ville = slug => VILLES.find(v => v.slug === slug);
