# Indoor Padel Zone V28 — Fecho mensal e relatórios Excel

## Funcionamento

- **Painel:** às 00h00 do dia 1, hora de Moçambique, os indicadores de compras, reservas e mensagens passam a mostrar apenas os registos do mês que começa. Nunca apagamos as tabelas Neon, reservas futuras, stock ou histórico por causa de um fecho mensal.
- **Compras e Reservas:** as listas operacionais continuam disponíveis (incluindo pedidos antigos que precisem de intervenção); os indicadores do dashboard referem-se ao mês corrente.
- **Relatórios:** menu `Relatórios` imediatamente depois de `Mensagens` para a conta Admin. Permite exportar o mês actual e os **três meses anteriores**. Cada ficheiro tem folhas de Resumo, Compras, Reservas, Mensagens, Produtos, Torneios, Galeria e Evolução diária.
- **Retenção de três meses:** o endpoint rejeita meses fora da janela permitida (HTTP 410). Os ficheiros são criados *sob pedido* em memória e enviados ao browser, nunca guardados no Render, por isso não existe ficheiro no servidor para apagar. Os dados originais no Neon não são eliminados. Os Excel já descarregados para outro dispositivo não podem ser eliminados remotamente.
- **Fuso horário:** Africa/Maputo (UTC+02:00), inclusive na selecção do mês.
- **Segurança:** API de relatórios requer sessão de Admin e valida mês e permissões no servidor.

## Publicação
1. Substitui `server.js`, `script.js`, `index.html` e `tests.js`, adiciona `monthly-reports.css` e este README na raiz do repositório.
2. No Render usa build `npm install && npm run check` e start `npm start`.
3. Testa `#admin-relatorios` com a conta Admin. Testa um mês válido e tenta aceder a um mês com mais de três meses, que deverá ser rejeitado.
4. Não necessitas de alterar as variáveis do Neon nem apagar dados.

## Notas de auditoria
O Excel reproduz o estado actual dos registos pertencentes ao mês escolhido; se o estado de uma compra antiga for modificado posteriormente, uma exportação nova reflecte o estado actualizado. Para fecho financeiro irrevogável, adicionar posteriormente snapshots mensais imutáveis.
