import { icone } from "./icones.js";
import { langue, LOCALE } from "./langue.js";

// Valeurs métier : copie EXACTE de app/.../Regles.kt (application Android). Toute modification se fait des deux côtés.
// Montants en centimes, durées en minutes.
export const REGLES = {
  // WhatsApp « Support Cleaneroo » (22/11/2026) : numéro de Michael, lié au téléphone de Vincent (appareil connecté).
  WHATSAPP_SUPPORT: "33626876518",
  // Conciergerie : seuil d'alerte par défaut d'un article du stock d'un bien (13 novembre 2026).
  STOCK_SEUIL_DEFAUT: 2,
  // Dommages voyageurs (24/11/2026) : demande à déposer au plus tard 14 jours après le départ (règle Airbnb), alerte à 5 jours, urgente à 2 jours.
  DOMMAGES_DELAI_JOURS: 14, DOMMAGES_ALERTE_JOURS: 5, DOMMAGES_URGENT_JOURS: 2,
  COMMISSION_BASE_PB: 1500,
  DELAI_MIN_RESERVATION_H: 24,
  PLANNING_HEURE_DEBUT: 5,
  PLANNING_HEURE_FIN: 23,
  ARRONDI_DUREE_MIN: 15,
  DUREE_PAR_NIVEAU_SUPP_MIN: 15,
  SEUIL_DEUX_CLEANEURS_MIN: 6 * 60,
  SEUIL_DEVIS_SURFACE_M2: 300,
  MINIMUM_COMMANDE_VEHICULE_C: 4000,
  MINIMUM_COMMANDE_TEXTILES_C: 5900,
  MINIMUM_COMMANDE_HEBERGEMENT_C: 5900,
  MINIMUM_COMMANDE_BATEAU_C: 4900,        // Bateaux : minimum par intervention (16 novembre 2026)
  MINIMUM_COMMANDE_LOISIRS_C: 7900,       // Vans, camping-cars et caravanes : minimum par intervention   // Hôtels et campings (16 novembre 2026) : minimum par intervention
  JOURS_MAX_MEME_SITE: 4,
  FENETRE_ROTATION_MIN: 360,              // rotation d'un camping ou d'un hôtel : à finir en 6 h (10 h – 16 h) → nombre de Cleaneurs                 // un même Cleaneur au plus 4 jours sur 7 chez un même hôtel ou camping (pas d'emploi déguisé)
  VEHICULES_MIN: 1,
  VEHICULES_MAX: 20,
  DUREE_MIN_VEHICULE_MIN: 30,
  MINIMUM_MENAGE_LOCATION_C: 3750,     // refonte du 20/11/2026 : plus petit ménage réel (studio Standard, 1 h 15)
  DUREE_MIN_TEXTILES_MIN: 60,
  PRIX_APPEL_TEXTILES_C: 4300,         // matelas bébé, élément le moins cher après la hausse de 10 % (20/11/2026)
  // Location courte durée (refonte du 20/11/2026) : Standard = 45 min + 30 min par pièce (chambres + séjour), + 20 min par salle de bain
  // au-delà de la première, + 0,35 min par m² au-delà de 25 m² par pièce. Studio 1 h 15, T2 1 h 45, T3 2 h 15, T4 2 h 45, T5 3 h 15.
  ROTATION_BASE_MIN: 45,
  ROTATION_PAR_PIECE_MIN: 30,
  ROTATION_PAR_SDB_SUPP_MIN: 20,
  ROTATION_M2_PAR_PIECE: 25,
  ROTATION_PAR_M2_MIN: 0.35,
  // Durée du séjour qui précède : temps ajouté au Standard (5 à 9 nuits +20 %, 10 nuits et plus +35 %).
  SEJOUR_PCT: { court: 0, semaine: 20, long: 35 },
  // Taux horaire de chaque niveau de location (le dernier est le plancher) : modifiables dans l'écran Tarifs.
  TAUX_LOCATION_C: { standard: 3000, confort: 2850, premium: 2700 },
  PASSAGES_MIN: 2,
  PASSAGES_MAX: 12,
  PASSAGES_DEFAUT: 4,
  JOURS_MIN_PLUSIEURS_PAR_SEMAINE: 2,
  TACHE_PERSO_MIN: 15,
  OPTION_GENERIQUE_C: 1200,
  OPTION_GENERIQUE_MIN: 15,
  LINGE_PAR_PARURE_C: 400,
  CONSOMMABLES_MIN: 0,              // 20/11/2026 : contrôle des consommables compris dans le temps Standard de la location
  CHANTIER_MIN_PAR_FENETRE: 15,
  CONVIVES_PAR_TRANCHE: 50,
  PALIERS_MAX: 40,
  SURFACE_PALIER_DEFAUT_M2: 20,
  // Immeubles : hall et entrée + chaque palier compte au moins un quart d'heure (le prix suit toujours le nombre d'étages)
  IMMEUBLE_HALL_MIN: 30,
  IMMEUBLE_MIN_PAR_PALIER: 15,
  // Formules des Cleaneurs (modèle économique du 7 novembre 2026) : Gratuit (0 €, commission 20 %, missions des particuliers,
  // visibles 30 min après les Pro) ou Pro (19,99 €/mois, commission 12 %, toutes les missions, 30 min d'avance, badge Pro).
  // Offre de lancement (décision du 7 novembre 2026, pour attirer un maximum de Cleaneurs) : 3 mois de formule Pro offerts à TOUS les
  // Cleaneurs inscrits jusqu'au 31 janvier 2027 inclus, sans limite de places ; les 3 mois partent de la première mission prise
  // (avant : Pro sans limite de durée) (base : pro_offert_jusqu, posé par prendre_mission).
  // Impayé (abonnement Pro) : blocage et redistribution des missions réservées 3 jours après la date de facturation prévue.
  COMMISSION_GRATUIT_PB: 2000, COMMISSION_PRO_PB: 1200, PRIORITE_PRO_MIN: 30,
  // Frais de service côté client (modèle économique) : particulier 5 % ; conciergerie ou entreprise sans abonnement 8 % ; abonnée 0 %.
  // Affichés à part dès le devis, hors crédit d'impôt.
  FRAIS_SERVICE_PARTICULIER_PCT: 5, FRAIS_SERVICE_PRO_PCT: 8,
  // Abonnement des conciergeries par tranche de logements (prix HT par mois) ; au-delà de 100 logements : sur devis.
  // Offre « Conciergerie fondatrice » (24/11/2026, remplace « 1er mois offert ») : voir OFFRE_CONCIERGERIE_* et etatOffreConciergerie.
  // Refonte du 20/11/2026 : grille continue (le prix ne baisse jamais quand on ajoute un logement), grands comptes au-delà de 100 logements.
  // Prix = forfait de la tranche + parLogementC × (logements − debut). Plafond : jamais plus que les frais de service (8 %) du mois.
  ABONNEMENTS_PRO: [
    { id: "t1", max: 5, prixC: 2900, inclus: ["0 % de frais de service"] },
    { id: "t2", max: 15, prixC: 6900, inclus: ["0 % de frais de service", "Vue par logement", "Cleaneur attitré"] },
    { id: "t3", max: 40, prixC: 14900, inclus: ["0 % de frais de service", "Vue par logement", "Cleaneur attitré", "Facturation mensuelle groupée"] },
    { id: "t4", max: 100, prixC: 14900, debut: 40, parLogementC: 250, inclus: ["0 % de frais de service", "Vue par logement", "Cleaneur attitré", "Facturation mensuelle groupée", "Import de tous vos logements"] },
    { id: "t5", max: 300, prixC: 29900, debut: 100, parLogementC: 150, grandCompte: true, inclus: ["0 % de frais de service", "Vue par logement", "Cleaneur attitré", "Facturation mensuelle groupée", "Import de tous vos logements", "Connexion à votre logiciel de gestion", "Interlocuteur dédié", "Garantie rotation"] },
    { id: "t6", max: 100000, prixC: 59900, debut: 300, parLogementC: 100, grandCompte: true, inclus: ["0 % de frais de service", "Vue par logement", "Cleaneur attitré", "Facturation mensuelle groupée", "Import de tous vos logements", "Connexion à votre logiciel de gestion", "Interlocuteur dédié", "Garantie rotation"] },
  ],
  ABONNEMENT_PRO_SUR_DEVIS_LOGEMENTS: 100000,
  // Offre « Conciergerie fondatrice » (24/11/2026), seule source de vérité (copie dans outils/base-offre-conciergerie.sql) :
  // inscription jusqu'au 31 janvier 2027 23 h 59 (Paris), sans limite de nombre ; 3 mois de la tranche gratuits et 0 % de frais de service
  // à partir de la PREMIÈRE INTERVENTION TERMINÉE ET VALIDÉE ; +1 mois (une seule fois, ajouté à la fin) si 3 Cleaneurs invités ont leur
  // dossier validé et au moins une intervention ; prix garanti 12 mois après ; rappels 30 et 7 jours avant la fin ; aucun prélèvement
  // sans accord explicite : sans réponse, la conciergerie passe sans abonnement (8 % de frais de service).
  OFFRE_CONCIERGERIE_FIN_INSCRIPTION: "2027-01-31T23:59:59+01:00",
  OFFRE_CONCIERGERIE_MOIS: 3,
  OFFRE_CONCIERGERIE_BONUS_MOIS: 1,
  OFFRE_CONCIERGERIE_BONUS_CLEANEURS: 3,
  OFFRE_CONCIERGERIE_PRIX_GARANTI_MOIS: 12,
  OFFRE_CONCIERGERIE_RAPPELS_JOURS: [30, 7],
  ABONNEMENT_ANNUEL_MOIS_OFFERTS: 2,      // engagement annuel : 2 mois offerts
  ESSAI_GRAND_COMPTE_JOURS: 30, ESSAI_GRAND_COMPTE_LOGEMENTS: 20,   // essai gratuit sur 20 logements avant de tout transférer
  OFFRE_LANCEMENT_MOIS: 3,
  OFFRE_LANCEMENT_FIN_INSCRIPTION: "2027-01-31",
  // Parrainage et cagnottes (7 novembre 2026, copie dans outils/base-parrainage.sql)
  PARRAINAGE_FILLEUL_C: 1000,          // remise du filleul sur sa 1re prestation
  PARRAINAGE_MIN_COMMANDE_C: 4000,     // … à partir de 40 €
  PARRAINAGE_PARRAIN_C: 1000,          // cagnotte du parrain (client, ou client qui fait venir un Cleaneur)
  PARRAINAGE_PRIME_CLEANEUR_C: 2000,   // prime d'un Cleaneur qui parraine un Cleaneur
  PARRAINAGE_MISSIONS_CLEANEUR: 3,     // missions terminées du Cleaneur filleul avant la récompense
  PARRAINAGE_MOIS_CONCIERGERIE: 1,     // mois d'abonnement offert à chaque conciergerie
  PARRAINAGE_MAX_PAR_AN: 10,
  PARRAINAGE_DELAI_CODE_JOURS: 30,
  CAGNOTTE_VALIDITE_MOIS: 12,
  ABONNEMENT_CLEANEUR_C: 1999,
  PREAVIS_BLOCAGE_JOURS: 3,
  // Périmètre d'intervention d'un Cleaneur (menu déroulant du profil), en km ; défaut 15 km.
  ZONES_KM: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
  ZONE_KM_DEFAUT: 15,
  // Espace Pro : agenda relié aux calendriers iCal (Airbnb, Booking…).
  AGENDA_HORIZON_JOURS: 14,      // départs proposés « à programmer »
  AGENDA_CACHE_MIN: 15,          // calendrier relu au plus toutes les 15 min
  SEUIL_ESPACE_PRO_BIENS: 3,     // à partir de 3 biens, le compte s'ouvre sur l'espace Pro
  BIENS_MAX: 1000,   // 20/11/2026 : grandes conciergeries (import en masse)
  // Option « Lavage des draps » (location saisonnière) : prix fixe par lit, le même dans toutes les zones.
  LAVAGE_DRAPS_PAR_LIT_C: 1200,   // ancien prix unique = lit 2 places sur place (brouillons enregistrés avant le 18/11/2026)
  // Lavage des draps (18 novembre 2026, décision de l'utilisateur, prix du marché : laverie 3-5 € le lavage 8 kg + 1,20-2,50 € le séchage,
  // conciergeries ~10 € par lit 2 places) : machine ET sèche-linge dans le logement → forfait unique ; sinon laverie obligatoire, prix par lit.
  DRAPS_SUR_PLACE_FORFAIT_C: 500,    // ancien forfait (brouillons avant le 20/11/2026)
  DRAPS_SUR_PLACE_PAR_LIT_C: 500,    // refonte du 20/11/2026 : 5 € par lit (10 min de travail par lit)
  LAVERIE_TRAJET_C: 1200,            // refonte du 20/11/2026 : aller-retour à la laverie, une fois par ménage
  DRAPS_LAVERIE_C: { un: 800, deux: 1000, king: 1200 },
  // Linge de toilette et de cuisine (serviettes, tapis de bain et de WC, torchons) : une machine de plus sur place ; en laverie, par salle de bain + torchons.
  LINGE_SUR_PLACE_FORFAIT_C: 300,
  LINGE_LAVERIE_PAR_SDB_C: 400,
  TORCHONS_LAVERIE_C: 200,
  LINGE_MIN: 10,                  // planning : une machine de plus (sur place) ou un sac de plus (laverie)
  LAVERIE_TRAJET_MIN: 30,
  // Niveau de risque d'une rotation (conciergerie, 18 novembre 2026, repris de l'app iPhone) — marges entre la fin du ménage et l'arrivée suivante.
  RISQUE_MARGE_URGENTE_MIN: 30, RISQUE_MARGE_SURVEILLER_MIN: 90,
  RISQUE_SANS_MENAGE_URGENT_H: 48, RISQUE_SANS_CLEANEUR_URGENT_H: 24, RISQUE_SANS_CLEANEUR_SURVEILLER_H: 72, RISQUE_RETARD_DEPART_MIN: 30,         // aller et retour à la laverie, une fois par ménage
  // Options en plus (7 novembre 2026, décision de l'utilisateur) : petits forfaits selon la taille de l'option, plus de prix au temps.
  // Petite (≤ 5 min) 2 €, moyenne (≤ 15 min) 4 €, grande 6 € ; le temps reste compté pour le planning du Cleaneur.
  OPTION_PETITE_C: 200, OPTION_MOYENNE_C: 400, OPTION_GRANDE_C: 600,   // anciens forfaits (brouillons avant le 20/11/2026)
  // Refonte du 20/11/2026 : une étape en plus est payée au temps réel, 30 €/h arrondi à l'euro, 3 € au moins (5 min 3 €, 10 min 5 €, 15 min 8 €, 20 min 10 €).
  OPTION_TAUX_HORAIRE_C: 3000, OPTION_MIN_C: 300,
  // Formules (7 novembre 2026, décision de l'utilisateur) : les tâches de Confort coûtent au plus 40 % du prix Standard,
  // celles de Premium au plus 90 % ; le prix des formules suit ainsi la taille du lieu (62 m² : ≈ 67 €, 94 €, 128 €).
  FORMULE_CONFORT_PLUS_PCT: 40, FORMULE_PREMIUM_PLUS_PCT: 90,
  // Plancher horaire (refonte du 20/11/2026, audit) : une formule ne descend jamais sous temps planifié × plancher, pour que le Cleaneur
  // garde au moins ~15,80 € net de l'heure. Le plancher l'emporte sur les plafonds ci-dessus.
  PLANCHER_HORAIRE_C: { home: 2690, rental: 2700, moving: 3000, car: 3800, textiles: 3000, kitchen: 3400, office: 2800, commerce: 2800,
    communal: 2660, windows: 2850, outdoor: 3000, pool: 3400, event: 3000, leisure: 3400, boat: 3400, hospitality: 2800, construction: 3600 },
  OPTION_PETITE_MAX_MIN: 5, OPTION_MOYENNE_MAX_MIN: 15,
  // Option « Suivi par SMS » : 0,49 € par prestation, SMS au nom de Cleaneroo dans la langue de la réservation ; hors crédit d'impôt.
  OPTION_SMS_C: 49,
  LAVAGE_DRAPS_MIN_PAR_LIT: 10,   // planning : retirer, lancer, étendre et plier, par lit
  LITS_MAX: 20,
  // Prix selon la ville (pouvoir d'achat) : 3 zones, d'après le code postal de l'adresse du bien (géolocalisée).
  // Prestige +20 % (Monaco, Cannes, Saint-Tropez…), Standard (prix de base), Économique −10 % (Istres, Draguignan…).
  // S'applique à la main-d'œuvre, aux forfaits et aux tâches ; les minimums de commande et l'option draps ne changent pas.
  ZONE_PRESTIGE_PCT: 20,
  ZONE_ECONOMIQUE_PCT: -10,
  ZONE_PRESTIGE_CP: ["98000", "06400", "06150", "06250", "06160", "06230", "06310", "06320", "06360", "06190", "06570", "06590", "83990", "83350", "83580", "83310", "13260", "84220", "20137", "20169", "20260", "75001", "75006", "75007", "75008", "75016", "92200", "74120", "73120", "73150", "64200", "14800", "33970", "62520"],
  ZONE_ECONOMIQUE_CP: ["13800", "13500", "13140", "13110", "13270", "13700", "13127", "13200", "13150", "83300", "83170", "83340", "83490", "83550", "83500", "06130", "06510", "04100", "04000", "84300", "84200", "84100", "84000"],
  // Agenda sans calendrier iCal : séjours saisis à la main dans l'espace Pro.
  SEJOURS_MAX_PAR_BIEN: 300,     // séjours saisis gardés par bien
  SEJOURS_GARDES_JOURS: 90,      // séjours finis depuis plus de 90 jours oubliés
  SEJOUR_DUREE_MAX_JOURS: 365,
  AGENDA_VOIES_MAX: 3,           // barres de séjour visibles par jour (au-delà : « +N »)
  AGENDA_LISTE_JOURS: 60,        // vue « Liste » : les 60 prochains jours
  PALIERS_DEFAUT: 5,
  CHANTIER_MINIMUM_MIN: 120,
  CHANTIER_PIECES_MAX: 8,
  ETAPE_PERSO_LOCATION_MIN: 10,
  DEPART_VOYAGEURS_MIN_H: 6,
  DEPART_VOYAGEURS_MAX_H: 14,
  DEPART_VOYAGEURS_DEFAUT_H: 10,
  ARRIVEE_SUIVANTE_MIN_H: 12,
  ARRIVEE_SUIVANTE_MAX_H: 22,
  ARRIVEE_SUIVANTE_DEFAUT_H: 16,
  MAJORATION_DIMANCHE_PCT: 25,
  CRENEAU_MALIN_PCT: 10,
  MAJORATION_URGENCE_SPECIALE_PCT: 30,  // prestations spécialisées : intervention urgente (sous 24 à 48 h)
  ENGAGEMENT_PCT: { 0: 0, 3: 5, 6: 10, 12: 15 },
  // Pass Entretien véhicule (26/11/2026, décision de Michael) : mêmes valeurs que outils/base-pass-entretien.sql (à changer ensemble).
  // apres : nombre de passages précédents (non annulés) ; −5 % dès le 3e passage, −10 % dès le 6e, jamais plus.
  PASS_ENTRETIEN: { ENTRETIEN_PCT: 15, PALIERS: [{ apres: 2, pct: 5 }, { apres: 5, pct: 10 }], BONUS_PARRAINAGE: 3, REPORTS_PAR_AN: 1 },
  CREDIT_IMPOT_PCT: 50,
  CREDIT_IMPOT_PLAFOND_C: 1200000,
  MAX_PROPOSITIONS: 5,
  REMISE_CLEANEUR_MAX_PCT: 10,
  HAUSSE_CLEANEUR_MAX_PCT: 50,
  ANNULATION_GRATUITE_H: 48,
  ANNULATION_TARDIVE_PCT: 25,
  VALIDATION_AUTO_H: 48,
  POURBOIRE_CHOIX_C: [200, 500, 1000],   // pourboires proposés au client (100 % pour le Cleaneur)
  GARANTIE_PLAFOND_C: 300000,
  // Accès impossible / client absent (copie de Regles.kt) : après 15 min d'attente, 30 % du prix entre 20 et 60 €.
  INDEMNITE_PCT: 30,
  INDEMNITE_MIN_C: 2000,
  INDEMNITE_MAX_C: 6000,
  ATTENTE_ACCES_IMPOSSIBLE_MIN: 15,
  // Photos avant ET après obligatoires dans toutes les rubriques, sauf celles-ci (prompt 2, partie 6, 24/11/2026).
  // À reporter dans Regles.kt (appli Android) et dans l'écran de contrôle du Cleaneur de l'appli.
  PHOTOS_AVANT_SAUF: ["special"],
  // « Mon activité » du Cleaneur micro-entrepreneur (taux 2026, prestations de services BIC dont le nettoyage) — à revoir chaque année.
  URSSAF_SERVICES_PCT: 21.2,
  // ACRE (décret n° 2026-69 du 6 février 2026) : exonération ramenée de 50 % à 25 % pour les micro-entreprises créées depuis le
  // 1er juillet 2026, soit 75 % du taux normal (15,9 %) ; celles créées avant gardent 10,6 % jusqu'à la fin de leur période d'ACRE.
  URSSAF_ACRE_PCT: 15.9,
  URSSAF_ACRE_AVANT_JUILLET_2026_PCT: 10.6,
  // Frais de paiement Stripe (cartes standard de l'EEE), à la charge du Cleaneur : tarif à vérifier chaque année sur stripe.com/fr/pricing.
  FRAIS_STRIPE_PCT: 1.5,
  FRAIS_STRIPE_FIXE_C: 25,
  // Pénalités retenues sur les versements suivants du Cleaneur, au plus ce pourcentage de chaque versement (contrat 2026-12-c ;
  // même valeur dans la fonction serveur « paiement » : RETENUE_MAX_PCT). Plus de réserve de garantie.
  RETENUE_MAX_PCT: 50,
  VERSEMENT_LIBERATOIRE_PCT: 1.7,
  PLAFOND_MICRO_SERVICES_C: 8360000,   // 83 600 € de chiffre d'affaires par an (prestations de services, 2026-2028)
  DEVIS_VALIDITE_JOURS: 30,
  // Programme Cleaneur (12 novembre 2026, repris de Vincent ; calcul en base : niveau_de dans base-niveaux.sql, copie dans Regles.kt).
  // avance : minutes d'avance sur les missions des particuliers. Un niveau de moins si annulations > 5 % ou avertissement en cours.
  NIVEAUX: [
    { id: "base", nom: "Cleaneur", icone: icone("termine"), missions: 0, note: 0, avance: 0, avantages: ["Toutes les missions de vos formations"] },
    { id: "confirme", nom: "Confirmé", icone: icone("avis"), missions: 10, note: 4.6, avance: 5, avantages: ["Badge « Confirmé » visible des clients", "Missions des particuliers 5 min avant les autres"] },
    { id: "expert", nom: "Expert", icone: icone("avis"), missions: 30, note: 4.8, avance: 10, avantages: ["Badge « Expert » visible des clients", "Missions des particuliers 10 min avant les autres", "Missions des entreprises et conciergeries"] },
    { id: "elite", nom: "Élite", icone: icone("avis"), missions: 60, note: 4.9, avance: 15, avantages: ["Badge « Élite » visible des clients", "Missions des particuliers 15 min avant les autres", "Missions des entreprises et conciergeries", "Assistance prioritaire"] },
  ],
  ANNULATION_MAX_NIVEAU_PCT: 5,
  // Versements des Cleaneurs (repris de l'appli iPhone) : chaque vendredi, pour les missions validées jusqu'au mercredi minuit.
  VERSEMENT_JOUR_ISO: 5,          // vendredi (lundi = 1)
  VERSEMENT_LIMITE_JOUR_ISO: 3,   // mercredi
  GARANTIE_REMPLACEMENT_OFFERT_C: 0,   // 20/11/2026 : plus d'avoir offert (rien à la charge de Cleaneroo)
  GARANTIE_DECLARATION_H: 48,
  AVIS_DELAI_JOURS: 14,
  TOLERANCE_RETARD_MIN: 30,
  RAYON_ARRIVEE_KM: 1.0,
  // Société éditrice (mentions légales, documents) : à compléter dès l'immatriculation ; vide = « publiées avant l'ouverture ».
  SOCIETE: { nom: "", adresse: "", siret: "", directeur: "" },
  // Médiateur de la consommation choisi (12 novembre 2026) : CM2C, 48 € pour 3 ans puis 36 € par médiation à distance (gratuit pour le
  // client). Passer actif à true une fois l'adhésion faite (après la création de la SAS, avant l'ouverture).
  MEDIATEUR: { actif: false, nom: "CM2C (Centre de la Médiation de la Consommation de Conciliateurs de Justice)", adresse: "49 rue de Ponthieu, 75008 Paris", site: "www.cm2c.net" },
  CONNEXION_GOOGLE: true,    // fournisseur Google activé dans Supabase le 12 novembre 2026 (comme Regles.CONNEXION_GOOGLE)
  // Propositions des Cleaneurs (base-propositions.sql) : remise et hausse maximales, note minimale d'une hausse, propositions par demande.
  PROPOSITION_REMISE_MAX_PCT: 10,
  PROPOSITION_HAUSSE_MAX_PCT: 50,
  PROPOSITION_NOTE_MIN: 20,
  PROPOSITIONS_MAX: 5,
  // Frais de déplacement proposés par le Cleaneur (indicatifs, toujours acceptés par le client) : inclus jusqu'à 15 km,
  // 8 € jusqu'à 30 km, 15 € jusqu'à 50 km, au-delà 0,30 €/km aller-retour, 60 € au plus.
  FRAIS_DEPLACEMENT: { inclusKm: 15, palier1Km: 30, palier1C: 800, palier2Km: 50, palier2C: 1500, parKmC: 30, maxC: 6000 },
  // Lancement des missions (page « Devenir Cleaneur ») : à remplir par Vincent, ex. LANCEMENT_ZONE: "Fréjus et Saint-Raphaël",
  // LANCEMENT_DATE: "5 janvier 2027". Vides : la page invite seulement à s'inscrire pour être prévenu.
  LANCEMENT_ZONE: "",
  LANCEMENT_DATE: "",
  // Supplément pour imprévu (après un signalement à l'arrivée) : curseur de 15 à 60 min, au tarif de la prestation, au plus 25 % du prix,
  // réponse du client sous 15 min (sinon refus). Copie de Regles.kt ; la base fait foi (proposer_supplement).
  SUPPLEMENT_PAS_MIN: 15, SUPPLEMENT_MAX_MIN: 60, SUPPLEMENT_MAX_PCT: 25, SUPPLEMENT_REPONSE_MIN: 15,
  // Créneaux disponibles du Cleaneur (grille) et score de recommandation des missions (repris de Vincent).
  CRENEAUX_DEBUT_H: 6, CRENEAUX_FIN_H: 22,
  // Créneaux proposés au client (26/11/2026, Michael et Vincent) : toutes les 30 minutes, selon la prestation.
  // plages : heures de début possibles [de, à[ ; finMax : le travail doit être fini avant cette heure (sinon le créneau n'est pas proposé).
  // Location saisonnière : entre le départ des voyageurs et l'arrivée suivante (voir heuresProposees, estimation.js).
  CRENEAU_PAS_MIN: 30,
  FENETRE_ARRIVEE_MIN: 60, FENETRE_ARRIVEE_LOCATION_MIN: 30,   // marge d'arrivée du Cleaneur ; location : même une arrivée en fin de fenêtre finit avant les voyageurs
  CRENEAUX_PRESTA: {
    defaut: { plages: [[7, 12], [13, 19]], finMax: 20 },
    office: { plages: [[6, 21]], finMax: 22 }, commerce: { plages: [[6, 21]], finMax: 22 }, communal: { plages: [[6, 21]], finMax: 22 },
    outdoor: { plages: [[8, 18]], finMax: 19 }, pool: { plages: [[8, 18]], finMax: 19 },
  },
  RETARD_TOLERE_MIN: 30,   // retard annoncé toléré ; au-delà, le client peut annuler sans frais (base-retards.sql)
  VITESSE_MOYENNE_KMH: 35,
  MARGE_TRAJET_MIN: 10,
  SUIVI_INTERVALLE_S: 10,        // suivi en direct : position envoyée et relue toutes les 10 s
  SELFIE_MAX_PX: 600,            // photo de vérification du jour : plus grand côté de la photo envoyée
  AVERTISSEMENTS_MAX: 2,         // avertissements autorisés ; au suivant, le Cleaneur est banni
  // Plan d'urgence (copie des valeurs de la base : remettre_en_urgence, verifier_missions_urgence)
  URGENCE_CONTROLE_AVANT_MIN: 120,   // confirmation demandée 2 h avant le début
  URGENCE_APPEL_APRES_MIN: 15,       // appel automatique 15 min après le rappel sans réponse
  URGENCE_ABSENCE_APRES_MIN: 15,     // absence constatée 15 min après l'appel
  PENALITE_24H_C: 1500,              // annulation à moins de 24 h
  PENALITE_2H_C: 3000,               // annulation à moins de 2 h ou absence (minimum)
  PENALITE_2H_PCT: 25,               // … ou 25 % du prix si c'est plus
  // Mission de renfort (26/11/2026) : plus de prime d'urgence ; 0 % de commission sur une mission remise en urgence, et 10 min
  // d'avance pendant 24 h après un renfort (emettre_factures, avance_niveau : base-mission-renfort.sql).
  RENFORT_COMMISSION_PCT: 0, RENFORT_AVANCE_MIN: 10,
  URGENCE_FRAIS_C: 200,              // frais d'appels et de SMS gardés par Cleaneroo
  URGENCE_DISPO_H: 3,                // « Disponible pour une urgence » : prioritaire pendant 3 h
  // Niveaux des Cleaneurs (missions terminées) : copie de NiveauCleaneur (ReglesMetier.kt)
  NIVEAUX_CLEANEUR: [["Cleaneur", 0], ["Confirmé", 10], ["Expert", 30], ["Élite", 60]],
  SURVEILLANCE_S: 30,            // nouvelles missions (Cleaneur) et prises en charge (client) : vérifiées toutes les 30 s, avec un son
  // Choix du Cleaneur et secteur (16 novembre 2026) : copie de Regles.kt
  FAVORI_EXCLUSIVITE_H: 12,      // « Mon Cleaneur favori » : exclusivité maximale (prestation dans plus de 7 jours)
  // Exclusivité du Cleaneur demandé (25/11/2026, validé par Michael) : 2 h si la prestation a lieu dans moins de 48 h, 6 h dans
  // moins de 7 jours, 12 h au-delà ; libérée aussitôt s'il n'est pas disponible. Même règle que delai_favori (base-cleaneur-choisi.sql).
  FAVORI_PALIERS_H: [[48, 2], [168, 6]],
  // Prochain passage proposé par le Cleaneur (25/11/2026, validé par Michael) : seulement les prestations qui reviennent au rythme
  // choisi par le client. Pas la location saisonnière ni l'hôtellerie (calendrier des réservations). Même liste que proposer_prochain_passage.
  RUBRIQUES_PASSAGE: ["home", "windows", "office", "commerce", "communal", "car", "outdoor", "pool", "textiles"],
  MISSIONS_SECTEUR_MIN: 3,       // moins de 3 missions disponibles dans le périmètre : conseil d'agrandir le secteur
};

