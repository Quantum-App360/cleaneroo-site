# Illustrations neutres « Exemple » pour le curseur avant / après (dessinées, aucune photo).
import random, os
D=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "img", "avant-apres")
W,H=1200,800
def svg(corps): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{corps}</svg>'
def taches(seed, zones, n, couleurs):
    r=random.Random(seed); out=[]
    for _ in range(n):
        x0,y0,x1,y1=r.choice(zones); x=r.uniform(x0,x1); y=r.uniform(y0,y1)
        rx=r.uniform(14,48); ry=rx*r.uniform(.5,1); c=r.choice(couleurs); o=r.uniform(.25,.55)
        out.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" fill="{c}" opacity="{o:.2f}" transform="rotate({r.uniform(0,180):.0f} {x:.0f} {y:.0f})"/>')
    return "".join(out)
def eclats(pts):
    s=""
    for x,y,t in pts:
        s+=f'<path d="M{x} {y-t}Q{x+t*.18} {y-t*.18} {x+t} {y}Q{x+t*.18} {y+t*.18} {x} {y+t}Q{x-t*.18} {y+t*.18} {x-t} {y}Q{x-t*.18} {y-t*.18} {x} {y-t}Z" fill="#fff" opacity=".95"/>'
    return s
voile_sale='<rect width="1200" height="800" fill="#7a6a4a" opacity=".16"/>'

# --- Salle de bain
carrelage="".join(f'<rect x="{x}" y="{y}" width="118" height="118" fill="none" stroke="#c9dcdf" stroke-width="3"/>' for x in range(0,1200,120) for y in range(0,520,120))
sdb=f'''<rect width="1200" height="800" fill="#eef6f7"/>{carrelage}
<rect y="520" width="1200" height="280" fill="#d9e6e3"/>
<rect x="90" y="330" width="560" height="260" rx="60" fill="#ffffff" stroke="#b9cfd2" stroke-width="6"/>
<rect x="120" y="350" width="500" height="70" rx="30" fill="#e6f3f5"/>
<path d="M560 330V230a40 40 0 0 1 80 0" fill="none" stroke="#9fb3b6" stroke-width="14" stroke-linecap="round"/>
<rect x="760" y="150" width="300" height="220" rx="20" fill="#dff1f6" stroke="#b9cfd2" stroke-width="6"/>
<rect x="790" y="420" width="240" height="60" rx="14" fill="#ffffff" stroke="#b9cfd2" stroke-width="6"/>
<rect x="840" y="480" width="140" height="190" rx="16" fill="#f4f8f8" stroke="#b9cfd2" stroke-width="6"/>
<path d="M910 420v-34h40" fill="none" stroke="#9fb3b6" stroke-width="12" stroke-linecap="round"/>'''
sdb_sale=taches(1,[(110,350,630,580),(780,170,1040,360),(800,425,1020,470),(0,0,1200,500)],55,["#8a7a52","#6f6450","#a08f5c"])
# --- Canapé
canape=f'''<rect width="1200" height="800" fill="#f6f1ea"/><rect y="600" width="1200" height="200" fill="#e7dccd"/>
<rect x="120" y="230" width="960" height="250" rx="60" fill="#6fa6b8"/>
<rect x="120" y="400" width="960" height="190" rx="40" fill="#5f97aa"/>
<rect x="160" y="300" width="290" height="190" rx="40" fill="#7fb4c5"/><rect x="455" y="300" width="290" height="190" rx="40" fill="#7fb4c5"/><rect x="750" y="300" width="290" height="190" rx="40" fill="#7fb4c5"/>
<rect x="80" y="330" width="110" height="270" rx="44" fill="#5a8fa1"/><rect x="1010" y="330" width="110" height="270" rx="44" fill="#5a8fa1"/>
<rect x="180" y="590" width="30" height="60" rx="8" fill="#8a6f52"/><rect x="990" y="590" width="30" height="60" rx="8" fill="#8a6f52"/>
<circle cx="320" cy="200" r="0" fill="none"/>'''
canape_sale=taches(2,[(170,300,1040,580)],40,["#5b4630","#7a5a3a","#3f3a2c"])
# --- Voiture
voiture=f'''<rect width="1200" height="800" fill="#e9f2f8"/><rect y="560" width="1200" height="240" fill="#cfd8de"/>
<path d="M170 520 L250 400 Q290 340 360 330 L760 320 Q840 320 900 380 L990 450 Q1060 460 1070 520 L1070 560 L170 560Z" fill="#e2574c"/>
<path d="M330 400 Q360 355 410 350 L560 345 L560 420 L320 420Z" fill="#bfe3f2"/><path d="M590 345 L760 342 Q820 345 860 410 L860 420 L590 420Z" fill="#bfe3f2"/>
<circle cx="340" cy="560" r="78" fill="#2c3338"/><circle cx="340" cy="560" r="36" fill="#c9d1d6"/>
<circle cx="900" cy="560" r="78" fill="#2c3338"/><circle cx="900" cy="560" r="36" fill="#c9d1d6"/>
<rect x="1010" y="470" width="50" height="22" rx="8" fill="#fff4c7"/>'''
corps_voiture="M170 520 L250 400 Q290 340 360 330 L760 320 Q840 320 900 380 L990 450 Q1060 460 1070 520 L1070 560 L170 560Z"
voiture_sale=(f'<defs><clipPath id="cv"><path d="{corps_voiture}"/></clipPath></defs><g clip-path="url(#cv)">'
  + taches(3,[(180,340,1060,555)],38,["#7a6a4a","#5d5240","#8f7f5a"]).replace('rx="4','rx="2').replace('rx="3','rx="2') + '</g>'
  + taches(4,[(260,500,420,620),(820,500,980,620)],10,["#6b5d45"]))
def etiquette(t): return ""
for nom,base,sale,brille in [("salle-de-bain",sdb,sdb_sale,[(420,380,26),(910,230,30),(980,450,18),(250,430,16)]),
                             ("canape",canape,canape_sale,[(300,360,24),(640,370,28),(930,350,20)]),
                             ("voiture",voiture,voiture_sale,[(470,380,26),(720,380,22),(980,470,18),(300,470,16)])]:
    open(f"{D}/{nom}-avant.svg","w").write(svg(base+sale+voile_sale))
    open(f"{D}/{nom}-apres.svg","w").write(svg(base+eclats(brille)))
print(os.listdir(D))
