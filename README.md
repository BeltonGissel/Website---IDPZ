# Indoor Padel Zone — V34 · Calendário operacional

## O que foi implementado

- **Admin → Calendário** (também disponível para Recepcionista) com vista diária, semanal e mensal.
- **Dia:** quatro campos em paralelo, grelha das 06h00 às 23h00, reservas e bloqueios por horário.
- **Semana:** sete dias com contagem de reservas e bloqueios por campo; clicar num dia abre o detalhe diário.
- **Mês:** calendário mensal, número de reservas e bloqueios por data; clicar num dia abre o detalhe.
- **Gestão de reservas:** abrir uma reserva, marcar Pendente/Confirmada/Cancelada, guardar alteração, reagendar data/campo/hora e contactar o cliente pelo WhatsApp.
- **Bloqueios de campos:** Admin pode criar e remover bloqueios com motivo, data, campo e intervalo de horas. Recepcionista pode consultar bloqueios, mas não criá-los/removê-los.
- **Neon:** tabela `ipz_court_blocks` criada automaticamente no arranque; nenhuma tabela existente é apagada. Reagendamentos e bloqueios geram auditoria em `ipz_audit_log`.
- **Disponibilidade pública:** o website deixa de oferecer intervalos bloqueados. O servidor valida novamente ao gravar reservas e reagendamentos, para impedir conflitos.
- **Cor:** #CFF902, com fundo claro no Admin, mantendo a apresentação pública anterior.

## Ficheiros alterados

| Ficheiro | Acção |
| --- | --- |
| `server.js` | Substituir (nova tabela, rotas, validação de conflitos) |
| `script.js` | Substituir (menu Calendário e renderização) |
| `index.html` | Substituir (referências de CSS e JS) |
| `admin-ui.js` | Substituir (ícone Calendário) |
| `tests.js` | Substituir (testes de regressão) |
| `admin-calendar.js` | **Novo** |
| `admin-calendar.css` | **Novo** |
| `README-V34.md` | **Novo**, documentação |

Todos ficam **na raiz** de `Website---IDPZ`, sem subpastas. Outros ficheiros da V33 ficam preservados.

## Configurar no GitHub + Render

1. Faz backup do código actual e, se possível, um backup/snapshot da base Neon.
2. Carrega os ficheiros alterados directamente na raiz da branch `main` do GitHub.
3. Render: Root Directory **vazio**, Build Command `npm install && npm run check`, Start Command `npm start`.
4. Confirma que o deploy está `Live`; abre o painel e selecciona **Calendário**.
5. Testa em ambiente controlado: cria um bloqueio, verifica no website que a disponibilidade desaparece, remove o bloqueio e confirma que regressa; reagenda uma reserva e confirma o novo horário.

## Segurança e limites

- Sessão obrigatória para consultar a agenda. Apenas Admin pode bloquear/desbloquear horários.
- Dados pessoais não são expostos pela API pública de disponibilidade; os contactos estão apenas na API autenticada.
- Mensagens WhatsApp são abertas como rascunho e exigem que o operador carregue em **Enviar**.
- Horários são inteiros, sem fracções, entre 06h00 e 23h00, de acordo com a marcação actual.
- Os bloqueios não podem sobrepor reservas activas. Reagendamentos não podem sobrepor reservas nem bloqueios existentes.
- O ecrã de calendário não altera preços nem registos de compra.

## Verificações

Executar `npm run check` antes de publicar. O teste verifica JavaScript, referências dos recursos e rotas críticas. É necessário fazer os testes com a base Neon real e com contas Admin/Recepcionista no Render depois do deploy.
