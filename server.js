'use strict';
// Indoor Padel Zone: servidor público com PostgreSQL persistente (Neon/Supabase).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Pool} = require('pg');
const ExcelJS = require('exceljs');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL não configurada. Consulta README.md.'); process.exit(1); }
const passwords = {
  'admin@idpz.com': { role:'admin', password:process.env.ADMIN_PASSWORD },
  'geral@idpz.com': { role:'recepcionista', password:process.env.RECEPTION_PASSWORD }
};
if (Object.values(passwords).some(a => !a.password || a.password.length < 12)) {
  console.error('Define ADMIN_PASSWORD e RECEPTION_PASSWORD com pelo menos 12 caracteres (não uses as credenciais antigas).'); process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 12000,
  idleTimeoutMillis: 30000, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: true } });
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
const courts=['Campo 1','Campo 2','Campo 3','Campo 4'];
const times=Array.from({length:17},(_,i)=>String(i+6).padStart(2,'0')+':00');
const bookingPrice=1700;
const normalizePhone=v=>'+258'+String(v||'').replace(/\D/g,'').replace(/^258/,'');
const phoneValid=(v,method)=>{const n=normalizePhone(v);return method==='emola'?/^\+2588[67]\d{7}$/.test(n):method==='mpesa'?/^\+2588[45]\d{7}$/.test(n):/^\+2588\d{8}$/.test(n);};
const ordersStatuses=['Por processar','Em preparação','Pronto','Entregue','Cancelado'];
const bookingStatuses=['Pendente','Confirmada','Cancelada'];
const attempts=new Map();
const communityWrites=new Map();
function limitCommunity(req){
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 const current=communityWrites.get(ip);const now=Date.now();
 const entry=current&&now-current.start<600000?current:{start:now,count:0};
 entry.count++;communityWrites.set(ip,entry);
 if(communityWrites.size>10000)communityWrites.clear();
 if(entry.count>5)bad('Demasiados pedidos. Tenta novamente mais tarde.',429);
}
const esc=v=>String(v??'').trim();
const cut=(v,n=160)=>esc(v).slice(0,n);
const ref=p=>p+'-'+crypto.randomBytes(6).toString('hex').toUpperCase();
const safeCompare=(a,b)=>{
  const ah=crypto.createHash('sha256').update(String(a)).digest(), bh=crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah,bh);
};
function json(res,code,data,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',...headers});res.end(JSON.stringify(data));}
function error(res,code,message){json(res,code,{error:message});}
function setCookie(token,clear=false){return `ipz_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:28800}${PROD||process.env.COOKIE_SECURE==='1'?'; Secure':''}`;}
function cookies(req){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ipz_session='))?.slice(12)||'';}
function sameOrigin(req){const o=req.headers.origin;if(!o)return true;try{return new URL(o).host===req.headers.host}catch{return false;}}
function parse(req,maxBytes=80000){return new Promise((resolve,reject)=>{let data='',ended=false;req.on('data',b=>{data+=b;if(Buffer.byteLength(data,'utf8')>maxBytes&&!ended){ended=true;reject(Object.assign(new Error('Corpo demasiado grande'),{status:413}));req.destroy();}});req.on('end',()=>{if(ended)return;try{resolve(JSON.parse(data||'{}'))}catch{reject(Object.assign(new Error('JSON inválido'),{status:400}))}});req.on('error',reject);});}
async function session(req){const raw=cookies(req);if(!/^[a-f0-9]{64}$/.test(raw))return null;
 const key=crypto.createHash('sha256').update(raw).digest('hex');
 const q=await pool.query('SELECT role,email FROM ipz_sessions WHERE token_hash=$1 AND expires_at>now()',[key]);return q.rows[0]||null;}
async function boot(){
 await pool.query(`CREATE TABLE IF NOT EXISTS ipz_products (id TEXT PRIMARY KEY, data JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS ipz_orders (ref TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_bookings (ref TEXT PRIMARY KEY, court TEXT NOT NULL, booking_date DATE NOT NULL, booking_time TEXT NOT NULL, status TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX IF NOT EXISTS ipz_booking_slot_active ON ipz_bookings(court,booking_date,booking_time) WHERE status <> 'Cancelada';
 CREATE TABLE IF NOT EXISTS ipz_messages (ref TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
 CREATE TABLE IF NOT EXISTS ipz_gallery (id TEXT PRIMARY KEY, caption TEXT NOT NULL, image TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_tournaments (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_tournament_photos (id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES ipz_tournaments(id) ON DELETE CASCADE, caption TEXT NOT NULL, image TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_seed_runs (key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_audit_log (id BIGSERIAL PRIMARY KEY, happened_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_email TEXT NOT NULL, actor_role TEXT NOT NULL, entity_type TEXT NOT NULL, entity_ref TEXT NOT NULL, previous_status TEXT, new_status TEXT);
 CREATE INDEX IF NOT EXISTS ipz_audit_log_happened_at ON ipz_audit_log(happened_at DESC);`);
 await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ipz_orders_request_id ON ipz_orders ((data->>'requestId')) WHERE data ? 'requestId'");
 await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ipz_bookings_request_id ON ipz_bookings ((data->>'requestId')) WHERE data ? 'requestId'");
 // Migração idempotente de categorias antigas (0-5) para o catálogo v2 (0-9).
 // Só converte artigos sem categoryVersion; preserva preços, imagens, stock e vendas.
 await pool.query(`UPDATE ipz_products
 SET data = jsonb_set(
   jsonb_set(data, '{c}', to_jsonb(CASE (data->>'c')::integer
     WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 6
     ELSE 6 END)),
   '{categoryVersion}', '2'::jsonb)
 WHERE NOT (data ? 'categoryVersion')
   AND (data->>'c') ~ '^[0-5]$'`);
 for(const p of catalog)await pool.query('INSERT INTO ipz_products(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING',[p.id,JSON.stringify({...p,pub:true})]);
 await seedDemoTournaments();
}

// Dados fictícios para demonstração. A marca de seed impede recriação após
// o administrador eliminar os exemplos. Não modifica torneios existentes.
const demoTournaments = [{"id": "TOR-DEMO-OPEN-2026", "title": "Indoor Padel Open — Exemplo", "date": "2026-09-19", "capacity": 8, "participants": ["Jogador Exemplo A", "Jogador Exemplo B", "Jogador Exemplo C", "Jogador Exemplo D", "Jogador Exemplo E", "Jogador Exemplo F", "Jogador Exemplo G", "Jogador Exemplo H"], "ranking": [{"position": 1, "name": "Jogador Exemplo A", "wins": 4, "points": 120}, {"position": 2, "name": "Jogador Exemplo B", "wins": 3, "points": 105}, {"position": 3, "name": "Jogador Exemplo C", "wins": 2, "points": 90}, {"position": 4, "name": "Jogador Exemplo D", "wins": 1, "points": 75}, {"position": 5, "name": "Jogador Exemplo E", "wins": 0, "points": 60}, {"position": 6, "name": "Jogador Exemplo F", "wins": 0, "points": 45}, {"position": 7, "name": "Jogador Exemplo G", "wins": 0, "points": 30}, {"position": 8, "name": "Jogador Exemplo H", "wins": 0, "points": 15}], "status": "Concluído", "demo": true, "name": "Organização (exemplo)", "organizer": "Organização (exemplo)", "email": "exemplo@invalid.test", "phone": "000000000", "draw": [], "createdAt": "2026-09-19T12:00:00.000Z"}, {"id": "TOR-DEMO-TACA-2026", "title": "Taça Indoor de Outubro — Exemplo", "date": "2026-10-17", "capacity": 8, "participants": ["Atleta Exemplo A", "Atleta Exemplo B", "Atleta Exemplo C", "Atleta Exemplo D", "Atleta Exemplo E", "Atleta Exemplo F", "Atleta Exemplo G", "Atleta Exemplo H"], "ranking": [{"position": 1, "name": "Atleta Exemplo A", "wins": 5, "points": 110}, {"position": 2, "name": "Atleta Exemplo B", "wins": 4, "points": 98}, {"position": 3, "name": "Atleta Exemplo C", "wins": 3, "points": 86}, {"position": 4, "name": "Atleta Exemplo D", "wins": 2, "points": 74}, {"position": 5, "name": "Atleta Exemplo E", "wins": 1, "points": 62}, {"position": 6, "name": "Atleta Exemplo F", "wins": 0, "points": 50}, {"position": 7, "name": "Atleta Exemplo G", "wins": 0, "points": 38}, {"position": 8, "name": "Atleta Exemplo H", "wins": 0, "points": 26}], "status": "Concluído", "demo": true, "name": "Organização (exemplo)", "organizer": "Organização (exemplo)", "email": "exemplo@invalid.test", "phone": "000000000", "draw": [], "createdAt": "2026-10-17T12:00:00.000Z"}];
async function seedDemoTournaments(){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const marker=await client.query("INSERT INTO ipz_seed_runs(key) VALUES('demo-tournaments-v13') ON CONFLICT DO NOTHING RETURNING key");
  if(marker.rowCount){
   for(let i=0;i<demoTournaments.length;i++){
    const t=demoTournaments[i];
    const inserted=await client.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING id',[t.id,JSON.stringify(t)]);
    if(inserted.rowCount){
     const file=path.join(ROOT,`campeonato-exemplo-${i+1}.webp`);
     const uri='data:image/webp;base64,'+fs.readFileSync(file).toString('base64');
     await client.query('INSERT INTO ipz_tournament_photos(id,tournament_id,caption,image) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[
      `TFOTO-DEMO-${i+1}`,t.id,i===0?'Ilustração do Indoor Padel Open (fictícia)':'Ilustração da Taça Indoor de Outubro (fictícia)',uri
     ]);
    }
   }
  }
  await client.query('COMMIT');
 }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}

