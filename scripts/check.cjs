const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const {chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const baseURL = process.env.KALOPS_BASE_URL || 'http://127.0.0.1:5173';
const priceText = value => value.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2});

(async () => {
  const {products} = await import(pathToFileURL(path.resolve(__dirname, '../src/products.js')).href);
  assert.equal(products.length, 5, 'O catálogo precisa conter os cinco produtos da Kalops.');
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.hero-art').count(), 0, 'O bloco com três produtos foi removido.');
    await page.getByRole('button',{name:'Barba',exact:true}).click();
    assert.equal(await page.locator('.product-card').count(), 2, 'Filtro Barba');
    await page.getByRole('button',{name:'Todos os produtos'}).click();
    await page.getByRole('textbox',{name:'Buscar produtos'}).fill('stone');
    assert.equal(await page.locator('.product-card').count(), 1, 'Busca Stone Hold');
    await page.getByRole('textbox',{name:'Buscar produtos'}).fill('produto-inexistente');
    await page.getByText('Nenhum produto encontrado').waitFor();
    await page.getByRole('button',{name:'Ver todos os produtos',exact:true}).click();

    // Both photograph and title must navigate, with usable browser history.
    const first = products[0];
    const card = page.locator('.product-card').filter({has:page.getByRole('link',{name:first.name,exact:true})}).first();
    await card.locator('.product-visual').click();
    await page.waitForURL(url => url.pathname === first.path);
    await page.locator('.product-detail-page').waitFor();
    await page.getByRole('heading',{level:1,name:first.name,exact:true}).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0, 'O detalhe é uma página, sem modal.');
    await page.goBack();
    await page.locator('.product-card').first().waitFor();
    await page.locator('.product-card .product-title').first().click();
    await page.waitForURL(url => url.pathname === first.path);
    await page.reload();
    await page.getByRole('heading',{level:1,name:first.name,exact:true}).waitFor();

    const quantity = page.locator('.product-detail-page input[type="number"]').first();
    const add = page.locator('.product-detail-page').getByRole('button',{name:/Adicionar.*pedido/i}).first();
    await quantity.fill('9');
    const belowMinimum = Number(await quantity.inputValue());
    assert(belowMinimum >= 10 || !(await add.isEnabled()), 'Não permitir compra de menos de 10 unidades na PDP.');
    await quantity.fill('12');
    assert((await page.locator('.product-detail-page').innerText()).includes(priceText(first.price * 12)), 'Total da PDP acompanha a quantidade.');
    await add.click();
    await page.getByRole('button',{name:'Abrir pedido com 12 unidades',exact:true}).click();
    await page.getByRole('dialog',{name:'Meu pedido',exact:true}).waitFor();
    assert.equal(await page.getByRole('spinbutton',{name:'Quantidade de '+first.name,exact:true}).inputValue(), '12', 'Quantidade escolhida vai para o carrinho.');
    await page.getByRole('spinbutton',{name:'Quantidade de '+first.name,exact:true}).fill('9');
    assert(!(await page.getByRole('button',{name:'Copiar pedido para orçamento'}).isEnabled()), 'Pedido abaixo do mínimo não permite orçamento.');
    await page.getByRole('spinbutton',{name:'Quantidade de '+first.name,exact:true}).fill('10');
    assert(await page.getByRole('button',{name:'Copiar pedido para orçamento'}).isEnabled(), 'Pedido válido permite orçamento.');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button',{name:'Abrir pedido com 10 unidades',exact:true}).waitFor();

    for (const product of products) {
      assert(product.path.startsWith('/') && product.path.endsWith('/p'), 'Slug de produto precisa de caminho completo.');
      await page.goto(new URL(product.path,baseURL).href);
      await page.getByRole('heading',{level:1,name:product.name,exact:true}).waitFor();
      assert.equal(await page.locator('.product-detail-page').count(), 1, 'Deep link renderiza uma PDP.');
      await page.reload();
      await page.getByRole('heading',{level:1,name:product.name,exact:true}).waitFor();
      await page.getByRole('button',{name:'Abrir pedido com 10 unidades',exact:true}).waitFor();
    }
    await page.goto(new URL('/produto-que-nao-existe/p',baseURL).href);
    await page.getByRole('heading',{level:1,name:'Página não encontrada.',exact:true}).waitFor();
    assert.equal(await page.locator('.product-detail-page').count(), 0, 'Rota desconhecida não exibe produto incorreto.');
    await page.getByRole('link',{name:'Voltar aos produtos',exact:true}).click();
    await page.locator('#catalogo').waitFor();
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(), 5, 'Fallback preserva o catálogo.');
    assert.deepEqual(errors, [], 'Sem erros JavaScript durante navegação e compra.');
    console.log('PASS: filtros, busca/estado vazio, foto/título como links, navegação/back/reload, cinco deep links, mínimo/total/quantidade da PDP, carrinho persistente e fallback de rota desconhecida.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
