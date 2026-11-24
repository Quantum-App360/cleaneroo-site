# Prompt 3 (vocabulaire), validé par Michael le 24/11/2026 : remplacements dans le code et dans langue.js (4 langues).
import glob, json, re, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# [ancien FR, nouveau FR, (EN, IT, ES) ou None pour garder les traductions]
PHRASES = [
 ["Le ménage nouvelle génération", "Un ménage moderne et transparent", ("Modern, transparent cleaning", "Pulizie moderne e trasparenti", "Una limpieza moderna y transparente")],
 ["À l'ancienne", "Ménage traditionnel", ("Traditional cleaning", "Pulizie tradizionali", "Limpieza tradicional")],
 ["On ne sait pas vraiment", "Identité rarement vérifiée", ("Identity rarely checked", "Identità raramente verificata", "Identidad rara vez verificada")],
 ["On attend sans nouvelles", "Attente sans information", ("Waiting with no information", "Attesa senza informazioni", "Espera sin información")],
 ["En cas de souci", "En cas de problème", ("If there is a problem", "In caso di problemi", "En caso de problema")],
 ["Votre parole contre la sienne", "Aucune preuve en cas de litige", ("No proof in case of dispute", "Nessuna prova in caso di controversia", "Ninguna prueba en caso de litigio")],
 ["Juste connaître le prix ? Estimer mon prix ›", "Seulement le prix ? Estimer mon prix ›", ("Just the price? Get my price ›", "Solo il prezzo? Stima il mio prezzo ›", "¿Solo el precio? Calcular mi precio ›")],
 ["Juste être prévenu du lancement ?", "Être informé de l'ouverture des réservations ?", ("Be informed when bookings open?", "Essere informato dell'apertura delle prenotazioni?", "¿Recibir aviso cuando se abran las reservas?")],
 ["Parfait ! Bonne journée avec Cleaneroo.", "Nous sommes heureux d'avoir pu vous aider. Bonne journée.", ("We're glad we could help. Have a good day.", "Siamo lieti di averti aiutato. Buona giornata.", "Nos alegra haberte ayudado. Que tengas un buen día.")],
 ["C'est noté !", "C'est enregistré.", ("Saved.", "Registrato.", "Registrado.")],
 ["Bravo, formation validée !", "Formation validée.", ("Training completed.", "Formazione convalidata.", "Formación validada.")],
 ["Vous avez atteint le plus haut niveau. Bravo !", "Félicitations : vous avez atteint le plus haut niveau.", ("Congratulations: you have reached the highest level.", "Congratulazioni: hai raggiunto il livello più alto.", "Enhorabuena: has alcanzado el nivel más alto.")],
 ["Aucun filleul pour l'instant : partagez votre code !", "Aucun filleul pour l'instant. Partagez votre code pour en parrainer.", ("No referrals yet. Share your code to refer someone.", "Nessun invitato per ora. Condividi il tuo codice per invitare qualcuno.", "Ningún ahijado por ahora. Comparte tu código para invitar a alguien.")],
 ["Oui, il est là", "Oui, il est arrivé", ("Yes, they have arrived", "Sì, è arrivato", "Sí, ha llegado")],
 ["Cela répond à votre question ?", "Cette réponse vous a-t-elle aidé ?", ("Did this answer help you?", "Questa risposta ti è stata utile?", "¿Te ha ayudado esta respuesta?")],
 ["Abonnement à payer même les mois calmes", "Abonnement dû même en période de faible activité", ("Subscription due even in quiet periods", "Abbonamento dovuto anche nei periodi di bassa attività", "Suscripción debida incluso en periodos de poca actividad")],
 ["Vous ne pouvez pas perdre :", "Votre garantie :", ("Your guarantee:", "La tua garanzia:", "Tu garantía:")],
 ["Trop petite pour vos", "Insuffisante pour vos", None],
 ["Personne n'a encore accepté ce ménage. Augmentez le prix pour le confier plus vite.", "Aucun Cleaneur n'a encore accepté ce ménage. Vous pouvez augmenter le prix pour qu'il soit attribué plus rapidement.",
  ("No Cleaneur has accepted this clean yet. You can raise the price so that it is assigned more quickly.", "Nessun Cleaneur ha ancora accettato questa pulizia. Puoi aumentare il prezzo perché venga assegnata più rapidamente.", "Ningún Cleaneur ha aceptado aún esta limpieza. Puedes aumentar el precio para que se asigne más rápido.")],
 ["Cette demande est annulée. Aucun débit n'a été effectué.", "Cette demande est annulée. Si vous aviez déjà payé, vous êtes remboursé (5 à 10 jours selon votre banque).",
  ("This request is cancelled. If you had already paid, you are refunded (5 to 10 days depending on your bank).", "Questa richiesta è annullata. Se avevi già pagato, vieni rimborsato (da 5 a 10 giorni secondo la tua banca).", "Esta solicitud está cancelada. Si ya habías pagado, se te reembolsa (de 5 a 10 días según tu banco).")],
]
# Remplacements à l'intérieur des textes français (clés de langue.js comprises) : [ancien, nouveau]
DANS_FR = [
 ["Code reconnu ! ", "Code reconnu. "], ["Bienvenue ! Vous avez", "Bienvenue. Vous avez"],
 ["Merci pour votre avis !", "Merci pour votre avis."], ["Merci de votre confiance !", "Merci de votre confiance."],
 ["vous touchez", "vous percevez"], ["l'appli vous guide", "l'application vous guide"], ["(frigo, micro-ondes", "(réfrigérateur, micro-ondes"],
 ["tous d'un coup", "tous en une seule fois"], ["logements d'un coup", "logements en une seule fois"],
 ["un petit quiz", "un court questionnaire"], ["et petit quiz", "et court questionnaire"], ["Petit quiz de compétence", "Court questionnaire de compétence"],
 ["comme une livraison", "comme le suivi d'un colis"],
 ["Touchez", "Sélectionnez"], ["touchez", "sélectionnez"],
 # « selfie » → « photo de vérification » (accords au féminin)
 ["Votre selfie n'a pas été accepté : reprenez-en un", "Votre photo de vérification n'a pas été acceptée : reprenez-en une"],
 ["Le selfie n'a pas pu être envoyé", "La photo de vérification n'a pas pu être envoyée"],
 ["Aucun selfie pour l'instant.", "Aucune photo de vérification pour l'instant."],
 ["Prenez d'abord votre selfie du jour", "Prenez d'abord votre photo de vérification du jour"],
 ["Prendre mon selfie", "Prendre ma photo de vérification"],
 ["Selfie du jour envoyé", "Photo de vérification du jour envoyée"],
 ["Selfies des Cleaneurs (7 derniers jours)", "Photos de vérification des Cleaneurs (7 derniers jours)"],
 ["Selfies des 7 derniers jours", "Photos de vérification des 7 derniers jours"],
 ["Selfies du jour", "Photos de vérification du jour"], ["Selfie du jour", "Photo de vérification du jour"],
 ["le chef d'équipe fait le selfie", "le chef d'équipe prend la photo de vérification"],
 ["votre selfie du jour", "votre photo de vérification du jour"], ["votre selfie.", "votre photo de vérification."],
 ["comparaison avec le selfie du jour", "comparaison avec la photo de vérification du jour"],
 ["selfie du jour", "photo de vérification du jour"], ["selfie, trajet", "photo de vérification, trajet"],
]
DANS_TRAD = [
 ["Your selfie wasn't accepted", "Your verification photo wasn't accepted"], ["The selfie couldn't be sent", "The verification photo couldn't be sent"],
 ["No selfies yet.", "No verification photos yet."], ["First take today's selfie", "First take today's verification photo"],
 ["Take my selfie", "Take my verification photo"], ["Today's selfie sent", "Today's verification photo sent"], ["Today's selfies", "Today's verification photos"],
 ["Today's selfie", "Today's verification photo"], ["Cleaneurs' selfies", "Cleaneurs' verification photos"], ["the team leader does the selfie", "the team leader takes the verification photo"],
 ["today's selfie", "today's verification photo"], ["selfie of the day", "verification photo of the day"], ["daily selfie", "daily verification photo"], ["your selfie.", "your verification photo."],
 ["selfie, journey", "verification photo, journey"],
 ["Il tuo selfie non è stato accettato: rifallo", "La tua foto di verifica non è stata accettata: rifalla"], ["Scatta il mio selfie", "Scatta la mia foto di verifica"],
 ["Scatta prima il selfie del giorno", "Scatta prima la foto di verifica del giorno"], ["inviare il selfie", "inviare la foto di verifica"],
 ["Nessun selfie per ora.", "Nessuna foto di verifica per ora."], ["Selfie dei Cleaneur", "Foto di verifica dei Cleaneur"], ["il caposquadra fa il selfie", "il caposquadra scatta la foto di verifica"],
 ["Selfie del giorno inviato", "Foto di verifica del giorno inviata"], ["Selfie del giorno", "Foto di verifica del giorno"], ["il selfie del giorno", "la foto di verifica del giorno"],
 ["selfie del giorno", "foto di verifica del giorno"], ["il tuo selfie.", "la tua foto di verifica."], ["selfie, tragitto", "foto di verifica, tragitto"],
 ["Tu selfie no ha sido aceptado: hazte otro", "Tu foto de verificación no ha sido aceptada: hazte otra"], ["Hacerme el selfie", "Hacer mi foto de verificación"],
 ["Hazte primero el selfie del día", "Hazte primero la foto de verificación del día"], ["enviar el selfie", "enviar la foto de verificación"],
 ["Ningún selfie por ahora.", "Ninguna foto de verificación por ahora."], ["Selfies de los Cleaneurs", "Fotos de verificación de los Cleaneurs"],
 ["Selfie del día enviado", "Foto de verificación del día enviada"], ["Selfie del día", "Foto de verificación del día"], ["el selfie del día", "la foto de verificación del día"],
 ["selfie del día", "foto de verificación del día"], ["selfie, trayecto", "foto de verificación, trayecto"],
]
fichiers = [f for f in glob.glob("assets/js/*.js") if not f.endswith("langue.js")] + ["index.html", "gestion.html"] + glob.glob("menage/*/index.html") + ["outils/generer_pages.py"]
compte = 0
def remplacer(s, a, b):
    global compte
    n = s.count(a); compte += n; return s.replace(a, b)
