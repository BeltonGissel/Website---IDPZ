# Actualização V4: categorias oficiais da loja

A loja e o painel Admin utilizam as 10 categorias na ordem exacta da referência:

1. Raquetes
2. Sapatilhas
3. Roupa
4. Sacos
5. Packs
6. Bolas
7. Acessórios
8. Outlet
9. Pickleball
10. Outras raquetes

O painel permite escolher qualquer destas categorias ao adicionar produtos e alterar a categoria de um artigo existente na tabela Produtos. A loja apresenta todas as categorias, mesmo quando ainda estão vazias.

**Migração Neon:** no próximo arranque, o servidor converte automaticamente os índices antigos da base de dados (`Vestuário` → `Roupa`; `Mochilas e Sacos` → `Sacos`; `Bolas` → `Bolas`, etc.). A migração é executada apenas uma vez por produto e não altera imagens, preços, stock ou pedidos históricos. Produtos anteriores sem marcador `categoryVersion` são migrados; produtos novos recebem `categoryVersion: 2`.

**Ficheiros alterados:** `script.js`, `server.js`, `catalog.json`, `README.md`.

**Actualização GitHub:** substitui estes quatro ficheiros na raiz do repositório e faz commit. O Render deverá fazer redeploy. Mantém as variáveis de ambiente existentes e a ligação ao Neon. Faz backup da base de dados antes de fazer deploy, pois a classificação dos produtos é actualizada na base.

---

# Indoor Padel Zone — Admin v3

## Actualização
- **Excel completo de 45 dias**: botão no dashboard Admin e na área Compras. Download protegido em `/api/admin/export-45-days`, disponível só para Admin. O ficheiro XLSX inclui Resumo, Compras, Reservas, Mensagens, Produtos (estado actual) e Evolução diária. Filtro dos últimos 45 dias baseado na **data de criação** (UTC); o inventário é uma fotografia actual, não um histórico. O valor de encomendas é **simulado**, sem pagamentos reais.
- **4 imagens por produto**: ao criar um produto, o Admin selecciona exactamente quatro fotografias. Em Produtos → Editar 4 fotos pode substituir as quatro. A primeira é a capa, as quatro surgem na galeria. A Recepcionista não pode alterar produtos. As fotografias são optimizadas pelo navegador para WebP e guardadas no Neon no campo JSONB do produto; não são guardadas no disco efémero do Render. O website recebe URLs de imagem leves (`/api/product-image/...`) em vez de descarregar as fotografias em cada actualização de stock.
- **Limite:** cada fotografia optimizada ≤180 KB. Isto é adequado a um catálogo pequeno; para catálogo grande recomenda-se Cloudinary/R2/object storage. A utilização da base Neon aumenta com o número de produtos.

## Deploy
Enviar todos os ficheiros para a **raiz** do repositório GitHub, incluindo `admin-enhancements.css`, `package.json`, `server.js`, `script.js`, `index.html`, `animations.css`, `animations.js`, `redesign.css`, `styles.css` e SVGs. O Render deve usar Root Directory vazio, build `npm install`, start `npm start`, Node 20+. Manter `DATABASE_URL`, `NODE_ENV=production`, `COOKIE_SECURE=1`, `ADMIN_PASSWORD`, `RECEPTION_PASSWORD` (não enviar segredos ao GitHub). O comando `npm install` instalará `exceljs`.

## Validação recomendada
Criar produto com quatro imagens reais e confirmar que aparecem na loja e na página de produto, após reiniciar o Render. Exportar Excel como Admin e abrir as seis folhas no Excel/LibreOffice, confirmando que as encomendas não canceladas são apenas **valores simulados**. Confirmar que a Recepcionista recebe 403 em `/api/admin/export-45-days` e não tem acesso a criar ou editar produtos. Fazer backup da base Neon antes de utilizar com clientes.

# Indoor Padel Zone — website + gestão online (v2)

**Projecto único, dois acessos:** loja e reservas públicas em `/` e Admin/Recepcionista em `/admin.html`. O painel mantém o design original, a loja continua disponível e ambos usam a mesma base de dados PostgreSQL.

## Arquitectura gratuita recomendada

- **GitHub privado:** guarda o código-fonte.
- **Neon Free:** base de dados PostgreSQL externa. Não guardes dados comerciais em JSON local, porque o disco gratuito do Render é temporário.
- **Render Free Web Service:** executa o mesmo servidor Node.js para o website e o painel, e disponibiliza um endereço HTTPS público, por exemplo `https://indoor-padel-zone.onrender.com`.

