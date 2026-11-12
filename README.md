# Indoor Padel Zone V26 — estabilização (estrutura original preservada)

Este pacote mantém **todos os ficheiros na raiz** e os nomes utilizados na versão V25. Não altera a lógica de pagamentos: loja e reservas continuam a usar WhatsApp **+258 87 738 8644**, sem gateway.

## Alterações

- `server.js`: permite `booking-whatsapp.css` e imagens dos torneios, verifica PostgreSQL em `/health`, aplica cabeçalhos de segurança, limita tentativas de reservas/mensagens por instância, cria `ipz_audit_log`, permite consultar auditoria em `GET /api/admin/audit` (Admin), regista transições de estados, omite emails e telefones dos organizadores nas respostas públicas dos torneios e torna reservas idempotentes via `requestId`.
- `script.js`: envia `requestId` estável por formulário de reserva, impedindo duplicações quando a rede falha e o cliente tenta de novo.
- `package.json`: adiciona `npm run check` / `npm test`.
- `tests.js`: verifica sintaxe de todos os JS, caminhos de CSS/JS no HTML e autorização pelo servidor.
- Nenhuma tabela ou registo existente é apagado. Duas novas estruturas são criadas se não existirem: índice por `requestId` e tabela de auditoria.

## Publicação

1. Faz backup do repositório e da base Neon.
2. Na raiz do GitHub, substitui `server.js`, `script.js` e `package.json`; adiciona `tests.js` e `README-V26.md`. Mantém os restantes ficheiros do pacote.
3. No Render, mantém Root Directory vazio. **Build Command:** `npm install && npm run check`. **Start Command:** `npm start`.
4. Não alteres `DATABASE_URL`, `ADMIN_PASSWORD`, `RECEPTION_PASSWORD`, `NODE_ENV`, `COOKIE_SECURE`.
5. Após Live, visita `/health`; confirma `database: connected`. Testa reserva, loja WhatsApp e alterações de estado no Admin.

## Limites conhecidos / próximos passos

- `/api/admin/audit` é endpoint para consulta técnica; ainda não tem uma aba visual dedicada.
- Os limites anti-spam são por processo e não substituem rate limiting distribuído.
- Reservas pendentes **não expiram automaticamente**, porque cancelar pedidos de clientes sem uma política operacional pode ser arriscado. Recomenda-se acordar um prazo de confirmação com a equipa antes de implementar expiração.
- O WhatsApp não confirma o envio da mensagem ao servidor. Pedidos registados não significam vendas pagas.
- Imagens continuam guardadas no Neon; migração para armazenamento de objectos é uma etapa futura, pois requer configuração de fornecedor.
- Login continua dependente dos emails administrativos existentes; 2FA e contas adicionais exigem implementação separada.
- O teste de integração Neon/Render deve ser feito após publicação.
