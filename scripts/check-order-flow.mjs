// Browser integration against the real API handlers with isolated test storage.
// Never sends orders to the deployed store.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createOrdersAPI} from '../server/orders-core.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const rows=new Map();
const store={
  get:async id=>rows.get(id)||null,
  create:async order=>{if(rows.has(order.id))return false;rows.set(order.id,structuredClone(order));return true;},
  list:async()=>({orders:[...rows.values()],nextCursor:null}),
  updateStatus:async(id,status,updatedAt)=>{const row=rows.get(id);if(!row)return null;const updated={...row,status,updatedAt};rows.set(id,updated);return updated;},
};
const password='test-only-admin-password-1234';
const handler=createOrdersAPI({getStore:()=>store,env:{KALOPS_ADMIN_PASSWORD:password}});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/api/**',async route=>{
    const request=route.request();
    const response=await handler(new Request(request.url(),{method:request.method(),headers:await request.allHeaders(),...(['GET','HEAD'].includes(request.method())?{}:{body:request.postData()})}),{ip:'test'});
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base=process.env.KALOPS_BASE_URL||'http://127.0.0.1:5173';
  await page.goto(base);
  await page.locator('.product-card .add-button').first().click();
  await page.locator('.bag-button').click();
  await page.getByRole('button',{name:'Enviar pedido',exact:true}).click();
  await page.locator('input[name="name"]').fill('Cliente de teste');
  await page.locator('input[name="company"]').fill('Barbearia de teste');
  await page.locator('input[name="phone"]').fill('(11) 99999-8888');
  await page.locator('input[name="email"]').fill('teste@example.com');
  await page.locator('input[name="cep"]').fill('01001-000');
  await page.locator('select[name="state"]').selectOption('SP');
  await page.locator('input[name="city"]').fill('São Paulo');
  await page.locator('textarea[name="notes"]').fill('Primeira linha\nSegunda linha');
  await page.locator('input[name="consent"]').check();
  await page.screenshot({path:'/tmp/kalops-checkout-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Enviar solicitação de pedido',exact:true}).click();
  await page.getByText('SOLICITAÇÃO RECEBIDA',{exact:true}).waitFor();
  assert.equal(rows.size,1);const order=[...rows.values()][0];
  assert.equal(order.totalCents,19000);assert.equal(order.customer.name,'Cliente de teste');
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kalops-cart')),'{}');
  await page.goto(base+'/admin');
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form').getByRole('button',{name:/Entrar/}).click();
  await page.locator('.admin-order-card').first().waitFor();
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Admin overflow ${width}`);
    await page.screenshot({path:`/tmp/kalops-admin-${width}.png`,fullPage:true});
  }
  await page.locator('.admin-order-link').first().click();
  await page.getByRole('dialog').waitFor();
  const select=page.getByRole('dialog').locator('select');await select.selectOption('em_contato');
  await page.getByRole('dialog').getByRole('button',{name:/Salvar/}).click();
  await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Em contato'));
  assert.equal(rows.get(order.id).status,'em_contato');
  await page.screenshot({path:'/tmp/kalops-admin-detail.png',fullPage:true});
  await page.keyboard.press('Escape');
  await page.reload();await page.locator('.admin-order-link').first().waitFor();
  await page.getByRole('button',{name:'Sair do painel',exact:true}).click();
  await page.locator('input[type="password"]').waitFor();
  await page.reload();await page.locator('input[type="password"]').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: checkout → real handler → admin login/cookie → order detail → persisted status → reload; 360/390/768/1440px. Test storage only.');
}finally{await browser.close();}