Os serviços gratuitos têm **limites, suspensão por inactividade e ausência de garantia de disponibilidade**. Não são recomendados para gerir reservas críticas sem monitorização e backups. O Render pode demorar cerca de 1 minuto a acordar após 15 minutos sem visitantes. O Neon tem quotas e a computação pode escalar a zero. Consulta os termos actuais.

## 1. Criar a base de dados gratuita

1. Abre https://console.neon.tech/ e cria uma conta.
2. Cria um projecto Free PostgreSQL, por exemplo `indoor-padel-zone`.
3. Na área **Connection details**, copia a connection string PostgreSQL **pooled** com SSL (`postgresql://...`). Guarda-a em privado. NÃO a coloques no GitHub nem num ficheiro JavaScript do navegador.
4. Não precisas de executar SQL manualmente: no arranque, o `server.js` cria automaticamente as tabelas `ipz_products`, `ipz_orders`, `ipz_bookings`, `ipz_messages` e `ipz_sessions`, e insere o catálogo inicial sem apagar alterações existentes.

## 2. Publicar o código no GitHub

1. Extrai o ZIP deste projecto.
2. Cria um repositório **Private** em https://github.com/new.
3. Carrega os ficheiros deste projecto para a raiz do repositório, incluindo `server.js`, `render.yaml`, `package.json`, `catalog.json`, `index.html`, `admin.html`, `script.js`, `styles.css` e `.gitignore`.
4. Não carregues `.env`, bases de dados, dados privados ou a pasta `node_modules`.

## 3. Ligar ao Render Free

1. Acede a https://dashboard.render.com/ e liga a tua conta GitHub.
2. Escolhe **New > Web Service**, selecciona o repositório e o plano **Free**.
3. Runtime: **Node**. Build Command: `npm install`. Start Command: `npm start`. Health Check: `/health`.
4. Em **Environment**, configura:

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | Connection string pooled que copiaste no Neon |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `1` |
| `ADMIN_PASSWORD` | Nova palavra-passe longa e exclusiva, 12+ caracteres |
| `RECEPTION_PASSWORD` | Outra palavra-passe longa, 12+ caracteres |

**Emails fixos:** `admin@idpz.com` (Admin) e `geral@idpz.com` (Recepcionista). As palavras-passe antigas `admin001` e `Idpz001` **não funcionam** nesta versão online por razões de segurança. Define as novas nas variáveis de ambiente. Não publiques estas palavras-passe.

5. Clica em **Deploy Web Service**. O primeiro arranque instala a dependência `pg`, liga a PostgreSQL e cria as tabelas.
6. Abre o endereço HTTPS que o Render fornecer:
   - Website: `https://<teu-servico>.onrender.com/`
   - Painel: `https://<teu-servico>.onrender.com/admin.html`

**O utilizador final não precisa de Node.js nem de npm.** Basta abrir o link no telemóvel ou computador com internet. O VS Code e o terminal só são necessários para desenvolvimento.

## 4. Executar localmente

Instala Node.js 20 ou superior. Executa:

```bash
npm install
```

Cria o teu próprio `.env` a partir de `.env.example` e define `DATABASE_URL`, `ADMIN_PASSWORD` e `RECEPTION_PASSWORD`. O Node.js puro não carrega `.env` por si só. Num Mac com zsh podes iniciar assim (a partir de uma cópia local de `.env`):

```bash
set -a
source .env
set +a
npm start
```

Para testar: `http://localhost:3000/` e `http://localhost:3000/admin.html`.

## 5. Funcionalidades

- Loja com catálogo e stock partilhados. Preços e stock são verificados **no servidor**, não confiando nos valores enviados pelo cliente.
- Registos de compra transaccionais: duas compras simultâneas não podem vender o mesmo stock em excesso.
- Reserva de 4 campos, com bloqueio de slots já ocupados na base de dados, incluindo pedidos simultâneos.
- Visualização de horários ocupados durante a escolha do campo/hora.
- Painel para Admin e Recepcionista, com sessões HttpOnly persistidas na base e controlo de permissões no servidor.
- O Admin pode gerir produtos, preços e stock; a Recepcionista pode gerir compras e reservas, mas não alterar produtos.
- Compras, reservas e mensagens aparecem no painel; actualização por polling a cada 2,5 segundos.
- Registos sobrevivem ao reinício do servidor Render porque são gravados no Neon, não no disco local.
- Pagamentos são **simulados** e as compras são marcadas **«Pago (simulado)»** apenas após registo bem-sucedido. **Nenhum dinheiro é cobrado ou recebido.** Não introduzas dados reais de cartão ou carteiras móveis.

