# Captures de référence (avant / après) pour vérifier qu'un changement de CSS ne modifie pas l'affichage.
import asyncio, sys, os
from playwright.async_api import async_playwright
SORTIE = sys.argv[1]
PAGES = ["#/", "#/prestations", "#/comment-ca-marche", "#/qui-sommes-nous", "#/reserver/home", "#/reserver/car", "#/estimer/home",
         "#/devenir-cleaneur", "#/garantie", "#/aide", "#/gestion-des-avis", "#/compte", "#/icones", "#/formation/socle", "#/suivi-demo"]
INIT = """Math.random = (() => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
localStorage.setItem('cleaneroo-langue','fr');"""
async def main():
  os.makedirs(SORTIE, exist_ok=True)
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for w, h in [(1280, 900), (390, 844)]:
      for mode in ["client", "cleaneur"]:
        ctx = await b.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce")
        await ctx.clock.install(time=1795521600000)  # 24/11/2026 10:00
        pg = await ctx.new_page()
        await pg.add_init_script(INIT + (f"localStorage.setItem('cleaneroo-mode','{mode}');"))
        for i, hsh in enumerate(PAGES):
          await pg.goto("http://localhost:8765/index.html" + hsh); await pg.wait_for_timeout(1200)
          await ctx.clock.run_for(3000)
          await pg.evaluate("document.querySelectorAll('.revele,.etape').forEach(e=>e.classList.add('visible'))")
          await pg.add_style_tag(content="*{animation:none!important;transition:none!important;caret-color:transparent!important} video{visibility:hidden}")
          await pg.wait_for_timeout(300)
          await pg.screenshot(path=f"{SORTIE}/{w}-{mode}-{i:02d}.png", full_page=True)
        await ctx.close()
    await b.close()
asyncio.run(main())