function publicProduct(item){
 const images=Array.isArray(item.images)?item.images:[];
 return {...item,images:images.map((data,i)=>'/api/product-image/'+encodeURIComponent(item.id)+'/'+i+'?v='+crypto.createHash('sha256').update(data).digest('hex').slice(0,12))};
}
const recordTables={orders:'ipz_orders',bookings:'ipz_bookings',messages:'ipz_messages',products:'ipz_products'};
async function snapshot(c){const q=await pool.query(`SELECT ${c==='products'?'id':'ref'} AS id, data FROM ${recordTables[c]} ORDER BY ${c==='products'?'id':'created_at DESC'} LIMIT 2000`);
 if(c==='products')return q.rows.map(x=>({id:x.id,data:publicProduct(x.data)}));
 return [{id:'local',data:{list:q.rows.map(x=>x.data)}}];}
async function getDoc(c,id){if(c==='products'){let r=await pool.query('SELECT data FROM ipz_products WHERE id=$1',[id]);return r.rows[0]?publicProduct(r.rows[0].data):null;}
 if(id!=='local')return null;
 const docs=await snapshot(c);return docs[0].data;}
async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
function bad(m,status=400){const e=new Error(m);e.status=status;throw e;}
// Registo de intenção comercial por WhatsApp. Não é cobrança nem venda confirmada.
const orderSubmitAttempts=new Map();
// Limite básico por instância (não distribuído entre instâncias). Utilizar Redis ou gateway externo em produção de grande escala.
const publicWrites=new Map();
function publicRateLimit(req,route,max=12){
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 const key=ip+'|'+route,now=Date.now();
 const history=(publicWrites.get(key)||[]).filter(t=>now-t<60000);
 if(history.length>=max)bad('Demasiados pedidos. Tenta novamente dentro de um minuto.',429);
 history.push(now);publicWrites.set(key,history);
 if(publicWrites.size>5000){for(const [k,v] of publicWrites)if(v[v.length-1]<now-60000)publicWrites.delete(k);}
}

