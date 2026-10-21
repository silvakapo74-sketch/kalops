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
- As cinco fotografias em `public/products/originals/` foram extraídas de `orion.zip`, enviado pelo proprietário, sem editar seus bytes. Fundos e proporções originais foram preservados. As extensões refletem os formatos reais (JPEG/WebP), apesar dos nomes .png no ZIP. `provenance.json` registra nomes originais, dimensões e hashes SHA-256.
- `src/product-images.js` registra cada arquivo com suas dimensões e procedência. O componente usa `object-fit: contain` no catálogo, páginas de produto e carrinho. A montagem antiga foi retirada e não deve ser reutilizada.
- A página oficial do Leave-in foi acessada com HTTP 200 nesta atualização. A estrutura da página e as instruções de uso serviram como referência: https://kalopscosmeticos.com.br/leave-in-kalops-vitamina-e-protecao-termica-e-solar-100ml/p. Os preços de atacado continuam os do catálogo fornecido.
- Canal confirmado no material: Instagram `@kalopscosmeticos`. Sem telefone inventado.
- Orçamento via resumo copiável; não há checkout de pagamento, estoque em tempo real, cadastro ou backend de pedidos.
- Fontes empacotadas localmente; não requer Google Fonts.

O layout e o fluxo de orçamento foram validados localmente. As cinco imagens tratadas com fundo branco foram integradas e verificadas no layout; preserve os arquivos originais do proprietário para futuras edições. Publicação e conexão ao domínio são etapas separadas.

## Pedidos e administração

A loja recebe solicitações em `/finalizar-pedido`; a equipe consulta em `/admin`.
O painel permite buscar, filtrar, consultar clientes e mudar o status das solicitações.
São orçamentos: não há cobrança online, confirmação automática de estoque ou cálculo automático de frete.

### Ativar no Netlify

1. Nas variáveis de ambiente do projeto, crie `KALOPS_ADMIN_PASSWORD` com uma senha exclusiva de pelo menos 16 caracteres (prefira uma senha gerada pelo gerenciador de senhas). Habilite o escopo **Functions** e o contexto **Production**; se sua conta não oferece seleção de escopos, use todos.
2. Faça um novo deploy para aplicar a variável nas funções.
3. Abra `/admin` e entre com essa senha. Não coloque a senha no código, em variável `VITE_*` ou em mensagens no chat.
4. Faça uma solicitação de teste pela loja, confirme a chegada ao painel e marque-a como cancelada após a validação.

As funções usam **Netlify Blobs** (`kalops-wholesale-orders`), com credenciais fornecidas automaticamente pela hospedagem. Não é necessário criar token de acesso pessoal nem banco separado. Deploys do código não apagam pedidos. O painel não funciona como backend em hospedagens somente estáticas ou no Vite isolado. Se a senha não estiver configurada, o recebimento direto permanece desabilitado e o cliente pode usar o resumo para atendimento pelo Instagram.

### Operação e segurança

- Sessão assinada válida por 8 horas, cookie `HttpOnly`, `Secure`, `SameSite=Strict`. Alterar a senha e republicar invalida sessões anteriores. A senha é compartilhada pela equipe autorizada; esta versão não tem contas individuais, níveis de permissão, recuperação por e-mail ou autenticação em dois fatores.
- Dados de cliente só são retornados pela API administrativa autenticada. A API pública devolve protocolo, itens e valores da própria solicitação.
- Valores são recalculados no servidor a partir do catálogo, com mínimo de 10 e máximo de 10.000 unidades por produto. O mesmo identificador e conteúdo não geram pedidos duplicados nas tentativas de reenvio.
- Rate limits nas funções e validação de origem/JSON protegem os endpoints. Falhas no armazenamento não são apresentadas como sucesso.
- Status: nova solicitação, em contato, confirmado, enviado, cancelado. Esses status são operacionais e não comprovam pagamento.
- Paginação de até 50 solicitações no painel; indicadores, pesquisa e lista de clientes consideram apenas os pedidos carregados, como indicado no painel. Use **Carregar mais solicitações** para ampliar a consulta.
- Pedidos são mantidos no armazenamento até remoção pela equipe. Para atender uma solicitação de exclusão, localize o protocolo e remova sua chave `orders/<id>` no armazenamento Blobs do Netlify. Exportação, exclusão pelo painel e políticas automáticas de retenção não estão implementadas.
- A política apresentada ao cliente está em `/privacidade`. O formulário pede apenas dados de contato e localização necessários ao orçamento, sem CPF/CNPJ obrigatório nem dados de cartão.

### Validação

- `node --test scripts/check-orders-api.mjs`: handlers reais com armazenamento isolado; autenticação, sessão, origem, validação, preços, idempotência, status e falhas.
- `node scripts/check-order-flow.mjs` com Vite em execução: navegador ligado aos handlers reais e armazenamento de teste; envio → login → consulta → alteração de status → recarga, sem criar pedidos na loja publicada.
- `node scripts/check.cjs` e `node scripts/check-product-layout.cjs`: regressão da loja e responsividade.
- `npm run build`: frontend, páginas diretas e configuração das funções para o deploy. O funcionamento do armazenamento e das regras da plataforma deve ser confirmado com o pedido de teste após ativar no Netlify.

## Interações da loja

`src/motion.css` e `src/storefront-motion.js` controlam respostas ao toque/hover, confirmação ao adicionar produtos, entrada de páginas e abertura/fechamento do carrinho e menu. Usam CSS/Web Animations nativos, sem biblioteca adicional. A saída do carrinho mantém apenas uma camada visual inerte por 220 ms; foco e navegação são liberados imediatamente. `prefers-reduced-motion` é respeitado, inclusive quando alterado com a página aberta. Fotografias mantêm as proporções, sem zoom ou recorte.

Com o Vite em execução, `node scripts/check-motion.cjs` verifica animações, fechamento/reabertura rápida, foco, navegação e redução de movimento em celular e desktop.
