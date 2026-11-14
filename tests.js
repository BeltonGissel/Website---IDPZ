// Testes locais sem acesso ao Neon. Executar: npm run check
'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const server=fs.readFileSync('server.js','utf8');
let count=0;
for(const file of fs.readdirSync('.').filter(x=>x.endsWith('.js'))){
 cp.execFileSync(process.execPath,['--check',file],{stdio:'pipe'});count++;
}
const links=[...html.matchAll(/<(?:link|script)[^>]+(?:href|src)=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>!x.startsWith('data:')&&!x.startsWith('https:')&&!x.startsWith('http:')&&!x.startsWith('#'));
for(const link of links){
 const name=link.split(/[?#]/)[0];
 assert(fs.existsSync(name),`Recurso referenciado mas inexistente: ${name}`);
 assert(server.includes("'"+name+"'"),`Ficheiro não autorizado no servidor: ${name}`);
}
for(const asset of ['booking-whatsapp.css']){
 assert(server.includes("'"+asset+"'"),`Recurso não permitido: ${asset}`);
}
assert(server.includes('ipz_audit_log'),'Falta a tabela de auditoria');
assert(server.includes('ipz_bookings_request_id'),'Falta idempotência das reservas');
assert(html.includes('wa.me')||fs.readFileSync('script.js','utf8').includes('wa.me'),'Falta fluxo do WhatsApp');
console.log(`OK: ${count} ficheiros JS válidos, ${links.length} referências HTML verificadas, recursos públicos e verificações básicas da API.`);

assert(server.includes("/api/admin/reports/export"),'Falta exportação mensal');
assert(server.includes("allowedReportMonth"),'Falta limite de retenção de relatórios');
const client=fs.readFileSync('script.js','utf8');
assert(client.includes('admin-relatorios'),'Falta navegação Relatórios');
assert(client.includes('ipzCreatedThisMonth'),'Falta reinício visual mensal');

const path = require("node:path");
// Verificações de publicação: nenhuma demonstração deve ser criada nem aparecer na interface.
const publicationServer=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const publicationHTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
if(publicationServer.includes('seedDemoTournaments()'))throw Error('O servidor ainda inicializa torneios de demonstração');
if(/\[por preencher\]|PRODUTOS E PREÇOS DE EXEMPLO|\[Texto editável/.test(publicationHTML))throw Error('Existem textos provisórios no website');

// V34 — regressões de rotas e interface, sem modificar dados Neon.
const calendarClient=fs.readFileSync('admin-calendar.js','utf8');
const calendarCSS=fs.readFileSync('admin-calendar.css','utf8');
assert(html.includes('admin-calendar.js?v=34')&&html.includes('admin-calendar.css?v=34'),'O calendário não está ligado ao HTML');
assert(client.includes('admin-calendario')&&client.includes('window.IPZCalendar.render()'),'Falta navegação para Calendário');
for(const token of ['/api/admin/calendar','ipz_court_blocks','rescheduleBooking','createCourtBlock','deleteCourtBlock','blockConflicts']){
 assert(server.includes(token),'Falta funcionalidade no servidor: '+token);
}
for(const token of ['dayGrid','weekGrid','monthGrid','data-cal-reschedule','data-cal-status','wa.me/','data-cal-block']){
 assert(calendarClient.includes(token),'Falta funcionalidade no calendário: '+token);
}
assert(calendarCSS.includes('#CFF902'),'Cor institucional do calendário incorrecta');
console.log('OK: testes de estrutura da V34, rotas de calendário, bloqueios, reagendamento e WhatsApp.');

// V35 — Verifica que a gestão de painéis é autorizada no servidor e está ligada ao menu.
const permissionsClient=fs.readFileSync('admin-panels.js','utf8');
for(const token of ['ipz_access_panels','ipz_staff_users','hashPassword','verifyPassword','normalizePermissions','requireAccess','/api/admin/switch-panel','/api/admin/staff','/api/admin/panels']){
 assert(server.includes(token),'Falta segurança/funcionalidade de perfis: '+token);
}
for(const token of ['data-profile-toggle','data-panel-switch','admin-gerir-paineis','profileMenu','IPZ_PANELS']){
 assert(client.includes(token),'Falta menu do utilizador: '+token);
}
for(const token of ['ipz-profile-form','create-panel','create-user','data-delete-panel','data-delete-staff','permEditor','data-edit-toggle','data-select-profile','data-profile-tab']){
 assert(permissionsClient.includes(token),'Falta gestão de painéis/utilizadores: '+token);
}
assert(html.includes('admin-panels.js?v=36')&&html.includes('admin-panels.css?v=36'),'Os ficheiros V36 não estão ligados ao HTML');
assert(server.includes("requireAccess(s,c+'.edit')"),'As alterações de estado devem validar permissões no servidor');
assert(server.includes("requireAccess(s,sm[1]+'.view')"),'Os dados privados devem verificar permissões');
console.log('OK: V36 — grelha de avatares circulares, botões de rodapé, formulários de permissões e rotas protegidas.');