async function submitWhatsAppOrder(b,req){
 const input=Array.isArray(b.items)?b.items:[];
 if(!input.length||input.length>30)bad('Carrinho inválido');
 const requestId=cut(b.requestId,80);
 if(!/^[a-f0-9-]{36}$/i.test(requestId))bad('Identificador do pedido inválido');
 const key=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
 const now=Date.now(),rate=orderSubmitAttempts.get(key)||[];
 const attempts=rate.filter(t=>now-t<60000);
 if(attempts.length>=8)bad('Demasiados pedidos. Tenta novamente dentro de um minuto.',429);
 attempts.push(now);orderSubmitAttempts.set(key,attempts);
 const entries=new Map();
 for(const item of input){
  const id=cut(item.id,60),sz=cut(item.sz,16),q=Number(item.q);
  if(!/^[a-zA-Z0-9_-]{2,60}$/.test(id)||!Number.isInteger(q)||q<1||q>100)bad('Produto ou quantidade inválidos');
  const k=id+'|'+sz,old=entries.get(k);entries.set(k,{id,sz,q:q+(old?.q||0)});
 }
 if([...entries.values()].reduce((n,x)=>n+x.q,0)>100)bad('Quantidade total excessiva');
 const name=cut(b.cn,120)||'Cliente não identificado',phone=cut(b.cp,24);
 if(phone&&!phoneValid(phone))bad('Número de telefone inválido');
 return tx(async db=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-order-'+requestId]);
  const old=await db.query("SELECT data FROM ipz_orders WHERE data->>'requestId'=$1 LIMIT 1",[requestId]);
  if(old.rows.length)return old.rows[0].data;
  const normalized=[];
  for(const it of entries.values()){
   const result=await db.query('SELECT data FROM ipz_products WHERE id=$1',[it.id]);
   if(!result.rows.length||result.rows[0].data.pub===false)bad('Produto indisponível: '+it.id,409);
   const product=result.rows[0].data;
   if(it.q>Number(product.s||0))bad('Stock insuficiente para '+product.n,409);
   if(!Number.isFinite(product.p)||product.p<0)bad('Preço inválido',400);
   normalized.push({id:it.id,n:product.n,sz:it.sz,q:it.q,u:product.p,t:product.p*it.q});
  }
  const total=normalized.reduce((n,x)=>n+x.t,0);
  const order={ref:ref('PED'),requestId,at:new Date().toISOString(),cn:name,cp:phone?normalizePhone(phone):'',ce:'',co:'',pm:'whatsapp',pay:'A combinar via WhatsApp',payAuto:false,dl:'pick',a:'',total,st:'Por processar',ap:false,inventoryCommitted:false,channel:'whatsapp',waStatus:'Link gerado; envio não verificável',items:normalized};
  await db.query('INSERT INTO ipz_orders(ref,data) VALUES($1,$2::jsonb)',[order.ref,JSON.stringify(order)]);
  return order;
 });
}

