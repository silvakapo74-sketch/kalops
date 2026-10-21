# Kalops · Atacado

Loja responsiva em React e Vite, com identidade oficial em preto, branco e off-white, catálogo de cinco produtos, busca e filtros, páginas individuais de produto, pedido persistente e resumo para orçamento pelo Instagram.

## Desenvolvimento

Node.js 24 e npm. No checkout existente:

```sh
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

```sh
npm run build
npm run preview
```

## Validação no ambiente Codex

Com o servidor ativo, `node scripts/check.cjs` verifica busca, filtros, cinco páginas de produto, navegação, links diretos, recarregamento, botão Voltar, mínimo de dez unidades, total e carrinho persistente. `node scripts/check-product-layout.cjs` valida a home e as cinco páginas em 360, 390, 768 e 1440 pixels, fotos inteiras e barras inferiores. Os scripts usam Playwright e Chromium fornecidos pelo ambiente. Para testar o build, inicie `npm run preview -- --port 4173` e use `KALOPS_BASE_URL=http://127.0.0.1:4173 node scripts/check.cjs`.

## Páginas e hospedagem

Os links das fotos e nomes abrem páginas próprias no formato `/{slug}/p`, declaradas em `src/products.js`. O botão de adicionar do catálogo continua disponível. O bloco de três produtos da home e os antigos detalhes em modal foram removidos.

`npm run build` gera o pacote em `dist/`, incluindo um `index.html` em cada caminho de produto. Isso permite acesso direto e recarregamento também em hospedagens estáticas. `public/_redirects` fornece fallback de rotas para Netlify; outros hosts devem direcionar caminhos desconhecidos para `index.html` se desejarem a página de erro do aplicativo. Publique o conteúdo de `dist/` na raiz do domínio.

## Publicação automática no Netlify

O arquivo `netlify.toml` fixa Node 24, o build `npm run build` e a saída `dist`. Conecte o projeto Netlify ao repositório `silvakapo74-sketch/kalops`, usando a branch de produção `main`. Depois da conexão inicial, cada push para `main` inicia um build e a publicação pelo Netlify. Editar arquivos somente neste ambiente não dispara deploy: as mudanças precisam ser commitadas e enviadas ao GitHub.

Para um site criado por upload manual, abra a configuração de build/deploy do projeto no Netlify e use a opção de vincular um repositório GitHub. Selecione este repositório e `main`; mantenha a pasta base vazia. O arquivo de configuração fornece o comando e a pasta de publicação. Selecione apenas o acesso necessário ao repositório quando o GitHub solicitar autorização.

Valide o primeiro deploy no painel do Netlify e abra uma página de produto diretamente, recarregando-a. O projeto não precisa de segredos para build ou hospedagem. A integração com a conta Netlify precisa ser feita pelo titular; não envie tokens em mensagens.

## Conteúdo e limites

- Preços, condições e descrições transcritos do catálogo fornecido. Sujeitos a confirmação comercial.
- Logotipos SVG oficiais fornecidos pelo proprietário. Paleta do manual: preto, branco e off-white `#f2ede7`.
- Cinco imagens individuais foram preparadas a partir das fotografias enviadas pelo proprietário no chat. Os anexos inline foram editados com imagegen para fundo branco; os arquivos em `public/products/individual/` são derivados editados, não cópias byte a byte nem downloads do site oficial. O tratamento foi comparado visualmente com os anexos; não garante identidade de cada pixel ou microtexto.
- `src/product-images.js` registra cada arquivo com suas dimensões e procedência. O componente usa `object-fit: contain` no catálogo, páginas de produto e carrinho. A montagem antiga foi retirada e não deve ser reutilizada.
- A página oficial do Leave-in foi acessada com HTTP 200 nesta atualização. A estrutura da página e as instruções de uso serviram como referência: https://kalopscosmeticos.com.br/leave-in-kalops-vitamina-e-protecao-termica-e-solar-100ml/p. Os preços de atacado continuam os do catálogo fornecido.
- Canal confirmado no material: Instagram `@kalopscosmeticos`. Sem telefone inventado.
- Orçamento via resumo copiável; não há checkout de pagamento, estoque em tempo real, cadastro ou backend de pedidos.
- Fontes empacotadas localmente; não requer Google Fonts.

O layout e o fluxo de orçamento foram validados localmente. As cinco imagens tratadas com fundo branco foram integradas e verificadas no layout; preserve os arquivos originais do proprietário para futuras edições. Publicação e conexão ao domínio são etapas separadas.