## 6. Testes antes de partilhar com clientes

1. Abre o website e o painel simultaneamente em dois dispositivos ou navegadores.
2. Faz uma reserva e confirma o registo no painel.
3. Tenta reservar o mesmo campo/data/hora de novo: deve aparecer erro.
4. Faz uma compra de teste e confirma o stock actualizado no painel e na loja.
5. Termina sessão e tenta abrir os dados do painel: devem ficar inacessíveis.
6. Entra como Recepcionista e confirma que não consegue modificar o catálogo.
7. Faz novo deploy e verifica que os registos continuam presentes no Neon.

## 7. Antes de um lançamento comercial real

- **O checkout não processa pagamentos reais.** Evita apresentar compras simuladas aos clientes como pagamentos efectuados. Integra uma entidade de pagamento e a confirmação por webhook antes de cobrar.
- Faz backups/exportações regulares da base de dados e estabelece uma política de privacidade e retenção de dados (nomes, emails e telefones).
- Adiciona serviço de email transaccional, avisos de reserva, confirmação de disponibilidade e suporte operacional.
- Adiciona proteção anti-spam/CAPTCHA e rate limiting partilhado para formulários públicos. O login tem controlo básico de tentativas em memória, não é distribuído.
- Para uma operação comercial que exige disponibilidade contínua, considera alojamento pago quando justificável. Gratuito não significa 24/7 garantido.

## Estrutura

```text
indoor-padel-zone-publico/
├── index.html          Website público
├── admin.html          Entrada do painel (redirecciona para #admin)
├── styles.css          Estilos existentes
├── script.js           Loja, reservas, interface e dashboard
├── server.js           API, login, validações e PostgreSQL
├── catalog.json        Produtos iniciais
├── package.json        Dependência pg e scripts
├── render.yaml         Modelo de configuração Render
├── .env.example        Modelo sem credenciais
├── .gitignore
└── README.md
```


## Redesign visual — 2026

- Nova home editorial inspirada na referência: Motion / Discipline / Result, secção de energia, cartões de experiência, destaque de campos e produtos.
- Novas páginas Sobre, Reservas, Loja e Contactos com cabeçalhos editoriais.
- Efeito Liquid Glass em navegação, call-to-actions e painéis visuais.
- Tema claro e escuro automático com `prefers-color-scheme`. Sem preferência manual gravada.
- O painel Admin / Recepcionista mantém o design e código existentes.
- A folha `redesign.css` é carregada depois de `styles.css`; mantém ambas.
- Texturas SVG `padel-balls.svg` e `court.svg` guardadas directamente na raiz do projecto. Algumas fotografias editoriais são obtidas através do Unsplash quando o dispositivo está online; as cores e SVGs funcionam como fallback. Substitui as imagens por fotografias próprias licenciadas antes do lançamento comercial.
- Os fluxos e rotas de compra, reservas e PostgreSQL permanecem os do projecto recebido.
- Para actualizar o Render, substitui os ficheiros do repositório na raiz e confirma que o Root Directory está vazio. Não publiques variáveis secretas.


## Organização dos ficheiros visuais (sem subpastas)

Todos os ficheiros fornecidos estão directamente na raiz do repositório, incluindo `padel-balls.svg` e `court.svg`. O ficheiro `redesign.css` utiliza `url('./padel-balls.svg')` e `url('./court.svg')`, com caminhos relativos a esse CSS. Não existe pasta `assets/`.

**Fotografias editoriais:** as quatro fotos da página inicial utilizam URLs HTTPS do Unsplash, porque não foram fornecidas como ficheiros locais na versão anterior. Necessitam de ligação à Internet e não estão incluídas no ZIP. Para torná-las independentes, descarrega fotografias com licença adequada, guarda-as na raiz e substitui cada URL externa no `redesign.css` pelo nome do ficheiro correspondente.

**GitHub / Render:** carrega o conteúdo desta pasta directamente na raiz do repositório `Website---IDPZ`. Mantém `Root Directory` vazio no Render. Confirma que `redesign.css`, `padel-balls.svg` e `court.svg` são enviados juntamente com o resto do projecto.