/** Durée d'exclusivité du Cleaneur demandé (heures) pour une prestation à cette date (null : date flexible → 12 h). */
export function delaiFavoriH(creneau, depuis = new Date()) {
  if (!creneau) return REGLES.FAVORI_EXCLUSIVITE_H;
  const h = (new Date(creneau) - depuis) / 3600e3;
  const p = REGLES.FAVORI_PALIERS_H.find(([max]) => h < max);
  return p ? p[1] : REGLES.FAVORI_EXCLUSIVITE_H;
}

/**
 * Conseil de secteur (16 novembre 2026, copie de ReglesMetier.conseilSecteur) : distances (km) des missions disponibles et périmètre actuel.
 * null si le périmètre suffit (au moins MISSIONS_SECTEUR_MIN missions) ou s'il est déjà au plus grand ; sinon le plus petit périmètre proposé
 * qui en donne assez (à défaut, le palier suivant) et le nombre de missions en plus.
 */
/** Cleaneurs nécessaires pour finir une rotation dans la fenêtre (16 novembre 2026, copie de ReglesMetier.cleaneursRotation). */
export const cleaneursRotation = minutes => Math.max(1, Math.ceil(minutes / REGLES.FENETRE_ROTATION_MIN));

export function conseilSecteur(distancesKm, zoneKm) {
  const dans = km => distancesKm.filter(d => d <= km).length;
  const n = dans(zoneKm);
  if (n >= REGLES.MISSIONS_SECTEUR_MIN) return null;
  const plus = REGLES.ZONES_KM.filter(z => z > zoneKm);
  if (!plus.length) return null;
  const conseil = plus.find(z => dans(z) >= REGLES.MISSIONS_SECTEUR_MIN) ?? plus[0];
  return { dansZone: n, zoneKm, conseilKm: conseil, enPlus: dans(conseil) - n };
}

