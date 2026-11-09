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