for f in fichiers:
    s0 = s = open(f, encoding="utf-8", newline="").read()
    for a, b, _ in PHRASES: s = remplacer(s, a, b)
    # Dans le code : jamais dans les noms techniques (selfie_du_jour, data-selfie…) : seuls les textes avec espaces ou majuscules changent.
    for a, b in DANS_FR: s = remplacer(s, a, b)
    if s != s0: open(f, "w", encoding="utf-8", newline="").write(s)
# langue.js : remplacer les lignes entières des PHRASES, puis les morceaux
p = "assets/js/langue.js"; lignes = open(p, encoding="utf-8").read().split("\n")
for i, l in enumerate(lignes):
    if not l.startswith('  ["'): continue
    try: e = json.loads(l.strip().rstrip(","))
    except Exception: continue
    for a, b, t in PHRASES:
        if e[0] == a:
            e[0] = b
            if t: e[1:4] = list(t)
    e[0] = e[0]
    for a, b in DANS_FR: e[0] = e[0].replace(a, b)
    for k in (1, 2, 3):
        if k < len(e) and isinstance(e[k], str):
            for a, b in DANS_TRAD: e[k] = e[k].replace(a, b)
    nouvelle = "  " + json.dumps(e, ensure_ascii=False) + ("," if l.rstrip().endswith(",") else "")
    if nouvelle != l: lignes[i] = nouvelle; compte += 1
open(p, "w", encoding="utf-8").write("\n".join(lignes))
print("remplacements :", compte)