// ---- Ouverture des réservations (24/11/2026, décision de Michael) : plus de date de lancement fixe. Un interrupteur en base
// (infos_cleaneroo « reservations_ouvertes », outils/base-ouverture-reservations.sql), ouvert depuis l'espace de gestion une fois
// la SAS renseignée et Stripe en mode réel. Fermé : comptes, espaces, logements et dossiers fonctionnent ; réservation, paiement,
// prise de mission et propositions sont bloqués. Lu au démarrage (chargerOuverture dans donnees.js) ; fermé par défaut.
export const MESSAGE_LANCEMENT = "Soyez prêts pour une nouvelle dimension du nettoyage, 100 % digitalisé.";
let ouvertes = false;
export const reservationsOuvertes = () => ouvertes;
export const reservationsFermees = () => !ouvertes;
export const fixerOuverture = v => { ouvertes = v === true; };

// ---- Formats français (copie de Formats.kt)
export function euros(c) {
  const neg = c < 0, a = Math.abs(Math.round(c));
  const entier = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "−" : "") + entier + "," + String(a % 100).padStart(2, "0") + " €";
}
export function duree(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
export function heure(h, m = 0) {
  if (langue !== "fr") return `${h}:${String(m).padStart(2, "0")}`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLongue(d) {
  if (langue !== "fr") return d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
// Mois abrégés comme l'appli (format Java « MMM » en français)
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function dateCourte(d) {
  if (langue !== "fr") return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}
/** « mardi 10 novembre à 14 h » dans la langue choisie. */
export function dateHeure(d) {
  const a = { fr: "à", en: "at", it: "alle", es: "a las" }[langue];
  return `${dateLongue(d)} ${a} ${heure(d.getHours(), d.getMinutes())}`;
}

/** Zone de prix d'une adresse d'après son code postal : "PRESTIGE", "ECONOMIQUE" ou "STANDARD" (zonePrix de Regles.kt). */
export function zonePrix(codePostal) {
  const cp = String(codePostal || "").trim();
  if (REGLES.ZONE_PRESTIGE_CP.includes(cp)) return "PRESTIGE";
  if (REGLES.ZONE_ECONOMIQUE_CP.includes(cp)) return "ECONOMIQUE";
  return "STANDARD";
}
/** Ajustement de prix de la zone, en % (+20, 0 ou −10). */
export const pctZone = codePostal => ({ PRESTIGE: REGLES.ZONE_PRESTIGE_PCT, ECONOMIQUE: REGLES.ZONE_ECONOMIQUE_PCT })[zonePrix(codePostal)] ?? 0;
/** Libellé de la ligne d'estimation (« Tarif zone Prestige (+20 %) »), vide en zone Standard. */
export const libelleZone = pct => (pct > 0 ? `Tarif zone Prestige (+${pct} %)` : pct < 0 ? `Tarif zone Économique (−${-pct} %)` : "");

/** SIREN (9 chiffres) ou SIRET (14 chiffres) avec clé de contrôle valable (algorithme de Luhn), comme la base. */
export function sirenSiretValide(n) {
  const c = String(n || "").replace(/\D/g, "");
  if (c.length !== 9 && c.length !== 14) return false;
  let somme = 0;
  for (let i = 0; i < c.length; i++) {
    let d = Number(c[c.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    somme += d;
  }
  return somme % 10 === 0;
}

/** Ce que le Cleaneur touche (centimes) pour un chiffre d'affaires mensuel donné, abonnement Pro déduit (offert : pas d'abonnement). */
export function revenuCleaneurC(caC, formule, offert = false) {
  if (formule === "pro") return Math.round(caC * (10000 - REGLES.COMMISSION_PRO_PB) / 10000) - (offert ? 0 : REGLES.ABONNEMENT_CLEANEUR_C);
  return Math.round(caC * (10000 - REGLES.COMMISSION_GRATUIT_PB) / 10000);
}
/** Chiffre d'affaires mensuel à partir duquel Pro rapporte plus que Gratuit (centimes, arrondi à l'euro supérieur) : 250 €. */
export const seuilRentabiliteProC = () => Math.ceil(REGLES.ABONNEMENT_CLEANEUR_C * 10000 / (REGLES.COMMISSION_GRATUIT_PB - REGLES.COMMISSION_PRO_PB) / 100) * 100;

/** Frais de service (%) : particulier 5 % ; conciergerie ou entreprise : 8 % sans abonnement, 0 % abonnée ou en période offerte. */
export const fraisServicePct = (particulier, abonne = false) => (particulier ? REGLES.FRAIS_SERVICE_PARTICULIER_PCT : abonne ? 0 : REGLES.FRAIS_SERVICE_PRO_PCT);

/* ---- Offre « Conciergerie fondatrice » (24/11/2026) */
/** Date limite d'inscription (31 janvier 2027 23 h 59, heure de Paris). */
export const finInscriptionOffreConciergerie = () => new Date(REGLES.OFFRE_CONCIERGERIE_FIN_INSCRIPTION);
/** L'offre est-elle encore proposée aux nouvelles inscriptions ? */
export const offreConciergerieOuverte = (maintenant = new Date()) => maintenant <= finInscriptionOffreConciergerie();
const ajouterMois = (d, n) => { const x = new Date(d); const j = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < j) x.setDate(0); return x; };
/**
 * État de l'offre d'une conciergerie. inscritLe : création du compte ; debut : première intervention terminée et validée (null avant) ;
 * cleaneursBonus : Cleaneurs invités, dossier validé et au moins une intervention ; choix : "continuer", "arreter" ou "" (pas de réponse).
 * statut : "non_eligible" | "avant" (inscrite, pas encore d'intervention) | "en_cours" | "terminee".
 */
export function etatOffreConciergerie({ inscritLe, debut = null, cleaneursBonus = 0, choix = "", maintenant = new Date() } = {}) {
  const eligible = !!inscritLe && new Date(inscritLe) <= finInscriptionOffreConciergerie();
  const base = { eligible, bonusCompte: Math.min(cleaneursBonus, REGLES.OFFRE_CONCIERGERIE_BONUS_CLEANEURS), bonusObjectif: REGLES.OFFRE_CONCIERGERIE_BONUS_CLEANEURS };
  if (!eligible) return { ...base, statut: "non_eligible", gratuit: false };
  if (!debut) return { ...base, statut: "avant", gratuit: false };
  const bonus = cleaneursBonus >= REGLES.OFFRE_CONCIERGERIE_BONUS_CLEANEURS;
  const fin = ajouterMois(debut, REGLES.OFFRE_CONCIERGERIE_MOIS + (bonus ? REGLES.OFFRE_CONCIERGERIE_BONUS_MOIS : 0));
  const joursRestants = Math.max(0, Math.ceil((fin - maintenant) / 864e5));
  const enCours = maintenant < fin;
  return { ...base, statut: enCours ? "en_cours" : "terminee", gratuit: enCours, debut: new Date(debut), fin, bonus, joursRestants,
    prixGarantiJusqu: ajouterMois(fin, REGLES.OFFRE_CONCIERGERIE_PRIX_GARANTI_MOIS),
    rappel: enCours && REGLES.OFFRE_CONCIERGERIE_RAPPELS_JOURS.some(j => joursRestants <= j),
    // Fin de période sans réponse : sans abonnement (8 %), jamais de prélèvement sans accord explicite.
    apres: enCours ? null : choix === "continuer" ? "abonnement" : "sans_abonnement" };
}
/** Tranche d'abonnement conseillée pour un nombre de logements (null au-delà de 100 : sur devis). */
export const tranchePour = n => REGLES.ABONNEMENTS_PRO.find(t => Math.max(1, n) <= t.max) || null;
/** Prix mensuel HT d'une tranche pour n logements (centimes) : forfait de la tranche + prix par logement au-delà de son début. */
export const prixAbonnementProC = (t, n) => t.prixC + (t.parLogementC ? t.parLogementC * Math.max(0, n - (t.debut || 0)) : 0);
/** Abonnement réellement facturé pour un mois : jamais plus que les frais de service (8 %) qu'aurait coûté ce volume de ménages. */
export const abonnementFactureC = (t, n, volumeMoisC) => Math.min(prixAbonnementProC(t, n), Math.round((volumeMoisC || 0) * REGLES.FRAIS_SERVICE_PRO_PCT / 100));
/** Volume de ménages mensuel (centimes) à partir duquel l'abonnement coûte moins que les 8 % de frais (arrondi à l'euro supérieur). */
export const seuilAbonnementProC = (t, n) => Math.ceil(prixAbonnementProC(t, n) * 100 / REGLES.FRAIS_SERVICE_PRO_PCT / 100) * 100;

/** Dernier jour d'inscription pour l'offre de lancement (31 janvier 2027 inclus). */
export const finOffreLancement = () => { const [a, m, j] = REGLES.OFFRE_LANCEMENT_FIN_INSCRIPTION.split("-").map(Number); return new Date(a, m - 1, j, 23, 59, 59); };
/** Jours restants pour s'inscrire et profiter de l'offre (0 = terminée). */
export const joursOffreLancement = (maintenant = new Date()) => Math.max(0, Math.ceil((finOffreLancement() - maintenant) / 86400000));

/** Indemnité due au Cleaneur quand l'accès est impossible (même calcul que ReglesMetier.indemniteC et la base). */
export const indemniteAccesC = prixC => Math.min(REGLES.INDEMNITE_MAX_C, Math.max(REGLES.INDEMNITE_MIN_C, Math.round((prixC || 0) * REGLES.INDEMNITE_PCT / 100)));

/** Jour du versement d'une mission validée à la date d : le vendredi de la même semaine si elle est validée au plus tard
 *  le mercredi (minuit), sinon le vendredi suivant. Même calcul que ReglesMetier.dateVersement. */
/**
 * Formations exigées pour une prestation (12 novembre 2026, reprises de l'appli de Vincent). Copie de qualifs_requises
 * (outils/base-formations.sql) et de Regles.qualificationsRequises (appli). typeLieuId : type de lieu de la demande.
 */
/**
 * Formations exigées par la loi pour exercer (16 novembre 2026) : seules elles bloquent une prestation ou une mission.
 * Les autres formations (Socle Cleaneroo, quiz, techniques) sont conseillées, jamais imposées à un indépendant.
 * Même liste en base (modules_exiges_loi) et dans l'appli (Regles.MODULES_EXIGES_PAR_LA_LOI).
 */
export const MODULES_EXIGES_PAR_LA_LOI = ["nuisibles"];
/** Interventions spécialisées hors nuisibles (désinfection, après décès, sinistre, insalubrité) : produits biocides professionnels,
 *  Certibiocide « désinfectants » obligatoire depuis le 1er janvier 2026 (20/11/2026, audit). Même règle en base (formations_exigees). */
export const SPECIAUX_NUISIBLES = ["cafards", "punaises", "rats", "guepes"];
export const formationsExigees = (rubriqueId, typeLieuId = "", taches = []) => [...new Set([...qualificationsRequises(rubriqueId, typeLieuId, taches).filter(m => MODULES_EXIGES_PAR_LA_LOI.includes(m)),
  ...(rubriqueId === "special" && !SPECIAUX_NUISIBLES.includes(typeLieuId || "") ? ["biocides"] : [])])];
export const formationsConseillees = (rubriqueId, typeLieuId = "", taches = []) => qualificationsRequises(rubriqueId, typeLieuId, taches).filter(m => !formationsExigees(rubriqueId, typeLieuId, taches).includes(m));

export function qualificationsRequises(rubriqueId, typeLieuId = "", taches = []) {
  const t = typeLieuId || "";
  const selon = {
    home: ["domicile"], rental: ["domicile", "location"], moving: ["domicile"], car: ["auto"], textiles: ["textiles"],
    construction: ["remise-etat"], kitchen: !t || t === "particulier" ? ["domicile"] : ["cuisine-pro", "haccp"],
    office: t === "medical" ? ["locaux-pro", "bionettoyage"] : ["locaux-pro"], commerce: ["locaux-pro"], communal: ["locaux-pro"],
    windows: ["vitres"], outdoor: ["exterieurs"], pool: ["exterieurs"], event: ["evenementiel"], hospitality: ["domicile", "location"], leisure: ["auto"], boat: [],
    special: ["cafards", "punaises", "rats", "guepes"].includes(t) ? ["nuisibles"] : ["specialise"],
  }[rubriqueId] || [];
  // Selon les tâches cochées (comme l'appli de Vincent) : hauteur, machines, polissage, désinfection professionnelle.
  const t2 = taches || [], a = l => l.some(x => t2.includes(x));
  const plus = [...(a(["hauteur", "toiture"]) ? ["hauteur"] : []), ...(a(["autolaveuse", "decapage", "balayage"]) ? ["machines"] : []),
    ...(a(["polissage", "optiques"]) ? ["polissage"] : []),
    ...(a(["surfaces", "cabinets"]) || (rubriqueId === "office" && t === "medical") || (rubriqueId === "special" && !["cafards", "punaises", "rats", "guepes"].includes(t)) ? ["biocides"] : [])];
  return [...new Set(["socle", ...selon, ...plus])];
}

/**
 * « Mon activité » (copie de ReglesMetier.calculActivite) : factures du Cleaneur (prestation +, commission −) et pourboires,
 * sur le mois ou l'année en cours. Montants en centimes.
 */
export function calculActivite({ factures = [], pourboires = [], periode = "mois", acre = false, liberatoire = false, maintenant = new Date() }) {
  const an = maintenant.getFullYear(), mois = maintenant.getMonth();
  const date = s => { const [a, m] = String(s).slice(0, 10).split("-").map(Number); return { a, m: m - 1 }; };
  const dans = (s, p) => { const d = date(s); return d.a === an && (p === "annee" || d.m === mois); };
  const somme = (p, type) => factures.filter(f => f.type === type && dans(f.date_emission, p)).reduce((s, f) => s + f.total_ttc_c, 0);
  const ca = p => somme(p, "prestation") + pourboires.filter(x => dans(x.cree_le, p)).reduce((s, x) => s + (x.pourboire_c || 0), 0);
  const caC = ca(periode), commissionC = somme(periode, "commission");
  const tauxPct = tauxCotisationsPct(acre, liberatoire);
  const cotisationsC = Math.round(caC * tauxPct / 100);
  const caAnneeC = ca("annee");
  return { caC, commissionC, tauxPct, cotisationsC, resteC: Math.max(0, caC - commissionC - cotisationsC), caAnneeC,
    plafondPct: Math.min(100, Math.round(100 * caAnneeC / REGLES.PLAFOND_MICRO_SERVICES_C)) };
}

/** Taux de cotisations URSSAF (%) du Cleaneur micro-entrepreneur. acre : "" (sans ACRE), "depuis" (créée depuis le 1er juillet 2026),
 *  "avant" (créée avant ; true, l'ancienne case cochée, vaut "avant" pour ne rien changer aux réglages déjà enregistrés). */
export function tauxCotisationsPct(acre = "", liberatoire = false) {
  const base = acre === "depuis" ? REGLES.URSSAF_ACRE_PCT : acre === "avant" || acre === true ? REGLES.URSSAF_ACRE_AVANT_JUILLET_2026_PCT : REGLES.URSSAF_SERVICES_PCT;
  return Math.round((base + (liberatoire ? REGLES.VERSEMENT_LIBERATOIRE_PCT : 0)) * 10) / 10;
}

/** Frais Stripe d'un paiement (centimes) : pourcentage + part fixe, cartes standard de l'EEE. */
/** Pass Entretien : remise du palier pour un passage précédé de n passages comptés, et ce qu'il reste pour le palier suivant. */
export function palierPass(n = 0) {
  const paliers = REGLES.PASS_ENTRETIEN.PALIERS;
  const atteint = [...paliers].reverse().find(p => n >= p.apres);
  const suivant = paliers.find(p => n < p.apres);
  return { pct: atteint ? atteint.pct : 0, suivant: suivant ? { pct: suivant.pct, reste: suivant.apres - n } : null };
}
export const fraisStripeC = prixC => Math.round(prixC * REGLES.FRAIS_STRIPE_PCT / 100) + REGLES.FRAIS_STRIPE_FIXE_C;

/**
 * Vrai gain du Cleaneur sur une mission (26/11/2026, recrutement) : le Cleaneur déclare à l'URSSAF le prix TOTAL payé par le client,
 * pas le montant après commission. formule : "gratuit" ou "pro". Fonction pure, sans arrondi caché ; toutes les valeurs en centimes.
 */
export function gainCleaneur(prixC, dureeMin, formule = "gratuit") {
  const commissionPb = formule === "pro" ? REGLES.COMMISSION_PRO_PB : REGLES.COMMISSION_GRATUIT_PB;
  const verseC = Math.round(prixC * (10000 - commissionPb) / 10000);
  const stripeC = fraisStripeC(prixC);
  const cotisationsC = Math.round(prixC * REGLES.URSSAF_SERVICES_PCT / 100);
  const resteC = verseC - stripeC - cotisationsC;
  const heures = Math.max(1, dureeMin || 0) / 60;
  return { prixC, verseC, stripeC, cotisationsC, resteC, horaireAvantC: Math.round(verseC / heures), horaireNetC: Math.round(resteC / heures) };
}

/** Niveau du Cleaneur (copie de niveau_de en base) : 0 Cleaneur, 1 Confirmé, 2 Expert, 3 Élite. */
export function niveauCleaneur({ missions = 0, note = 0, annulationPct = 0, avertissements = 0 }) {
  let n = 0;
  REGLES.NIVEAUX.forEach((x, i) => { if (missions >= x.missions && (note || 0) >= x.note) n = i; });
  if (annulationPct > REGLES.ANNULATION_MAX_NIVEAU_PCT) n--;
  if (avertissements > 0) n--;
  return Math.max(0, n);
}

/** Proposition d'un Cleaneur (copie de proposer en base) : "ok", "remise", "devis", "justification" ou "raison". */
export function verifierProposition(estimationC, prixC, raison = "", note = "") {
  if (prixC < Math.round(estimationC * (100 - REGLES.PROPOSITION_REMISE_MAX_PCT) / 100)) return "remise";
  if (prixC > Math.round(estimationC * (100 + REGLES.PROPOSITION_HAUSSE_MAX_PCT) / 100)) return "devis";
  const hausses = ["TEMPS", "ETAT", "ACCES", "MATERIEL", "AUTRE_HAUSSE"], remises = ["PROXIMITE", "LANCEMENT", "FIDELITE", "AUTRE_REMISE"];
  if (prixC > estimationC && (!hausses.includes(raison) || note.trim().length < REGLES.PROPOSITION_NOTE_MIN)) return "justification";
  if (prixC < estimationC && !remises.includes(raison)) return "raison";
  return "ok";
}

/** Portefeuille : net de l'année = prestations − commissions + pourboires + primes − moins-values (centimes). */
export const netPortefeuille = p => (p.prestations_c || 0) - (p.commissions_c || 0) + (p.pourboires_c || 0) + (p.primes_c || 0) - (p.moins_values_c || 0);

/**
 * Score de recommandation d'une mission (copie de MissionsRegles.score dans l'appli, repris de Vincent) :
 * distance (40 − 1,2 × km), enchaînement ≤ 60 min (25) sinon créneau ouvert (12), proximité dans le temps (15 − 2 × jours),
 * gain net par heure (÷ 150, 20 au plus), + 100 si mission d'urgence. Compatibilité affichée sur 100.
 */
export function scoreMission({ km = 15, enchainementMin = null, dansCreneaux = false, jours = 7, netParHeureC = 0, urgence = false }) {
  const distance = Math.max(0, 40 - 1.2 * km);
  const planning = enchainementMin != null && enchainementMin <= 60 ? 25 : dansCreneaux ? 12 : 0;
  const temps = Math.max(0, 15 - 2 * jours);
  const gain = Math.min(20, netParHeureC / 150);
  return Math.round(distance + planning + temps + gain + (urgence ? 100 : 0));
}

/** Frais de déplacement indicatifs pour une distance (km) — copie de MissionsRegles.fraisDeplacement (appli). */
export function fraisDeplacementC(km) {
  const f = REGLES.FRAIS_DEPLACEMENT;
  if (km <= f.inclusKm) return 0;
  if (km <= f.palier1Km) return f.palier1C;
  if (km <= f.palier2Km) return f.palier2C;
  return Math.min(f.maxC, Math.round(km * 2 * f.parKmC));
}

export function dateVersement(d = new Date()) {
  const iso = ((d.getDay() + 6) % 7) + 1;   // lundi = 1 … dimanche = 7
  const jours = iso <= REGLES.VERSEMENT_LIMITE_JOUR_ISO ? REGLES.VERSEMENT_JOUR_ISO - iso : REGLES.VERSEMENT_JOUR_ISO - iso + 7;
  const v = new Date(d.getFullYear(), d.getMonth(), d.getDate() + jours);
  return v;
}

/** Lien WhatsApp vers le support Cleaneroo, avec un message déjà écrit. */
export const lienWhatsAppSupport = (texte = "Bonjour Cleaneroo, ") => `https://wa.me/${REGLES.WHATSAPP_SUPPORT}?text=${encodeURIComponent(texte)}`;

// Moyens de paiement affichés (prompt 2, partie 3). Apple Pay et Google Pay ne s'affichent que lorsqu'ils sont activés
// dans le tableau de bord Stripe (Réglages → Moyens de paiement) : passer alors cette constante à true.
export const PORTEFEUILLES_ACTIFS = false;
// Logos officiels (fichiers fournis par chaque marque, jamais redessinés) : à déposer dans assets/img/paiement/
// (visa.svg, mastercard.svg, cb.svg, stripe.svg, apple-pay.svg, google-pay.svg), puis passer cette constante à true.
// Tant qu'elle vaut false, les noms des moyens de paiement s'affichent en texte.
export const LOGOS_PAIEMENT_OFFICIELS = false;

/** Photos avant obligatoires pour cette rubrique (au moins une photo avant et une photo après par pièce ou par zone contrôlée). */
export const photosAvantObligatoires = rubriqueId => !!rubriqueId && !REGLES.PHOTOS_AVANT_SAUF.includes(rubriqueId);
