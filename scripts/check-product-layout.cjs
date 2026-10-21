const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const {chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseURL = process.env.KALOPS_BASE_URL || 'http://127.0.0.1:5173';
const widths = [360,390,768,1440];

async function expectVisible(page, selector, expected, label) {
  await page.waitForFunction(({selector,expected}) => {
    const el = document.querySelector(selector);
    if (!el) return !expected;
    const box = el.getBoundingClientRect(), style = getComputedStyle(el);
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
    return visible === expected;
  }, {selector,expected}, {timeout:5000}).catch(() => {throw Error(label + ': visibilidade incorreta de ' + selector);});
}
async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(sizes.document <= sizes.width + 1 && sizes.body <= sizes.width + 1, label + ': overflow horizontal ' + JSON.stringify(sizes));
}
async function imagesContain(page, selector, count, label) {
  const images = page.locator(selector);
  assert.equal(await images.count(), count, label + ': quantidade de imagens');
  await images.evaluateAll(nodes => Promise.all(nodes.map(img => {img.loading='eager';return img.decode();})));
  const evidence = await images.evaluateAll(nodes => nodes.map(img => {
    const style=getComputedStyle(img), rect=img.getBoundingClientRect();
    const matrix=style.transform==='none'?null:new DOMMatrixReadOnly(style.transform);
    return {src:img.getAttribute('src'),natural:[img.naturalWidth,img.naturalHeight],box:[rect.width,rect.height],fit:style.objectFit,scaleX:matrix?Math.hypot(matrix.a,matrix.b):1,scaleY:matrix?Math.hypot(matrix.c,matrix.d):1};
  }));
  for(const image of evidence) {
    assert(image.natural.every(n=>n>0), label+': imagem não carregou '+image.src);
    assert(image.box.every(n=>n>0), label+': imagem sem área');
    assert.equal(image.fit,'contain',label+': foto precisa aparecer inteira');
    assert(Math.abs(image.scaleX-image.scaleY)<.001,label+': imagem deformada por transformação');
  }
}
async function belowHero(page) {
  await page.evaluate(() => scrollTo({top:scrollY+document.querySelector('.hero').getBoundingClientRect().bottom+8,behavior:'instant'}));
  assert(await page.locator('.hero').evaluate(el=>el.getBoundingClientRect().bottom<=0),'Hero precisa ter saído da tela.');
}
(async()=>{
  const {products}=await import(pathToFileURL(path.resolve(__dirname,'../src/products.js')).href);
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    for(const width of widths) {
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(baseURL);
      await page.getByRole('heading',{level:1}).waitFor();
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.hero-art,.hero-image-composition,.hero-item').count(),0,`${width}px: remover bloco hero de três produtos`);
      await expectVisible(page,'.mobile-order-bar',false,`${width}px hero`);
      await noOverflow(page,`${width}px home topo`);
      await imagesContain(page,'.product-card .product-photo > img',5,`${width}px catálogo`);
      await belowHero(page);
      await expectVisible(page,'.mobile-order-bar',width<=700,`${width}px após hero`);
      await noOverflow(page,`${width}px catálogo`);
      if(width<=700) await page.locator('.mobile-order-bar button').click();
      else await page.locator('.bag-button').click();
      await page.getByRole('dialog',{name:'Meu pedido',exact:true}).waitFor();
      await expectVisible(page,'.mobile-order-bar',false,`${width}px drawer home`);
      await noOverflow(page,`${width}px drawer home`);
      await page.keyboard.press('Escape');

      for(const product of products) {
        await page.goto(new URL(product.path,baseURL).href);
        await page.getByRole('heading',{level:1,name:product.name,exact:true}).waitFor();
        assert.equal(await page.locator('.product-detail-page').count(),1,`${width}px ${product.name}: PDP independente`);
        await expectVisible(page,'.mobile-order-bar',false,`${width}px ${product.name}: sem barra home`);
        await imagesContain(page,'.product-detail-image .product-photo > img',1,`${width}px ${product.name}`);
        await noOverflow(page,`${width}px ${product.name} topo`);
        await expectVisible(page,'.product-purchase-bar',width<=700,`${width}px ${product.name}: compra contextual`);
        await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
        await expectVisible(page,'.mobile-order-bar',false,`${width}px ${product.name}: scroll não traz barra home`);
        await noOverflow(page,`${width}px ${product.name} rodapé`);
        if(width<=700) {
          const position=await page.locator('.product-purchase-bar').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
          assert(position.bottom<=position.height+1 && position.top>=0,`${width}px ${product.name}: barra de compra fora da tela`);
          if(product.id===products[0].id) {
            await page.locator('.product-purchase-bar button').click();
            await page.getByRole('button',{name:'Abrir pedido com 10 unidades',exact:true}).waitFor();
          }
        }
        await page.locator('.bag-button').click();
        await page.getByRole('dialog',{name:'Meu pedido',exact:true}).waitFor();
        if(width<=700&&product.id===products[0].id) assert.equal(await page.getByRole('spinbutton',{name:'Quantidade de '+product.name,exact:true}).inputValue(),'10',`${width}px: compra pela barra PDP`);
        await expectVisible(page,'.mobile-order-bar',false,`${width}px ${product.name}: drawer sem barra home`);
        await expectVisible(page,'.product-purchase-bar',false,`${width}px ${product.name}: drawer sem barra PDP`);
        await noOverflow(page,`${width}px ${product.name}: drawer`);
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors,[],`${width}px: erros JavaScript`);
      console.log(`PASS ${width}px: hero sem trio, catálogo e cinco PDPs sem overflow, fotos contain, barra home contextual e compra mobile sem conflito com drawer.`);
      await context.close();
    }
    console.log('PASS: 360/390/768/1440px. Validação técnica de geometria não estabelece procedência nem fidelidade das fotografias.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
