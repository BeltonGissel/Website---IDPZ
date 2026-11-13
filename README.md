# Indoor Padel Zone — V35: Gestão de painéis e acessos

## Funcionalidades

- O nome e email no canto superior direito passaram a ser um botão que abre **Trocar painel**, **Gerir painéis** (apenas Administrador principal) e **Terminar sessão**.
- O Administrador principal pode criar painéis de permissões, editar e apagar os personalizados, criar utilizadores, desactivá-los, alterar permissões ou eliminá-los.
- Cada utilizador pode receber vários painéis e alternar entre eles sem sair da sessão. A troca é confirmada na API e todas as permissões são verificadas no servidor.
- Painéis iniciais **Administração** e **Recepção** estão protegidos contra eliminação; a conta `admin@idpz.com` não pode ser apagada. As palavras-passe das contas base continuam nas variáveis `ADMIN_PASSWORD` e `RECEPTION_PASSWORD` do Render.
- Os novos colaboradores utilizam email próprio e palavra-passe de pelo menos 12 caracteres, armazenada com `scrypt` e salt único no Neon. A palavra-passe nunca é devolvida pela API.
- Há permissões separadas de **visualização** e **edição** nas áreas Compras, Reservas, Calendário, Produtos, Galeria, Torneios, Mensagens e Relatórios. O bloqueio dos campos tem permissão própria.
- Actualizar as permissões de um utilizador termina as suas sessões anteriores para evitar acessos indevidos.

## Migração segura

O `server.js` cria automaticamente `ipz_access_panels` e `ipz_staff_users`, acrescenta `active_panel` a `ipz_sessions` e não apaga dados das tabelas anteriores. As funcionalidades actuais continuam no mesmo Neon.

**ATENÇÃO:** faz um backup antes do deploy. Se o Neon estiver suspenso por limite de transferência, o servidor pode não conseguir iniciar ou aplicar as migrações até a ligação voltar a estar disponível.

## Actualização no GitHub

Substituir: `server.js`, `script.js`, `index.html`, `admin-ui.js`, `admin-calendar.js`, `community.js`, `tests.js`.

Adicionar: `admin-panels.js`, `admin-panels.css`, `README-V35.md`.

Os restantes ficheiros do ZIP mantêm-se na raiz e foram preservados.

Render: **Root Directory** vazio; **Build** `npm install && npm run check`; **Start** `npm start`.

## Verificações recomendadas após deploy

1. Entrar com o Administrador e abrir o menu de utilizador.
2. Criar painel *Gestão da Loja* com permissão para visualizar e alterar compras, mas sem acesso a Relatórios.
3. Criar um colaborador, atribuir-lhe apenas esse painel e testar o login.
4. Confirmar que apenas Compras aparece no menu e que a API rejeita pedidos de outras áreas.
5. Adicionar um segundo painel ao colaborador, entrar de novo e testar **Trocar painel**.
6. Eliminar o painel personalizado e confirmar que é retirado dos colaboradores sem apagar compras nem reservas.

## Limitações e cuidados

- Os testes incluídos são estáticos e de sintaxe: é obrigatório testar autenticação e permissões com o Neon e Render reais.
- Não partilhes a conta principal do Admin. Cria utilizadores individuais.
- Evita conceder permissão para exportar dados pessoais a contas que não precisem deles.
- Esta versão não altera preços, pagamentos nem os fluxos de WhatsApp.
