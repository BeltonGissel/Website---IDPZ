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
