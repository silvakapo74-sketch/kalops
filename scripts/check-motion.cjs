const assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.KALOPS_BASE_URL||'http://127.0.0.1:5173';
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base);await page.locator('.product-card').first().waitFor();
      await page.locator('.add-button').first().click();
      await page.locator('.add-button.is-added').waitFor();
      assert.equal(await page.locator('.bag-button b').textContent(),'10');
      await page.locator('.bag-button').click();
      assert(await page.locator('.cart-drawer').evaluate(el=>el.getAnimations().some(a=>a.animationName==='kalops-drawer-in')),'Drawer slides in');
      assert(await page.locator('.cart-drawer').evaluate(el=>el.contains(document.activeElement)),'Focus enters cart');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(),0,'Closing shell is immediately inaccessible');
      assert(await page.locator('.overlay.is-closing').evaluate(el=>el.inert),'Closing shell is inert');
      assert(await page.locator('.bag-button').evaluate(el=>el===document.activeElement),'Focus returns to opener');
      // Reopen before the close timer fires: the old timer must not dismiss it.
      await page.locator('.bag-button').evaluate(el=>el.click());
      await page.waitForTimeout(280);
      await page.getByRole('dialog',{name:'Meu pedido'}).waitFor();
      await page.getByRole('button',{name:'Fechar pedido'}).click();
      await page.locator('.overlay').waitFor({state:'detached'});
      assert(await page.evaluate(()=>document.body.style.overflow!== 'hidden'));
      if(width===390){
        await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
        assert.equal(await page.locator('.mobile-menu').getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Escape');
        await page.locator('nav.open').waitFor({state:'detached'});
      }
      await page.getByRole('button',{name:'Barba',exact:true}).click();
      assert.equal(await page.locator('.product-card').count(),2);
      await page.locator('.product-title').first().click();
      await page.locator('.product-detail-top').waitFor();
      assert(await page.locator('.product-detail-top').evaluate(el=>el.getAnimations({subtree:true}).length>0),'Product navigation animates');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(40);
      assert.equal(await page.locator('.product-detail-top').evaluate(el=>el.getAnimations({subtree:true}).length),0,'Live reduced-motion preference cancels page animations');
      await page.locator('.bag-button').click();
      assert.equal(await page.locator('.cart-drawer').evaluate(el=>el.getAnimations().length),0,'Reduced motion disables drawer animation');
      await page.keyboard.press('Escape');
      await page.locator('.overlay').waitFor({state:'detached'});
      await page.locator('.product-detail-image img').evaluate(img=>img.decode());
      assert.equal(await page.locator('.product-detail-image img').evaluate(el=>getComputedStyle(el).objectFit),'contain');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px: add feedback, drawer entry/exit/rapid reopen/focus, menu, filtering, page motion, live reduced motion, proportional photos.`);
      await page.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
