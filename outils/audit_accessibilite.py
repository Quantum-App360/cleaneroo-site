# Audit du lot 8 : débordements horizontaux et règles WCAG A/AA (axe-core) sur les pages principales, à 390 et 1280 px.
# Prérequis : serveur de test sur le port 8765 (site + stub), axe-core dans /tmp/axe (npm i axe-core). Usage : python3 audit_accessibilite.py light|dark
import asyncio, json, sys, datetime
from playwright.async_api import async_playwright
AXE=open('/tmp/axe/node_modules/axe-core/axe.min.js').read()
exec(open('/tmp/cleaneur.py').read().split("async def main")[0])
VIS=["#/","#/prestations","#/comment-ca-marche","#/qui-sommes-nous","#/reserver/home","#/estimer/home","#/devenir-cleaneur","#/garantie","#/aide","#/gestion-des-avis","#/carte","#/recherche","#/suivi-demo","#/compte"]
CLI=["#/tableau","#/notifications","#/messages","#/mes-demandes","#/mes-biens","#/compte"]
CLN=["#/compte/cleaneur"]
PCLI={"prenom":"Michael","statuts":["particulier"],"espace":"particulier","role":"client","email":"m@x.fr"}
async def run(pg, h, label, w):
  await pg.goto("http://localhost:8765/index.html"+h); await pg.wait_for_timeout(2200)
  ov=await pg.evaluate("""()=>{const W=innerWidth;const out=[];if(document.documentElement.scrollWidth>W+1){document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0&&getComputedStyle(e).position!=='fixed'){let p=e.parentElement,ok=true;while(p){const o=getComputedStyle(p).overflowX;if(o==='hidden'||o==='auto'||o==='scroll'||o==='clip'){ok=false;break}p=p.parentElement}if(ok)out.push((e.className&&e.className.baseVal===undefined?e.tagName+'.'+String(e.className).split(' ').join('.'):e.tagName)+' '+Math.round(r.right))}})}return [document.documentElement.scrollWidth,out.slice(0,6)]}""")
  await pg.add_script_tag(content=AXE)
  res=await pg.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},resultTypes:['violations']});return r.violations.map(v=>[v.id,v.impact,v.nodes.length,v.nodes.slice(0,3).map(n=>n.target.join(' ')+(n.any[0]?' :: '+n.any[0].message.slice(0,110):''))])}""")
  print(f"== {label} {w} {h} largeur={ov[0]}", ("DEBORDE "+str(ov[1])) if ov[0]>w+1 else "")
  for v in res: print("   ",v[0],v[1],v[2],v[3])
async def main():
  scheme=sys.argv[1] if len(sys.argv)>1 else "light"
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for w in [390,1280]:
      for label,pages,init in [("visiteur",VIS,""),("client",CLI,"globalThis.__session={user:{id:'u'}};globalThis.__profil="+json.dumps(PCLI)+";globalThis.__demandes=[];"),("cleaneur",CLN,f"globalThis.__session={{user:{{id:'u'}}}};globalThis.__profil={json.dumps(PROF)};globalThis.__miennes={json.dumps(MIEN)};globalThis.__dispo={json.dumps(DISPO)};globalThis.__selfie='VALIDE';localStorage.setItem('cleaneroo-mode','cleaneur');")]:
        ctx=await b.new_context(viewport={"width":w,"height":900},color_scheme=scheme,reduced_motion="reduce")
        pg=await ctx.new_page(); pg.on("pageerror",lambda e:print("   pageerror",e))
        await pg.add_init_script(init+"localStorage.setItem('cleaneroo-langue','fr');")
        for h in pages: await run(pg,h,label,w)
        await ctx.close()
    await b.close()
asyncio.run(main())