## Correcção do carregamento visual (Novembro de 2026)
O `server.js` autoriza explicitamente `redesign.css`, `court.svg` e `padel-balls.svg` como recursos públicos. Na versão anterior eram devolvidos com HTTP 404, impedindo o redesign de carregar. Depois de actualizar no GitHub, publicar no Render e actualizar a página com Cmd+Shift+R. Os restantes ficheiros da API e painel permanecem iguais. As fotografias de fundo usam URLs externas do Unsplash.


## Animações editoriais (v3)

Os ficheiros `animations.css` e `animations.js` estão na raiz. O `index.html` referencia ambos e o `server.js` autoriza a sua entrega. Não foram adicionadas dependências NPM.

- Scroll trigger: revelação de secções e cartões ao entrar no ecrã (IntersectionObserver).
- Scroll linked: barra de progresso e storytelling em três fases ligado ao scroll (requestAnimationFrame).
- Parallax: movimento suave dos fundos sem alterar o conteúdo essencial.
- Sticky: storytelling da homepage com mensagem que evolui durante a rolagem.
- Microinteracções: hover subtil de cartões e botões.
- Acessibilidade: respeita `prefers-reduced-motion`. Não interfere nos elementos do painel Admin/Recepcionista.

**Para publicar:** substitui os ficheiros na raiz do GitHub, inclui `animations.css` e `animations.js`, e aguarda o redeploy no Render. Mantém `Root Directory` vazio.


## Reservas v5 e números moçambicanos

- Processo de reserva: data (dd/mm), hora, nome e apelido, B.I., método de pagamento.
- Uma hora por reserva, com início possível de 06h00 a 22h00 e encerramento às 23h00, preço de demonstração de **1.700 MT**.
- O servidor atribui automaticamente o primeiro dos quatro campos disponível para o horário e impede a duplicação no PostgreSQL.
- Telefones: prefixo visual +258 e 9 dígitos nacionais. e-Mola só 86/87; M-Pesa só 84/85. Validação no navegador e no servidor em compras e reservas.
- Cartão é apenas uma opção simulada, sem recolha de dados bancários. Não há cobrança real.
- Dados de B.I. são pessoais: restringir acessos, retenção e exportações; considerar se é necessário recolhê-los antes da operação comercial real.
- Esta versão altera `script.js`, `server.js`, `index.html`, `admin-enhancements.css` e `README.md`. O Neon mantém as tabelas existentes.

## Galeria, torneios e cartão (v6, Novembro 2026)

### Galeria
- Página pública: `/#galeria`. Admin: `/admin.html` → **Galeria**.
- O administrador pode carregar e apagar imagens JPG, PNG, WebP. Os ficheiros são comprimidos no navegador e armazenados em `ipz_gallery` no Neon; **não são guardados em `assets/`** nem no disco temporário do Render.
- Máximo recomendado: cerca de 250 KB por foto após compressão. Fotos e legendas são públicas; evita dados privados.

### Torneios
- Página pública: `/#torneios`. Admin: `/admin.html` → **Torneios**.
- Admin cria torneios publicados, edita a lista nominal de participantes, sorteia, publica, conclui ou apaga.
- Visitante cria torneio com título, data, nome, email, contacto, capacidade e nomes dos participantes (um por linha, se disponíveis). O pedido fica `A aguardar aprovação` e o Admin decide publicá-lo.
- Ao criar, quando houver pelo menos 2 nomes, a primeira ronda é sorteada por embaralhamento criptograficamente aleatório (`crypto.randomInt`) e ninguém é sorteado duas vezes nessa ronda; em número ímpar, a última pessoa recebe folga. Os sorteios são persistidos em `ipz_tournaments`.
- Para nomes em falta, o Admin preenche a lista e faz o sorteio. **Não é um gerador automático de eliminatórias de todas as rondas**; a ronda seguinte deve ser gerida após apuramento dos vencedores.
- A lista pública mostra torneios `Publicado` e `Concluído`. Visitantes não podem publicar sem aprovação. Criação pública tem limite básico de pedidos por IP; para lançamento comercial considere CAPTCHA e auditoria.

### Gateway bancário por cartão — integração condicionada a credenciais comerciais
- O código prepara a integração com a API documentada de **pay.co.mz** para cartão Visa/Mastercard, usando `POST /charges` com checkout alojado no prestador. A IDPZ **não recolhe nem guarda dados do cartão**.
- Em Render → Environment, adiciona somente quando tiveres uma **conta comercial aprovada**:
  - `PAY_API_KEY` — segredo Bearer do comerciante
  - `PAY_MERCHANT_ID` — identificador atribuído pelo prestador
  - `PAY_WALLET_ID` — carteira receptora atribuída pelo prestador
