# Indoor Padel Zone — V32, publicação institucional

Esta versão conserva a organização original dos ficheiros na raiz.

## Alterações
- Retirado o aviso de conteúdo de exemplo no catálogo, substituído por texto da loja e WhatsApp.
- Contactos públicos limitados ao WhatsApp oficial disponibilizado e à localização genérica Maputo. Não foram inventados email, telefone fixo ou endereço de rua.
- FAQ reescrita com informação compatível com os fluxos do website.
- Removido o banner informativo do Admin, os seus estilos e o armazenamento local antigo de demonstração (o projecto exige Neon).
- Eliminada a inserção automática de campeonatos fictícios. Os campeonatos antigos existentes continuam guardados no Neon, mas não são exibidos na API pública nem no painel; para os apagar definitivamente, usar um procedimento administrativo separado com backup.
- Os dois ficheiros de fotografia fictícia foram retirados do pacote, mas os registos previamente gravados no Neon não foram apagados.
- Não foram inventados resultados de torneios, depoimentos, serviços ou fotografias oficiais. O Admin pode carregar fotografias autênticas nos produtos, galeria e torneios.

## GitHub
Substituir `index.html`, `script.js`, `server.js`, `community.js`, `styles.css`, `tests.js` e adicionar `README-V32.md`. Depois executar `npm run check` e publicar no Render.

## Antes de anunciar
- Confirmar dados de contacto e localização exacta com a empresa.
- Carregar imagens reais dos produtos no Admin e remover produtos fictícios do catálogo, caso existam.
- Confirmar datas/horários/preços de campo e conteúdos institucionais antes de divulgar.
- Executar compra via WhatsApp, reserva e autenticação Admin numa base real. Não foram feitos testes de integração com a instância Neon de produção.