function hoursValue(time){return Number(String(time||'').slice(0,2));}
function bookingInterval(record){const start=hoursValue(record.time);const duration=Number(record.duration)||60;const end=record.endTime?hoursValue(record.endTime):start+Math.ceil(duration/60);return {start,end};}
function bookingOverlaps(other,start,end){const r=bookingInterval(other);return start<r.end&&end>r.start;}
async function submitBooking(b){
 const requestId=cut(b.requestId,80);
 if(!/^[a-f0-9-]{36}$/i.test(requestId))bad('Identificador de reserva inválido');
 const court=cut(b.court,30),date=cut(b.date,10),time=cut(b.time,5),endTime=cut(b.endTime,5),bi=cut(b.bi,30),name=cut(b.cn,160),phone=cut(b.cp,24);
 const from=hoursValue(time),to=hoursValue(endTime),duration=(to-from)*60;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d\d:00$/.test(time)||!/^\d\d:00$/.test(endTime)||from<6||from>=23||to>23||to<=from||!name.includes(' ')||name.length<3||!/[\p{L}]/u.test(name)||!/^[\p{L}\p{N}/. -]{5,30}$/u.test(bi))bad('Data, horário, nome ou B.I. inválidos');
 if(!courts.includes(court))bad('Selecciona um dos quatro campos disponíveis.');
 if(!phoneValid(phone))bad('Indica um contacto moçambicano válido.');
 const d=new Date(date+'T12:00:00Z'),today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Maputo'});
 if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==date||date<today)bad('Data inválida ou passada');
 if(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z')>44*86400000)bad('As marcações estão disponíveis até 45 dias.');
 return tx(async db=>{
   // O mesmo lock por data é usado para todas as novas reservas, impedindo sobreposição em concorrência.
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-booking-'+date]);
   const previous=await db.query("SELECT data FROM ipz_bookings WHERE data->>'requestId'=$1 LIMIT 1",[requestId]);
   if(previous.rows.length)return previous.rows[0].data;
   const entries=(await db.query("SELECT court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[date])).rows;
   if(entries.some(x=>x.court===court&&bookingOverlaps({...x.data,time:x.booking_time},from,to)))bad('O campo seleccionado já está ocupado neste período.',409);
   {
     const item={ref:ref('RES'),requestId,at:new Date().toISOString(),court,date,time,endTime,cn:name,bi,cp:normalizePhone(phone),channel:'whatsapp',contactWhatsApp:'+258 87 738 8644',duration,price:(duration/60)*bookingPrice,pay:'A combinar pelo WhatsApp',payAuto:false,st:'Pendente'};
     await db.query('INSERT INTO ipz_bookings(ref,court,booking_date,booking_time,status,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[item.ref,court,date,time,item.st,JSON.stringify(item)]);
     return item;
   }

 });
}
async function submitMessage(b){if(!cut(b.n)||!cut(b.m)||!/^\S+@\S+\.\S+$/.test(cut(b.e)))bad('Dados da mensagem inválidos');const o={ref:ref('MSG'),at:new Date().toISOString(),n:cut(b.n),e:cut(b.e,220),m:cut(b.m,2000),rd:false};await pool.query('INSERT INTO ipz_messages(ref,data) VALUES($1,$2::jsonb)',[o.ref,JSON.stringify(o)]);return o;}
async function modifyRecord(c,payload,actor={email:'system',role:'system'}){return tx(async db=>{
  if(!payload||!Array.isArray(payload.list))bad('Alteração inválida');
  const table=recordTables[c];
  // A interface envia a lista inteira. Actualizamos SOMENTE os campos permitidos.
  for(const patch of payload.list){if(!patch||!/^\w+-[A-Za-z0-9]+$/.test(String(patch.ref||'')))bad('Referência inválida');
   const r=await db.query(`SELECT data FROM ${table} WHERE ref=$1 FOR UPDATE`,[patch.ref]);if(!r.rows.length)bad('Registo não encontrado',404);
   const current=r.rows[0].data, next={...current};
   if(c==='messages'){if(typeof patch.rd!=='boolean')bad('Estado inválido');next.rd=patch.rd;}
   if(c==='orders'){
    if(!ordersStatuses.includes(patch.st))bad('Estado de compra inválido');
    if(current.st!==patch.st){
      if(current.channel==='whatsapp'){
       const had=!!current.inventoryCommitted,will=patch.st==='Entregue';
       if(had!==will){
        for(const it of current.items||[]){
         const pr=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[it.id]);
         if(!pr.rows.length)bad('Produto já não existe no catálogo',409);
         const product=pr.rows[0].data;
         const remaining=Number(product.s)+(had?Number(it.q):-Number(it.q));
         if(remaining<0)bad('Stock insuficiente para concluir a venda: '+product.n,409);
         await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[it.id,JSON.stringify({...product,s:remaining})]);
        }
       }
       next.inventoryCommitted=will;
      }else if(current.st!=='Cancelado'&&patch.st==='Cancelado'){
       for(const it of current.items){const pr=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[it.id]);if(pr.rows.length){const p=pr.rows[0].data;await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[it.id,JSON.stringify({...p,s:p.s+it.q})]);}}
      }else if(current.st==='Cancelado'&&patch.st!=='Cancelado'){
       for(const it of current.items){const pr=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[it.id]);if(!pr.rows.length||pr.rows[0].data.s<it.q)bad('Stock insuficiente para reactivar o pedido',409);const p=pr.rows[0].data;await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[it.id,JSON.stringify({...p,s:p.s-it.q})]);}
      }
    }next.st=patch.st;
   }
   if(c==='bookings'){if(!bookingStatuses.includes(patch.st))bad('Estado de reserva inválido');next.st=patch.st;
    if(current.st==='Cancelada'&&next.st!=='Cancelada'){
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-booking-'+current.date]);
      const entries=(await db.query("SELECT ref,court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[current.date])).rows;
      const it=bookingInterval(current);
      if(entries.some(x=>x.ref!==patch.ref&&x.court===current.court&&bookingOverlaps({...x.data,time:x.booking_time},it.start,it.end)))bad('Conflito: o campo está ocupado neste intervalo.',409);
    }
    try{await db.query('UPDATE ipz_bookings SET status=$2,data=$3::jsonb WHERE ref=$1',[patch.ref,next.st,JSON.stringify(next)]);}catch(e){if(e.code==='23505')bad('Conflito: este campo e horário já estão ocupados',409);throw e;}
    if(current.st!==next.st)await db.query('INSERT INTO ipz_audit_log(actor_email,actor_role,entity_type,entity_ref,previous_status,new_status) VALUES($1,$2,$3,$4,$5,$6)',[actor.email,actor.role,c,patch.ref,current.st,next.st]);
    continue;
   }
   await db.query(`UPDATE ${table} SET data=$2::jsonb WHERE ref=$1`,[patch.ref,JSON.stringify(next)]);
   if(c==='orders'&&current.st!==next.st)await db.query('INSERT INTO ipz_audit_log(actor_email,actor_role,entity_type,entity_ref,previous_status,new_status) VALUES($1,$2,$3,$4,$5,$6)',[actor.email,actor.role,c,patch.ref,current.st,next.st]);
  }return true;
});}
async function saveProduct(id,v){if(!/^[a-zA-Z0-9_-]{2,60}$/.test(id))bad('ID inválido');
 const current=(await pool.query('SELECT data FROM ipz_products WHERE id=$1',[id])).rows[0]?.data;
 if(!current&&v.custom!==true)bad('Produto inexistente');
 const n=cut(v.n||current?.n,150),p=Number(v.p),s=Number(v.s),c=Number(v.c??current?.c??0);
 if(!n||!Number.isFinite(p)||p<0||!Number.isInteger(s)||s<0||!Number.isInteger(c)||c<0||c>9)bad('Dados do produto inválidos');
 let images=current?.images||[];
 if(Object.prototype.hasOwnProperty.call(v,'images')){
  if(!Array.isArray(v.images))bad('Formato de imagens inválido');
  if(current&&v.images.length===0&&(!current.images||current.images.length===0))images=[];
  else {
  if(v.images.length!==4)bad('Selecciona exactamente 4 imagens do produto');
  const unchanged=current&&v.images.every((source,i)=>typeof source==='string'&&source.startsWith('/api/product-image/'+id+'/'+i+'?v='));
  if(unchanged)images=current.images||[];
  else images=v.images.map((source,i)=>{
   if(typeof source!=='string'||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(source))bad('Formato de imagem inválido na posição '+(i+1));
   const data=source.slice(source.indexOf(',')+1);
   if(Buffer.byteLength(data,'base64')>180*1024)bad('Imagem '+(i+1)+' excede 180 KB. Tenta novamente com imagens menores.');
   return source;
  });
  }
 }
 if(!current&&images.length!==4)bad('Os produtos novos precisam de exactamente 4 imagens');
 const item={...(current||{}),custom:current?.custom||v.custom===true,n,p,s,c,pub:v.pub!==false,id,categoryVersion:2,t:current?.t||['racket','shoe','shirt','bag','bag','ball','grip','racket','racket','racket'][c],col:current?.col||'#1673B8',images};
 await pool.query('INSERT INTO ipz_products(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[id,JSON.stringify(item)]);}


async function excel45Days(res){
 const until=new Date(), start=new Date(until.getTime()-45*86400000);
 const [orders,bookings,messages,products,tournaments,gallery]=await Promise.all([
  pool.query('SELECT data FROM ipz_orders WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_bookings WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_messages WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_products ORDER BY id'),
  pool.query('SELECT id,data FROM ipz_tournaments WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT id,caption,created_at FROM ipz_gallery ORDER BY created_at DESC')
 ]);
 const O=orders.rows.map(r=>r.data), B=bookings.rows.map(r=>r.data), M=messages.rows.map(r=>r.data), P=products.rows.map(r=>r.data), T=tournaments.rows.map(r=>({...r.data,id:r.id})), G=gallery.rows;
 const active=O.filter(x=>x.st!=='Cancelado');const revenue=active.reduce((n,x)=>n+Number(x.total||0),0);const completedValue=O.filter(x=>x.st==='Entregue').reduce((n,x)=>n+Number(x.total||0),0);
 const wb=new ExcelJS.Workbook();wb.creator='Indoor Padel Zone';wb.created=until;
 wb.properties.date1904=false;
 const green='CFF902', dark='10232B';
 function sheet(name,headers,rows,widths){const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:2}]});
  ws.mergeCells(1,1,1,headers.length);const title=ws.getCell(1,1);title.value='INDOOR PADEL ZONE | '+name.toUpperCase();title.font={bold:true,size:15,color:{argb:'FFFFFFFF'}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+dark}};title.alignment={vertical:'middle'};ws.getRow(1).height=32;
  ws.addRow(headers);ws.getRow(2).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+green}};c.font={bold:true,color:{argb:'FF'+dark}};c.alignment={vertical:'middle'}});ws.getRow(2).height=26;
  for(const row of rows)ws.addRow(row);
  (widths||headers.map(()=>22)).forEach((w,i)=>ws.getColumn(i+1).width=w);
  for(let i=3;i<=ws.rowCount;i++){const r=ws.getRow(i);if(i%2===0)r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F7F6'}});r.height=21;}
  ws.autoFilter={from:{row:2,column:1},to:{row:Math.max(2,ws.rowCount),column:headers.length}};
  ws.pageSetup={fitToPage:true,fitToWidth:1,fitToHeight:0,orientation:'landscape'};
  return ws;
 }
 const period='De '+start.toISOString().slice(0,10)+' até '+until.toISOString().slice(0,10)+' (UTC)';
 const stats=[['Período de análise',period],['Pedidos registados (incl. WhatsApp)',O.length],['Pedidos recebidos via WhatsApp',O.filter(x=>x.channel==='whatsapp').length],['Vendas entregues (valor MT, não prova de pagamento)',completedValue],['Compras activas',active.length],['Compras canceladas',O.length-active.length],['Valor estimado dos pedidos não cancelados (MT)',revenue],['Histórico de pagamentos verificados (MT)',O.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.total||0),0)+B.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.price||0),0)],['Reservas registadas',B.length],['Reservas pendentes',B.filter(x=>x.st==='Pendente').length],['Reservas confirmadas',B.filter(x=>x.st==='Confirmada').length],['Reservas canceladas',B.filter(x=>x.st==='Cancelada').length],['Mensagens recebidas',M.length],['Mensagens não lidas',M.filter(x=>!x.rd).length],['Produtos no catálogo (estado actual)',P.length],['Produtos publicados (estado actual)',P.filter(x=>x.pub!==false).length],['Produtos com stock baixo ≤ 3 (estado actual)',P.filter(x=>Number(x.s)<=3).length],['Torneios criados nos últimos 45 dias',T.length],['Fotografias da galeria (estado actual)',G.length]];
 const summary=sheet('Resumo',['Indicador','Valor'],stats,[51,73]);summary.getColumn(2).alignment={vertical:'middle',wrapText:true};
 summary.getCell(7,2).numFmt='#,##0.00 "MT"';
 const date=x=>x?new Date(x).toISOString().replace('T',' ').slice(0,16):'';
 const so=sheet('Compras',['Referência','Criada em (UTC)','Cliente','Telefone','Email','Estado','Pagamento','Canal','Entrega','Endereço','Total estimado MT','Itens'],O.map(x=>[x.ref,date(x.at),x.cn,x.cp,x.ce,x.st,x.pay,x.pm,x.dl,x.a,Number(x.total)||0,(x.items||[]).map(i=>`${i.q}x ${i.n}${i.sz?' ['+i.sz+']':''}`).join('; ')]),[22,22,26,18,30,20,22,14,16,32,17,65]);so.getColumn(11).numFmt='#,##0.00 "MT"';
 sheet('Reservas',['Referência','Criada em (UTC)','Campo','Data reservada','Hora','Cliente','B.I.','Pagamento','Telefone / carteira','Preço (MT)','Estado'],B.map(x=>[x.ref,date(x.at),x.court,x.date,x.time,x.cn,x.bi||'',x.pm||'',x.cp||'',Number(x.price)||0,x.st]),[24,23,18,20,13,28,24,18,23,17,18]);
 sheet('Mensagens',['Referência','Criada em (UTC)','Nome','Email','Mensagem','Lida'],M.map(x=>[x.ref,date(x.at),x.n,x.e,x.m,x.rd?'Sim':'Não']),[24,23,28,35,70,14]);
 const sp=sheet('Produtos',['ID','Nome','Categoria','Preço MT','Stock','Publicado','Imagens'],P.map(x=>[x.id,x.n,['Raquetes','Sapatilhas','Roupa','Sacos','Packs','Bolas','Acessórios','Outlet','Pickleball','Outras raquetes'][x.c]||'',Number(x.p)||0,Number(x.s)||0,x.pub!==false?'Sim':'Não',(x.images||[]).length]),[22,47,26,20,16,16,15]);sp.getColumn(4).numFmt='#,##0.00 "MT"';
 sheet('Torneios',['ID','Nome','Data','Estado','Organizador','Email','Telefone','Capacidade','Inscritos','Jogos sorteados'],T.map(x=>[x.id,x.title,x.date,x.status,x.name,x.email,x.phone,x.capacity,(x.participants||[]).length,(x.draw||[]).length]),[25,33,16,27,30,32,20,17,16,20]);
 sheet('Galeria',['ID','Legenda','Adicionada em (UTC)'],G.map(x=>[x.id,x.caption,date(x.created_at)]),[27,65,25]);
 const days=new Map();for(let i=44;i>=0;i--){const d=new Date(Date.UTC(until.getUTCFullYear(),until.getUTCMonth(),until.getUTCDate()-i));days.set(d.toISOString().slice(0,10),{orders:0,bookings:0,messages:0,revenue:0})}
 for(const o of O){const d=String(o.at).slice(0,10),v=days.get(d);if(v){v.orders++;if(o.st!=='Cancelado')v.revenue+=Number(o.total)||0}}
 for(const b of B){const v=days.get(String(b.at).slice(0,10));if(v)v.bookings++}
 for(const m of M){const v=days.get(String(m.at).slice(0,10));if(v)v.messages++}
 const daily=sheet('Evolução diária',['Data (UTC)','Compras','Reservas','Mensagens','Valor estimado dos pedidos MT'],[...days].map(([d,v])=>[d,v.orders,v.bookings,v.messages,v.revenue]),[22,19,19,19,30]);daily.getColumn(5).numFmt='#,##0.00 "MT"';
 const buffer=await wb.xlsx.writeBuffer();res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="IDPZ-relatorio-45-dias-${until.toISOString().slice(0,10)}.xlsx"`,'Cache-Control':'no-store','Content-Length':buffer.length,'X-Content-Type-Options':'nosniff'});res.end(Buffer.from(buffer));
}


// GALERIA E TORNEIOS: todas as gravações permanecem no PostgreSQL Neon.
function galleryImage(input){
 if(typeof input!=='string'||input.length>380000||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(input))bad('Imagem inválida ou demasiado grande (máximo ~250 KB)',400);
 return input;
}
function validateEmail(v){return /^\S+@\S+\.\S+$/.test(v)}
function tournamentBody(b,isAdmin){
 const name=cut(b.name,100),email=cut(b.email,160),phone=cut(b.phone,24),title=cut(b.title||b.name,110),date=cut(b.date,10);
 const max=Number(b.capacity||b.count), roster=Array.isArray(b.participants)?b.participants:[];
 if(!name||!validateEmail(email)||!phoneValid(phone)||!Number.isInteger(max)||max<2||max>128)bad('Preenche organizador, email, telefone e capacidade (2–128).');
 if(title.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))bad('Indica nome e data válidos para o torneio.');
 if(!isAdmin && date<new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Maputo'}))bad('A data do torneio deve ser futura.');
 if(roster.length>max)bad('Participantes excedem as vagas disponíveis.');
 const names=roster.map(x=>cut(x,80)).filter(Boolean);
 if(names.some(x=>x.length<2)||new Set(names.map(x=>x.toLocaleLowerCase('pt'))).size!==names.length)bad('Os participantes não podem repetir-se.');
 return {name,email,phone,title,date,capacity:max,participants:names};
}
function drawMatches(names){
 if(names.length<2)bad('São necessários pelo menos dois participantes para sortear.');
 const list=[...names];for(let i=list.length-1;i>0;i--){const j=crypto.randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}
 const matches=[];for(let i=0;i<list.length;i+=2)matches.push({a:list[i],b:list[i+1]||null});return matches;
}
async function galleryList(){const q=await pool.query('SELECT id,caption,created_at FROM ipz_gallery ORDER BY created_at DESC LIMIT 150');return q.rows.map(x=>({...x,url:'/api/gallery/image/'+x.id}));}
async function tournamentList(admin=false){const q=await pool.query('SELECT id,data FROM ipz_tournaments ORDER BY (data->>\'date\') DESC LIMIT 300');return q.rows.filter(x=>admin||['Publicado','Concluído'].includes(x.data.status)).map(x=>{const item={id:x.id,...x.data};if(!admin){delete item.email;delete item.phone;}return item;});}
async function publicTournament(id){
 const q=await pool.query('SELECT id,data FROM ipz_tournaments WHERE id=$1',[id]);
 if(!q.rows.length||!['Publicado','Concluído'].includes(q.rows[0].data.status))return null;
 const item={id:q.rows[0].id,...q.rows[0].data};
 delete item.email;delete item.phone;
 const photos=await pool.query('SELECT id,caption FROM ipz_tournament_photos WHERE tournament_id=$1 ORDER BY created_at DESC LIMIT 80',[id]);
 return {...item,photos:photos.rows.map(x=>({...x,url:'/api/tournaments/photo/'+x.id}))};
}
function cleanRanking(items, participants){
 if(!Array.isArray(items)||items.length>128)bad('Ranking inválido');
 const roster=new Set((participants||[]).map(v=>v.toLocaleLowerCase('pt'))),seen=new Set(),places=new Set();
 return items.map(x=>{
  const name=cut(x.name,80),position=Number(x.position),points=Number(x.points||0),wins=Number(x.wins||0);
  if(!roster.has(name.toLocaleLowerCase('pt'))||seen.has(name.toLocaleLowerCase('pt'))||!Number.isInteger(position)||position<1||position>128||places.has(position)||!Number.isInteger(points)||points<0||points>100000||!Number.isInteger(wins)||wins<0||wins>1000)bad('Ranking inválido: verifica os nomes, posições, pontos e vitórias.');
  seen.add(name.toLocaleLowerCase('pt'));places.add(position);return {name,position,points,wins};
 }).sort((a,b)=>a.position-b.position);
}
// Não existem integrações de gateway de pagamento nesta versão.
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
async function handler(req,res){const u=new URL(req.url,'http://localhost'),r=u.pathname,m=req.method;
 if(r==='/health'&&m==='GET'){try{await pool.query('SELECT 1');return json(res,200,{ok:true,database:'connected'});}catch{return error(res,503,'Base de dados indisponível');}}
 if(r.startsWith('/api/')){
  if(m!=='GET'&&!sameOrigin(req))return error(res,403,'Origem não autorizada');

  if(r==='/api/gallery'&&m==='GET')return json(res,200,{items:await galleryList()});
  if(r==='/api/gallery/image/'+(r.split('/').pop())&&m==='GET'&&/^\/api\/gallery\/image\/[a-zA-Z0-9_-]+$/.test(r)){
   const id=r.split('/').pop(),q=await pool.query('SELECT image FROM ipz_gallery WHERE id=$1',[id]),uri=q.rows[0]?.image;
   if(!uri)return error(res,404,'Imagem não encontrada');const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.split(',')[1],'base64');
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=600'});return res.end(bytes);
  }
  if(r==='/api/tournaments'&&m==='GET')return json(res,200,{items:await tournamentList()});
  const tournamentPhoto=r.match(/^\/api\/tournaments\/photo\/([A-Za-z0-9_-]+)$/);
  if(tournamentPhoto&&m==='GET'){
   const q=await pool.query(`SELECT p.image FROM ipz_tournament_photos p JOIN ipz_tournaments t ON t.id=p.tournament_id WHERE p.id=$1 AND t.data->>'status' IN ('Publicado','Concluído')`,[tournamentPhoto[1]]);
   const uri=q.rows[0]?.image;if(!uri)return error(res,404,'Imagem não encontrada');
   const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.split(',')[1],'base64');
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'public,max-age=600','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  const tournamentDetail=r.match(/^\/api\/tournaments\/([A-Za-z0-9_-]+)$/);
  if(tournamentDetail&&m==='GET'){
   const item=await publicTournament(tournamentDetail[1]);return item?json(res,200,{item}):error(res,404,'Torneio não encontrado');
  }

  if(r==='/api/tournaments'&&m==='POST'){
    limitCommunity(req);
    const v=tournamentBody(await parse(req),false),id=ref('TOR');
    const data={...v,organizer:v.name,status:'A aguardar aprovação',createdAt:new Date().toISOString(),draw:v.participants.length>=2?drawMatches(v.participants):[]};
    await pool.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb)',[id,JSON.stringify(data)]);
    return json(res,201,{id,status:data.status,draw:data.draw});
  }
  if(r==='/api/availability'&&m==='GET'){
   const date=u.searchParams.get('date')||'',court=u.searchParams.get('court')||'',start=u.searchParams.get('start')||'',end=u.searchParams.get('end')||'';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(court&&!courts.includes(court)))return error(res,400,'Data ou campo inválido');
   if((start||end)&&(!/^\d\d:00$/.test(start)||!/^\d\d:00$/.test(end)||hoursValue(start)<6||hoursValue(end)>23||hoursValue(end)<=hoursValue(start)))return error(res,400,'Intervalo de horas inválido');
   const rows=await pool.query("SELECT court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[date]);
   if(start&&end){const st=hoursValue(start),en=hoursValue(end);const free=courts.filter(c=>!rows.rows.some(x=>x.court===c&&bookingOverlaps({...x.data,time:x.booking_time},st,en)));return json(res,200,{availableCount:free.length,availableCourts:free,occupiedCourts:courts.filter(c=>!free.includes(c)),start,end,date,price:(en-st)*bookingPrice});}
   const available=Object.fromEntries(times.map(t=>[t,courts.length-courts.filter(c=>rows.rows.some(x=>x.court===c&&bookingOverlaps({...x.data,time:x.booking_time},hoursValue(t),hoursValue(t)+1))).length]));
   if(court)return json(res,200,{occupied:times.filter(t=>rows.rows.some(x=>x.court===court&&bookingOverlaps({...x.data,time:x.booking_time},hoursValue(t),hoursValue(t)+1)))});
   return json(res,200,{available,times,price:bookingPrice,duration:60});
  }
  if(r==='/api/session'&&m==='GET'){const s=await session(req);return json(res,200,{admin:!!s,role:s?.role||null,email:s?.email||null,online:true});}
  if(r==='/api/login'&&m==='POST'){
   const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim(),prev=attempts.get(ip)||{n:0,until:0};
   if(prev.until>Date.now())return error(res,429,'Demasiadas tentativas. Tenta daqui a 15 minutos.');
   const b=await parse(req),email=cut(b.email,200).toLowerCase(),acc=passwords[email];
   if(!acc||!safeCompare(b.password||'',acc.password)){prev.n++;if(prev.n>=5){prev.n=0;prev.until=Date.now()+15*60000;}attempts.set(ip,prev);return error(res,401,'Email ou palavra-passe inválidos');}
   attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');
   await pool.query('INSERT INTO ipz_sessions(token_hash,email,role,expires_at) VALUES($1,$2,$3,now()+interval \'8 hours\')',[hash,email,acc.role]);
   return json(res,200,{admin:true,role:acc.role,email},{'Set-Cookie':setCookie(token)});
  }
  if(r==='/api/logout'&&m==='POST'){const token=cookies(req);if(token)await pool.query('DELETE FROM ipz_sessions WHERE token_hash=$1',[crypto.createHash('sha256').update(token).digest('hex')]);return json(res,200,{ok:true},{'Set-Cookie':setCookie('',true)});}
  const photoRoute=r.match(/^\/api\/product-image\/([a-zA-Z0-9_-]+)\/([0-3])$/);
  if(photoRoute&&m==='GET'){
   const q=await pool.query(`SELECT data->'images'->>$2::int AS img FROM ipz_products WHERE id=$1`,[photoRoute[1],Number(photoRoute[2])]);
   const uri=q.rows[0]?.img;
   if(!uri||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(uri))return error(res,404,'Imagem indisponível');
   const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.slice(uri.indexOf(',')+1),'base64');
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  if(r==='/api/snapshot/products'&&m==='GET')return json(res,200,{docs:await snapshot('products')});
  if(r.startsWith('/api/submit/')&&m==='POST'){
   const c=r.split('/').pop(),b=await parse(req);let item;
   if(c==='orders')item=await submitWhatsAppOrder(b,req);else if(c==='bookings'){publicRateLimit(req,c,8);item=await submitBooking(b);}else if(c==='messages'){publicRateLimit(req,c,5);item=await submitMessage(b);}else return error(res,404,'Rota inexistente');
   return json(res,201,{ok:true,item});
  }
  const s=await session(req);if(!s)return error(res,401,'Inicia sessão para aceder ao painel');

  if(r==='/api/admin/gallery'&&m==='POST'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const b=await parse(req,400000),id=ref('GAL');
    const caption=cut(b.caption,160);if(!caption)bad('Indica uma legenda');
    await pool.query('INSERT INTO ipz_gallery(id,caption,image) VALUES($1,$2,$3)',[id,caption,galleryImage(b.image)]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/gallery/')&&m==='DELETE'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const id=r.split('/').pop();await pool.query('DELETE FROM ipz_gallery WHERE id=$1',[id]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/tournaments'&&m==='GET'){if(s.role!=='admin')return error(res,403,'Apenas Admin');return json(res,200,{items:await tournamentList(true)});}
  const adminPhoto=r.match(/^\/api\/admin\/tournaments\/photo\/([A-Za-z0-9_-]+)$/);
  if(adminPhoto&&m==='GET'){
   if(s.role!=='admin')return error(res,403,'Apenas Admin');const q=await pool.query('SELECT image FROM ipz_tournament_photos WHERE id=$1',[adminPhoto[1]]),uri=q.rows[0]?.image;if(!uri)return error(res,404,'Imagem não encontrada');
   const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.split(',')[1],'base64');res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  const rankingRoute=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/ranking$/);
  if(rankingRoute&&m==='PUT'){
   if(s.role!=='admin')return error(res,403,'Apenas Admin');const id=rankingRoute[1],b=await parse(req);
   const q=await pool.query('SELECT data FROM ipz_tournaments WHERE id=$1',[id]);if(!q.rows.length)return error(res,404,'Torneio inexistente');
   const ranking=cleanRanking(b.ranking,q.rows[0].data.participants);
   await pool.query("UPDATE ipz_tournaments SET data=jsonb_set(data,'{ranking}',$2::jsonb) WHERE id=$1",[id,JSON.stringify(ranking)]);
   return json(res,200,{ok:true,ranking});
  }
  const photosRoute=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/photos$/);
  if(photosRoute&&m==='GET'){
   if(s.role!=='admin')return error(res,403,'Apenas Admin');const q=await pool.query('SELECT id,caption FROM ipz_tournament_photos WHERE tournament_id=$1 ORDER BY created_at DESC',[photosRoute[1]]);
   return json(res,200,{items:q.rows.map(x=>({...x,url:'/api/admin/tournaments/photo/'+x.id}))});
  }
  if(photosRoute&&m==='POST'){
   if(s.role!=='admin')return error(res,403,'Apenas Admin');const b=await parse(req,400000),id=ref('TFOTO');
   const q=await pool.query('SELECT id FROM ipz_tournaments WHERE id=$1',[photosRoute[1]]);if(!q.rows.length)return error(res,404,'Torneio inexistente');
   const caption=cut(b.caption,160)||'Fotografia do torneio';
   const n=await pool.query('SELECT count(*)::int AS n FROM ipz_tournament_photos WHERE tournament_id=$1',[photosRoute[1]]);
   if(n.rows[0].n>=80)return error(res,409,'Limite de 80 fotografias por torneio');
   await pool.query('INSERT INTO ipz_tournament_photos(id,tournament_id,caption,image) VALUES($1,$2,$3,$4)',[id,photosRoute[1],caption,galleryImage(b.image)]);
   return json(res,201,{ok:true,id});
  }
  const deletePhoto=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/photos\/([A-Za-z0-9_-]+)$/);
  if(deletePhoto&&m==='DELETE'){
   if(s.role!=='admin')return error(res,403,'Apenas Admin');await pool.query('DELETE FROM ipz_tournament_photos WHERE tournament_id=$1 AND id=$2',[deletePhoto[1],deletePhoto[2]]);
   return json(res,200,{ok:true});
  }

  if(r==='/api/admin/tournaments'&&m==='POST'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const v=tournamentBody(await parse(req),true),id=ref('TOR');
    await pool.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb)',[id,JSON.stringify({...v,organizer:v.name,status:'Publicado',draw:[],createdAt:new Date().toISOString()})]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/tournaments/')&&m==='PATCH'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const id=r.split('/').pop(),b=await parse(req);
    const row=await pool.query('SELECT data FROM ipz_tournaments WHERE id=$1',[id]);if(!row.rows.length)return error(res,404,'Torneio não encontrado');
    let data=row.rows[0].data;
    if(b.action==='publish')data={...data,status:'Publicado'};
    else if(b.action==='finish')data={...data,status:'Concluído'};
    else if(b.action==='draw'){
       const participants=Array.isArray(data.participants)?data.participants:[];
       if(participants.length<2)bad('Inscreve pelo menos dois participantes antes do sorteio.');
       data={...data,draw:drawMatches(participants),drawnAt:new Date().toISOString()};
    }else if(b.action==='roster'){
       const participants=Array.isArray(b.participants)?b.participants.map(x=>cut(x,80)).filter(Boolean):[];
       if(participants.length>data.capacity||new Set(participants.map(x=>x.toLowerCase())).size!==participants.length)bad('Lista inválida ou nomes repetidos.');
       data={...data,participants,draw:[],ranking:[]};
    } else bad('Operação inválida');
    await pool.query('UPDATE ipz_tournaments SET data=$2::jsonb WHERE id=$1',[id,JSON.stringify(data)]);return json(res,200,{ok:true});
  }
  if(r.startsWith('/api/admin/tournaments/')&&m==='DELETE'){
     if(s.role!=='admin')return error(res,403,'Apenas Admin');await pool.query('DELETE FROM ipz_tournaments WHERE id=$1',[r.split('/').pop()]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/audit'&&m==='GET'){if(s.role!=='admin')return error(res,403,'Apenas Admin');const q=await pool.query('SELECT happened_at,actor_email,actor_role,entity_type,entity_ref,previous_status,new_status FROM ipz_audit_log ORDER BY happened_at DESC LIMIT 300');return json(res,200,{items:q.rows});}
  if(r==='/api/admin/export-45-days'&&m==='GET'){if(s.role!=='admin')return error(res,403,'Apenas Admin pode exportar o relatório');return excel45Days(res);}
  const sm=r.match(/^\/api\/snapshot\/(orders|bookings|messages|products)$/);
  if(sm&&m==='GET')return json(res,200,{docs:await snapshot(sm[1])});
  const itemRoute=r.match(/^\/api\/item\/(orders|bookings|messages)\/([A-Za-z0-9_-]+)$/);
  if(itemRoute&&m==='PATCH'){
   const [,c,id]=itemRoute,patch=await parse(req);
   if(!/^\w+-[A-Za-z0-9]+$/.test(id))return error(res,400,'Referência inválida');
   await modifyRecord(c,{list:[{ref:id,...patch}]},s);return json(res,200,{ok:true});
  }
  const doc=r.match(/^\/api\/doc\/(orders|bookings|messages|products)\/([a-zA-Z0-9_-]+)$/);
  if(doc){const [,c,id]=doc;
   if(m==='GET'){if(c==='products'&&s.role!=='admin')return error(res,403,'Acesso restrito');let data=await getDoc(c,id);return json(res,200,{exists:!!data,data});}
   if(m==='PUT'){
    if(c==='products'){if(s.role!=='admin')return error(res,403,'Apenas Admin pode editar produtos');await saveProduct(id,await parse(req,1100000));}
    else {if(id!=='local')return error(res,400,'Identificador inválido');await modifyRecord(c,await parse(req),s);}
    return json(res,200,{ok:true});
   }
  }
  return error(res,404,'Rota inexistente');
 }
 if(m!=='GET'&&m!=='HEAD')return error(res,405,'Método não permitido');
 const file=r==='/'?'index.html':decodeURIComponent(r.slice(1));
 if(!['index.html','admin.html','script.js','styles.css','redesign.css','animations.css','animations.js','community.js','community.css','admin-enhancements.css','booking-v7.css','admin-ui.css','admin-ui.js','admin-status.css','whatsapp-shop.css','booking-whatsapp.css','campeonato-exemplo-1.webp','campeonato-exemplo-2.webp','logo-theme.css','idpz-logo-white.png','court.svg','padel-balls.svg','favicon.ico'].includes(file))return error(res,404,'Ficheiro não encontrado');
 const abs=path.resolve(ROOT,file);fs.stat(abs,(e,info)=>{if(e||!info.isFile())return error(res,404,'Ficheiro não encontrado');
  res.writeHead(200,{'Content-Type':mime[path.extname(abs)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Cache-Control':file.endsWith('.html')?'no-cache':'public, max-age=600'});
  if(m==='HEAD')return res.end();fs.createReadStream(abs).pipe(res);
 });
}
boot().then(()=>http.createServer((req,res)=>Promise.resolve(handler(req,res)).catch(e=>{console.error('[API]',e.message);if(!res.headersSent)error(res,e.status||500,e.status?e.message:'Erro interno. Tenta novamente.');})).listen(PORT,'0.0.0.0',()=>console.log(`Indoor Padel Zone em http://localhost:${PORT}`)))
.catch(e=>{console.error('Falha a ligar PostgreSQL:',e.message);process.exit(1);});