- API e documentação pública: https://pay.co.mz/docs . Verifica as condições, o KYC, os preços e os callbacks com o prestador antes de activar.
- Sem essas três variáveis, os pedidos com cartão são **recusados** com mensagem de indisponibilidade; não são simulados nem marcados como pagos.
- Com credenciais válidas, o cliente é redireccionado para o checkout HTTPS do prestador. Encomenda/reserva começa com `Aguardando pagamento bancário`, não com `Pago`.
- Admin → **Pagamentos** permite consultar as últimas cobranças do prestador (`GET /charges?limit=100`) e compara referência, montante, método e estado antes de marcar `Pago (confirmado)`. Ausência de transacção exige conciliação manual. Não confies num simples redirect de retorno.
- Este fluxo NÃO foi testado com credenciais reais; não declarar cartão funcional em produção até validar uma cobrança autorizada, uma recusada, reembolso/expiração e reconciliação. A API pública consultada anuncia ausência de sandbox para alguns métodos.
- e-Mola e M-Pesa continuam **simulados**; não há cobrança real nesses métodos.
- Reserva feita por cartão pendente ainda ocupa um campo; é necessário definir uma política operacional para expirar/cancelar reservas não pagas, reconciliando primeiro o estado no prestador.

### Actualização no GitHub e Render
- Descompacta o ZIP e carrega **todos os ficheiros na raiz** de `Website---IDPZ` (Root Directory do Render continua vazio).
- Ficheiros existentes alterados: `index.html`, `script.js`, `server.js`, `README.md`.
- Novos ficheiros na raiz: `community.js`, `community.css`.
- Mantém `DATABASE_URL`, `ADMIN_PASSWORD`, `RECEPTION_PASSWORD`, `NODE_ENV=production`, `COOKIE_SECURE=1`. Não coloques segredos no repositório.
- Faz deploy; o servidor criará automaticamente `ipz_gallery` e `ipz_tournaments` no Neon, mantendo tabelas anteriores.
- Verifica `/health`, Galeria, Torneios, login Admin, quatro fotos de produtos, compra e reserva. O deploy não substitui os testes reais de pagamentos.

## V7 — Nova reserva com calendário (duas etapas)

- **Etapa 1:** data por calendário nativo (`type=date`, com indicação dd/mm/aaaa); ao lado, dois selectores para **Início** e **Fim** entre 06h00 e 23h00. Nome, apelido, B.I. e telefone; B.I. e telefone lado a lado em desktop.
- **Etapa 2:** cartão, e-Mola ou M-Pesa. e-Mola começa por 86/87 e M-Pesa por 84/85. O prefixo +258 é fixo e os nove dígitos ficam no formato `86 123 4567` à medida que escreves.
- **Cartão:** por segurança, número, validade e CVV são introduzidos somente no checkout HTTPS do prestador. O nosso formulário não recolhe nem armazena dados sensíveis de cartão. É necessário configurar credenciais reais e validar a integração com o prestador. Se o gateway não estiver configurado, o servidor rejeita pagamentos por cartão.
- **Duração/preço:** 1.700 MT/hora, calculados a partir da diferença entre início e fim. O servidor calcula o preço novamente e atribui automaticamente um dos quatro campos livres para todo o intervalo.
- **Compatibilidade:** reservas anteriores com duração de uma hora continuam a ser consideradas na consulta de disponibilidade. O bloqueio transaccional por dia evita novas reservas sobrepostas. A base Neon e o painel Admin mantêm-se.

### Ficheiros que mudaram na V7
`index.html`, `script.js`, `server.js`, `README.md`; ficheiro novo `booking-v7.css`. Todos ficam na **raiz** do GitHub. O `server.js` autoriza explicitamente servir `booking-v7.css`. Não alteres `DATABASE_URL` nem os dados do Neon.

### Testes recomendados
1. Selecciona 09:00 até 11:00 e confirma o valor **3.400 MT**.
2. Faz uma reserva de teste de 2 horas e confirma no painel Admin.
3. Tenta reservar novamente uma hora dentro desse intervalo com os quatro campos ocupados, deve indicar indisponibilidade.
4. Testa e-Mola `86 123 4567` e M-Pesa `84 123 4567`; prefixos trocados devem ser rejeitados.
5. Verifica o checkout de cartão apenas com credenciais oficiais de teste do gateway; nunca introduzas cartões reais durante testes.
