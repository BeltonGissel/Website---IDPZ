# Indoor Padel Zone V37 — Acessos individuais por painel

## Alterações
- **Adicionar painel** requer nome do painel, nome de utilizador, email, palavra-passe e permissões. A palavra-passe tem **mínimo 8 caracteres**, **uma letra maiúscula** e **um número**.
- O painel e a conta de colaborador são criados **numa transacção PostgreSQL**, evitando registos incompletos.
- O menu superior passa a mostrar apenas a **inicial do nome de utilizador**. O menu contém **Gerir painéis** (apenas Administrador principal) e **Terminar sessão**. Foi retirada a opção Trocar painel.
- As novas contas usam hash **scrypt** e a autorização é verificada no servidor.
- A gestão de colaboradores também aplica as mesmas regras de complexidade quando uma palavra-passe é criada ou alterada.

## GitHub: substituir
`server.js`, `script.js`, `admin-panels.js`, `admin-panels.css`, `index.html`, `tests.js`.

## GitHub: adicionar
`README-V37.md` (opcional).

Todos os ficheiros continuam na raiz, tal como na V36. Neon e Render mantêm as variáveis existentes. Não há migração destrutiva.

## Testar após deploy
1. Iniciar sessão como Admin.
2. Abrir Gerir painéis → Adicionar Perfil.
3. Criar painel com nome, utilizador, email e senha válida (ex.: `Padel2026`).
4. Terminar sessão e entrar com as novas credenciais. Confirmar visibilidade das secções permitidas.
5. Tentar palavra-passe sem maiúscula ou número: o servidor deve rejeitar.
6. Confirmar que no canto superior direito aparece apenas a inicial e que não existe Trocar painel.

**Nota:** A nova conta recebe o painel criado. Se precisares que o mesmo utilizador tenha vários painéis, o Admin pode editar as atribuições na aba Colaboradores. O selector foi removido do menu, portanto será necessário iniciar uma sessão associada ao primeiro painel atribuído ou desenvolver posteriormente um mecanismo autorizado para seleccionar outro painel.
