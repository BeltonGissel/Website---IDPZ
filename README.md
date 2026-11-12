# Indoor Padel Zone — V21 sem gateways de pagamento

## Nova operação

- Loja: o carrinho abre o WhatsApp **+258 87 738 8644** com artigos, quantidades, tamanhos e valor estimado. Não é enviada nem cobrada uma compra no servidor.
- Reserva: o cliente escolhe data, início/fim, campo, nome, apelido, B.I. e contacto. Na etapa 2 revê os dados e regista um **pedido pendente** no Neon. A seguir carrega em **Abrir WhatsApp e enviar pedido**; o WhatsApp é aberto com os detalhes da reserva e a referência. **O utilizador precisa de carregar em Enviar no WhatsApp**.
- **Atenção**: uma reserva pendente bloqueia o campo até a equipa confirmar ou cancelar o pedido no Admin. Recomenda-se rever pedidos não confirmados regularmente. Guardar o pedido no Neon não prova que a mensagem de WhatsApp tenha sido enviada.
- O pagamento e a confirmação de preço são combinados directamente com a equipa. O website não cobra nem verifica pagamentos.
- Os dados pessoais de B.I. ficam no servidor, não são enviados na mensagem predefinida de WhatsApp.
- Histórico de compras e pagamentos antigos no Neon é preservado. A aba Pagamentos deixa de ser apresentada, e as rotas de gateway/controlo de pagamento são removidas.
- `/api/submit/orders` responde 410; o servidor não recebe novas compras directas.

## Publicação

Na raiz do GitHub **Website---IDPZ**, substituir `script.js`, `server.js`, `community.js`, `README.md`, `.env.example` e adicionar `booking-whatsapp.css`, substituindo também `index.html`. Os restantes ficheiros são mantidos. O Render continua a usar `npm install` / `npm start`, Root Directory vazio e DATABASE_URL do Neon. Apagar do Render quaisquer variáveis `PAY_API_KEY`, `PAY_MERCHANT_ID` e `PAY_WALLET_ID` que tenham sido configuradas.

## Testes

1. Confirmar que a loja abre o WhatsApp com produtos correctos.
2. Confirmar que a reserva é registada no Neon como Pendente, mostra o botão WhatsApp e que a mensagem inclui a referência, sem B.I.
3. Testar horários sobrepostos, os quatro campos e a gestão dos estados no Admin.
4. Confirmar que não aparecem opções de cartão/e-Mola/M-Pesa no website e que não há rotas de cobrança activas.

**Sem integração oficial da WhatsApp Business Platform, o sistema não consegue garantir que a mensagem foi enviada nem recebida.**


## V24 — Registo de pedidos WhatsApp (sem pagamento)

- O carrinho recolhe nome e telefone do cliente e regista um **pré-pedido** na tabela existente `ipz_orders` do Neon, com estado `Por processar`.
- A mensagem do WhatsApp inclui a referência gerada pelo servidor, os produtos, as quantidades, tamanhos e subtotal estimado. Destino: **+258 87 738 8644**.
- Abrir o WhatsApp não confirma o envio da mensagem nem o pagamento. A equipa deve confirmar o pedido directamente com o cliente.
- O Admin/Recepcionista continua a filtrar e alterar os estados `Por processar`, `Em preparação`, `Pronto`, `Entregue`, `Cancelado`.
- **O stock não é reservado nem descontado na criação do pedido**; apenas quando o estado passa para `Entregue`. Ao sair de `Entregue`, o stock é reposto, de forma transaccional. Para pedidos antigos, mantém-se a lógica anterior.
- O dashboard mostra o valor das vendas WhatsApp com estado `Entregue`, sem o apresentar como pagamento comprovado.
- O registo utiliza um identificador idempotente para evitar pré-pedidos repetidos no duplo clique.
- A criação de um pré-pedido requer o Neon online; se falhar, o cliente recebe um erro e pode tentar novamente.
- Não há integração com gateways ou pagamento automático.

### Publicação no GitHub
Substituir `script.js`, `server.js`, `whatsapp-shop.css` e, opcionalmente, `README.md`. Manter o resto do projecto, o Render e o Neon. O servidor adiciona automaticamente o índice de prevenção de duplicados no arranque.
