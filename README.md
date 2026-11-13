# Indoor Padel Zone — V33 · Cores unificadas no Admin

## Alterações
- Cor institucional exclusiva para acções e destaques: `#CFF902` (mesma de Terminar sessão).
- Cartões verdes de Painel convertidos para verde-lima com texto escuro e contraste apropriado.
- Filtros e estados activos uniformizados em Compras e Reservas.
- Botões primários, selecção de navegação, indicadores gráficos e relatórios harmonizados.
- Gráfico do dashboard usa lima para Entregue, cinzentos para outros estados, sem azuis ou verdes diferentes.
- Mantidas cores vermelhas para estados destrutivos, por significado de segurança.
- Nova versão nos URLs de CSS/JS para evitar cache antigo.
- Sem mudanças na API, base de dados ou lógica das reservas/loja.

## Actualizar no GitHub (raiz do repositório)
Substituir `admin-ui.css`, `admin-status.css`, `script.js`, `index.html`. Adicionar `README-V33.md` (opcional). O ZIP contém a totalidade dos ficheiros.

## Validação
Executar `npm run check` antes do deploy. Verificar o Admin visualmente após o Render estar Live.
