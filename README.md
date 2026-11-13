# Indoor Padel Zone V36 — Gestão de painéis com selecção circular

A interface Gerir painéis usa cartões com avatares circulares, inspirada numa página de selecção de perfis.

- Clique num perfil para consultar nome, módulos autorizados e colaboradores associados.
- **Adicionar Perfil**, no canto inferior esquerdo, abre a criação de perfil com permissões por módulo.
- **Editar perfil**, no canto inferior direito, activa os controlos de editar/apagar perfis e gerir colaboradores.
- Utilizadores continuam a ser criados separadamente em **Adicionar utilizador**, dentro do modo de edição.
- Os perfis de Administração e Recepção são protegidos contra eliminação.
- Todas as permissões continuam verificadas no `server.js` e armazenadas no Neon.
- O tema escuro é exclusivo do selector de perfis. O restante Admin permanece claro, com verde `#CFF902`.

## Actualizar no GitHub
Substituir: `admin-panels.js`, `admin-panels.css`, `index.html`, `tests.js`. Adicionar `README-V36.md` (opcional). Nenhuma alteração no `server.js` ou Neon.

Build: `npm install && npm run check`. Start: `npm start`.
