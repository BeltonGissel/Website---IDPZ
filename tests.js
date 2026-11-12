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
for(const asset of ['booking-whatsapp.css','campeonato-exemplo-1.webp','campeonato-exemplo-2.webp']){
 assert(server.includes("'"+asset+"'"),`Recurso não permitido: ${asset}`);
}
assert(server.includes('ipz_audit_log'),'Falta a tabela de auditoria');
assert(server.includes('ipz_bookings_request_id'),'Falta idempotência das reservas');
assert(html.includes('wa.me')||fs.readFileSync('script.js','utf8').includes('wa.me'),'Falta fluxo do WhatsApp');
console.log(`OK: ${count} ficheiros JS válidos, ${links.length} referências HTML verificadas, recursos públicos e verificações básicas da API.`);
