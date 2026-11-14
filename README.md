# Indoor Padel Zone — V36 · Perfis circulares

## O que mudou

A página **Gerir painéis** foi redesenhada com referência à selecção de perfis do Chrome, mas com a identidade da Indoor Padel Zone: tema claro, avatares circulares, botões arredondados e verde-lima `#CFF902`.

- **Painéis / Colaboradores:** alternância entre perfis de permissões e contas individuais.
- **Perfis circulares:** cada painel e colaborador aparece com avatar circular, nome e legenda.
- **Selecção:** clicar num perfil mostra as permissões e colaboradores associados.
- **Adicionar Perfil:** botão inferior esquerdo; adiciona um painel ou colaborador, conforme o separador activo.
- **Editar Perfil:** botão inferior direito; activa/desactiva a edição dos perfis seleccionados.
- **Editar / Apagar:** apenas painéis personalizados podem ser eliminados; as contas protegidas são mantidas.
- **Permissões reais:** o servidor continua a validar acessos; não são apenas restrições visuais.

Não há alteração nas tabelas, endpoints, credenciais, fluxo de WhatsApp nem pagamentos. Os dados permanecem no Neon e os ficheiros mantêm-se na raiz do repositório.

## Alterações no GitHub

**Substituir:**
- `admin-panels.js`
- `admin-panels.css`
- `index.html`
- `tests.js`

**Adicionar opcionalmente:** `README-V36.md`.

Não substituir `server.js` ou outros ficheiros se já estiveres na V35 e não existirem diferenças na tua versão.

## Render

- Root Directory: vazio
- Build: `npm install && npm run check`
- Start: `npm start`

## Testes de aceitação

1. Entrar como Admin principal, abrir **Gerir painéis**.
2. Confirmar avatares circulares e alternância Painéis / Colaboradores.
3. Clicar em **Adicionar Perfil** e criar painel personalizado com permissões válidas.
4. Activar **Editar Perfil**, seleccionar o painel criado, alterar permissões e guardar.
5. Criar colaborador com palavra-passe de pelo menos 12 caracteres e atribuir um painel.
6. Verificar que um colaborador sem permissão não acede a áreas não autorizadas.
7. Apagar painel de teste e confirmar que a Administração principal não pode ser eliminada.

Validação executada localmente: `npm run check`. A criação de perfis real depende de sessão Admin e ligação operacional ao Neon.
