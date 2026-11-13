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
// Perfis de painel e controlo de acesso (V35). Apenas o proprietário pode administrá-los.
const PERMISSION_KEYS = [
 'dashboard.view','orders.view','orders.edit','bookings.view','bookings.edit',
 'calendar.view','calendar.edit','calendar.blocks','products.view','products.edit',
 'gallery.view','gallery.edit','tournaments.view','tournaments.edit',
 'messages.view','messages.edit','reports.view'
];
const RECEPTION_PERMISSIONS = ['dashboard.view','orders.view','orders.edit','bookings.view','bookings.edit','calendar.view','calendar.edit','messages.view','messages.edit'];
const OWNER_EMAIL='admin@idpz.com', RECEPTION_EMAIL='geral@idpz.com';
function normalizePermissions(value){if(!Array.isArray(value))bad('Permissões inválidas');const perms=new Set(value.filter(x=>PERMISSION_KEYS.includes(x)));for(const key of [...perms]){if(key.endsWith('.edit'))perms.add(key.replace('.edit','.view'));if(key==='calendar.blocks')perms.add('calendar.view');}return [...perms];}
function hasAccess(session,key){return !!session&&(session.email===OWNER_EMAIL&&key==='panels.manage'||(Array.isArray(session.permissions)&&session.permissions.includes(key)));}
function requireAccess(session,key){if(!hasAccess(session,key))bad('Sem permissão para esta operação',403);}
function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const digest=crypto.scryptSync(password,salt,64).toString('hex');return salt+':'+digest;}
function verifyPassword(password,hash){try{const [salt,encoded]=hash.split(':');const actual=crypto.scryptSync(String(password),salt,64);return crypto.timingSafeEqual(actual,Buffer.from(encoded,'hex'));}catch{return false;}}
function validateStaffEmail(email){if(!/^[^\s@]{1,80}@[^\s@]{1,120}\.[^\s@]{2,}$/.test(email))bad('Email inválido');return email;}
async function allPanels(){const q=await pool.query('SELECT id,name,permissions,protected FROM ipz_access_panels ORDER BY protected DESC,name');return q.rows;}
async function sessionInfo(req){const raw=cookies(req);if(!/^[a-f0-9]{64}$/.test(raw))return null;
 const key=crypto.createHash('sha256').update(raw).digest('hex');
 const q=await pool.query('SELECT s.email,s.role,s.active_panel,u.name,u.panels,u.active FROM ipz_sessions s LEFT JOIN ipz_staff_users u ON u.email=s.email WHERE s.token_hash=$1 AND s.expires_at>now()',[key]);
 if(!q.rows.length)return null;const row=q.rows[0],owner=row.email===OWNER_EMAIL;
 if(!owner&&row.active===false)return null;
 const allowed=owner?(await allPanels()).map(p=>p.id):(Array.isArray(row.panels)?row.panels:[]);
 const active=allowed.includes(row.active_panel)?row.active_panel:allowed[0];if(!active)return null;
 const panels=await pool.query('SELECT id,name,permissions FROM ipz_access_panels WHERE id=ANY($1::text[])',[allowed]);
 const available=panels.rows.filter(p=>allowed.includes(p.id));const chosen=available.find(x=>x.id===active);
 if(!chosen)return null;
 return {email:row.email,role:row.role,name:row.name||(owner?'Administração':'Recepcionista'),panelId:chosen.id,panelName:chosen.name,panels:available,permissions:chosen.permissions,canManagePanels:owner};
}
function publicSessionInfo(s){return {admin:!!s,role:s?.role||null,email:s?.email||null,name:s?.name||null,panelId:s?.panelId||null,panelName:s?.panelName||null,panels:s?.panels?.map(p=>({id:p.id,name:p.name}))||[],permissions:s?.permissions||[],canManagePanels:!!s?.canManagePanels,online:true};}
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
async function session(req){return sessionInfo(req);}
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
 CREATE INDEX IF NOT EXISTS ipz_audit_log_happened_at ON ipz_audit_log(happened_at DESC);
 CREATE TABLE IF NOT EXISTS ipz_court_blocks (id TEXT PRIMARY KEY, court TEXT NOT NULL, block_date DATE NOT NULL, start_hour INTEGER NOT NULL, end_hour INTEGER NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(start_hour >= 6 AND end_hour <= 23 AND end_hour > start_hour));
 CREATE INDEX IF NOT EXISTS ipz_court_blocks_day ON ipz_court_blocks(block_date,court);
 CREATE TABLE IF NOT EXISTS ipz_access_panels (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, permissions JSONB NOT NULL, protected BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_staff_users (email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT, panels TEXT[] NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
 await pool.query('ALTER TABLE ipz_sessions ADD COLUMN IF NOT EXISTS active_panel TEXT');
 await pool.query('INSERT INTO ipz_access_panels(id,name,permissions,protected) VALUES($1,$2,$3::jsonb,true) ON CONFLICT(id) DO NOTHING',['admin','Administração',JSON.stringify(PERMISSION_KEYS)]);
 await pool.query('INSERT INTO ipz_access_panels(id,name,permissions,protected) VALUES($1,$2,$3::jsonb,true) ON CONFLICT(id) DO NOTHING',['recepcao','Recepção',JSON.stringify(RECEPTION_PERMISSIONS)]);
 await pool.query('INSERT INTO ipz_staff_users(email,name,password_hash,panels) VALUES($1,$2,NULL,$3::text[]) ON CONFLICT(email) DO NOTHING',[RECEPTION_EMAIL,'Recepcionista',['recepcao']]);
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
// Calendário operacional V34: bloqueios e reservas usam o mesmo lock de data.
function validDay(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function validHours(start,end){return Number.isInteger(start)&&Number.isInteger(end)&&start>=6&&end<=23&&end>start;}
async function lockBookingDates(db, dates){for(const day of [...new Set(dates)].sort())await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-booking-'+day]);}
async function blockConflicts(db,day,court,start,end){
 const result=await db.query('SELECT start_hour,end_hour FROM ipz_court_blocks WHERE block_date=$1 AND court=$2',[day,court]);
 return result.rows.some(x=>start<x.end_hour&&end>x.start_hour);
}
async function calendarData(from,to){
 const [bookings,blocks]=await Promise.all([
  pool.query('SELECT data FROM ipz_bookings WHERE booking_date >= $1 AND booking_date <= $2 ORDER BY booking_date,booking_time,court',[from,to]),
  pool.query('SELECT id,court,block_date::text AS date,start_hour AS start,end_hour AS "end",reason,created_by FROM ipz_court_blocks WHERE block_date >= $1 AND block_date <= $2 ORDER BY block_date,start_hour',[from,to])
 ]);
 return {bookings:bookings.rows.map(x=>{const b=x.data;return {ref:b.ref,date:b.date,court:b.court,time:b.time,endTime:b.endTime||String(hoursValue(b.time)+Math.ceil((Number(b.duration)||60)/60)).padStart(2,'0')+':00',cn:b.cn,cp:b.cp,st:b.st,price:b.price,at:b.at};}),blocks:blocks.rows,courts,times};
}
async function createCourtBlock(body,actor){
 const date=cut(body.date,10),court=cut(body.court,30),start=Number(body.start),end=Number(body.end),reason=cut(body.reason,180);
 if(!validDay(date)||!courts.includes(court)||!validHours(start,end)||!reason)bad('Data, campo, horário ou motivo inválidos');
 return tx(async db=>{
  await lockBookingDates(db,[date]);
  if(await blockConflicts(db,date,court,start,end))bad('Já existe um bloqueio neste intervalo',409);
  const q=await db.query("SELECT data FROM ipz_bookings WHERE booking_date=$1 AND court=$2 AND status <> 'Cancelada'",[date,court]);
  if(q.rows.some(x=>bookingOverlaps(x.data,start,end)))bad('Já existe uma reserva activa neste período',409);
  const id=ref('BLQ');await db.query('INSERT INTO ipz_court_blocks(id,court,block_date,start_hour,end_hour,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,court,date,start,end,reason,actor.email]);
  await db.query('INSERT INTO ipz_audit_log(actor_email,actor_role,entity_type,entity_ref,previous_status,new_status) VALUES($1,$2,$3,$4,$5,$6)',[actor.email,actor.role,'block',id,null,'Criado: '+date+' '+court+' '+start+'-'+end]);
  return id;
 });
}
async function deleteCourtBlock(id,actor){
 return tx(async db=>{
  const q=await db.query('SELECT block_date::text AS date FROM ipz_court_blocks WHERE id=$1',[id]);if(!q.rows.length)bad('Bloqueio não encontrado',404);
  await lockBookingDates(db,[q.rows[0].date]);
  await db.query('DELETE FROM ipz_court_blocks WHERE id=$1',[id]);
  await db.query('INSERT INTO ipz_audit_log(actor_email,actor_role,entity_type,entity_ref,previous_status,new_status) VALUES($1,$2,$3,$4,$5,$6)',[actor.email,actor.role,'block',id,'Bloqueado','Removido']);
 });
}
async function rescheduleBooking(id,body,actor){
 const date=cut(body.date,10),court=cut(body.court,30),time=cut(body.time,5),endTime=cut(body.endTime,5),start=hoursValue(time),end=hoursValue(endTime);
 if(!validDay(date)||!courts.includes(court)||!/^\d\d:00$/.test(time)||!/^\d\d:00$/.test(endTime)||!validHours(start,end))bad('Dados de reagendamento inválidos');
 return tx(async db=>{
  const initial=await db.query('SELECT booking_date::text AS date FROM ipz_bookings WHERE ref=$1',[id]);if(!initial.rows.length)bad('Reserva não encontrada',404);
  await lockBookingDates(db,[initial.rows[0].date,date]);
  const row=await db.query('SELECT data FROM ipz_bookings WHERE ref=$1 FOR UPDATE',[id]);if(!row.rows.length)bad('Reserva não encontrada',404);
  const current=row.rows[0].data;
  if(current.st==='Cancelada')bad('Para reagendar uma reserva cancelada, reactiva-a primeiro',409);
  if(await blockConflicts(db,date,court,start,end))bad('O campo está bloqueado neste intervalo',409);
  const conflict=await db.query("SELECT ref,data FROM ipz_bookings WHERE booking_date=$1 AND court=$2 AND status <> 'Cancelada' AND ref<>$3",[date,court,id]);
  if(conflict.rows.some(x=>bookingOverlaps(x.data,start,end)))bad('Já existe outra reserva neste intervalo',409);
  const next={...current,date,court,time,endTime,duration:(end-start)*60,price:(end-start)*bookingPrice};
  try{await db.query('UPDATE ipz_bookings SET court=$2,booking_date=$3,booking_time=$4,data=$5::jsonb WHERE ref=$1',[id,court,date,time,JSON.stringify(next)]);}catch(e){if(e.code==='23505')bad('Horário já ocupado',409);throw e;}
  await db.query('INSERT INTO ipz_audit_log(actor_email,actor_role,entity_type,entity_ref,previous_status,new_status) VALUES($1,$2,$3,$4,$5,$6)',[actor.email,actor.role,'reschedule',id,current.date+' '+current.court+' '+current.time+'-'+current.endTime,date+' '+court+' '+time+'-'+endTime]);
  return {ref:id,...next};
 });
}
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
   if(await blockConflicts(db,date,court,from,to))bad('O campo está indisponível devido a um bloqueio operacional.',409);
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
      if(await blockConflicts(db,current.date,current.court,it.start,it.end))bad('Conflito: o campo está bloqueado neste intervalo.',409);
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


// Relatórios são gerados sob pedido, na memória. Não se guardam XLSX no Render nem no Neon.
const MONTH_ZONE='Africa/Maputo';
function maputoParts(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:MONTH_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>Number(parts.find(p=>p.type===k).value);
 return {year:get('year'),month:get('month'),day:get('day')};
}
function monthlyWindow(year,month){
 // O fuso de Maputo é UTC+2, sem mudança de horário de Verão.
 return {start:new Date(Date.UTC(year,month-1,1,-2)),end:new Date(Date.UTC(year,month,1,-2))};
}
function allowedReportMonth(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))bad('Mês inválido',400);
 const [year,mon]=month.split('-').map(Number),now=maputoParts(),difference=(now.year-year)*12+now.month-mon;
 if(difference<0||difference>3)bad('Relatório expirado ou ainda não disponível. Acesso apenas ao mês actual e aos últimos 3 meses.',410);
 return {year,mon,difference};
}
function reportMonths(){
 const now=maputoParts();return Array.from({length:4},(_,i)=>{
  const d=new Date(Date.UTC(now.year,now.month-1-i,1));
  return {month:d.toISOString().slice(0,7),current:i===0};
 });
}
async function excelReport(res,start,until,filename,reportLabel){
 const [orders,bookings,messages,products,tournaments,gallery]=await Promise.all([
  pool.query('SELECT data FROM ipz_orders WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_bookings WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_messages WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_products ORDER BY id'),
  pool.query('SELECT id,data FROM ipz_tournaments WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC',[start,until]),
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
 const period=reportLabel+' · Moçambique (UTC+2)';
 const stats=[['Período de análise',period],['Pedidos registados (incl. WhatsApp)',O.length],['Pedidos recebidos via WhatsApp',O.filter(x=>x.channel==='whatsapp').length],['Vendas entregues (valor MT, não prova de pagamento)',completedValue],['Compras activas',active.length],['Compras canceladas',O.length-active.length],['Valor estimado dos pedidos não cancelados (MT)',revenue],['Histórico de pagamentos verificados (MT)',O.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.total||0),0)+B.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.price||0),0)],['Reservas registadas',B.length],['Reservas pendentes',B.filter(x=>x.st==='Pendente').length],['Reservas confirmadas',B.filter(x=>x.st==='Confirmada').length],['Reservas canceladas',B.filter(x=>x.st==='Cancelada').length],['Mensagens recebidas',M.length],['Mensagens não lidas',M.filter(x=>!x.rd).length],['Produtos no catálogo (estado actual)',P.length],['Produtos publicados (estado actual)',P.filter(x=>x.pub!==false).length],['Produtos com stock baixo ≤ 3 (estado actual)',P.filter(x=>Number(x.s)<=3).length],['Torneios criados no período',T.length],['Fotografias da galeria (estado actual)',G.length]];
 const summary=sheet('Resumo',['Indicador','Valor'],stats,[51,73]);summary.getColumn(2).alignment={vertical:'middle',wrapText:true};
 summary.getCell(7,2).numFmt='#,##0.00 "MT"';
 const date=x=>x?new Date(x).toISOString().replace('T',' ').slice(0,16):'';
 const so=sheet('Compras',['Referência','Criada em (UTC)','Cliente','Telefone','Email','Estado','Pagamento','Canal','Entrega','Endereço','Total estimado MT','Itens'],O.map(x=>[x.ref,date(x.at),x.cn,x.cp,x.ce,x.st,x.pay,x.pm,x.dl,x.a,Number(x.total)||0,(x.items||[]).map(i=>`${i.q}x ${i.n}${i.sz?' ['+i.sz+']':''}`).join('; ')]),[22,22,26,18,30,20,22,14,16,32,17,65]);so.getColumn(11).numFmt='#,##0.00 "MT"';
 sheet('Reservas',['Referência','Criada em (UTC)','Campo','Data reservada','Hora','Cliente','B.I.','Pagamento','Telefone / carteira','Preço (MT)','Estado'],B.map(x=>[x.ref,date(x.at),x.court,x.date,x.time,x.cn,x.bi||'',x.pm||'',x.cp||'',Number(x.price)||0,x.st]),[24,23,18,20,13,28,24,18,23,17,18]);
 sheet('Mensagens',['Referência','Criada em (UTC)','Nome','Email','Mensagem','Lida'],M.map(x=>[x.ref,date(x.at),x.n,x.e,x.m,x.rd?'Sim':'Não']),[24,23,28,35,70,14]);
 const sp=sheet('Produtos',['ID','Nome','Categoria','Preço MT','Stock','Publicado','Imagens'],P.map(x=>[x.id,x.n,['Raquetes','Sapatilhas','Roupa','Sacos','Packs','Bolas','Acessórios','Outlet','Pickleball','Outras raquetes'][x.c]||'',Number(x.p)||0,Number(x.s)||0,x.pub!==false?'Sim':'Não',(x.images||[]).length]),[22,47,26,20,16,16,15]);sp.getColumn(4).numFmt='#,##0.00 "MT"';
 sheet('Torneios',['ID','Nome','Data','Estado','Organizador','Email','Telefone','Capacidade','Inscritos','Jogos sorteados'],T.map(x=>[x.id,x.title,x.date,x.status,x.name,x.email,x.phone,x.capacity,(x.participants||[]).length,(x.draw||[]).length]),[25,33,16,27,30,32,20,17,16,20]);
 sheet('Galeria',['ID','Legenda','Adicionada em (UTC)'],G.map(x=>[x.id,x.caption,date(x.created_at)]),[27,65,25]);
 const days=new Map();
 const localDate=x=>new Intl.DateTimeFormat('sv-SE',{timeZone:MONTH_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
 const first=localDate(start),last=localDate(new Date(until.getTime()-1));
 for(let d=new Date(first+'T12:00:00Z');d<=new Date(last+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){
  days.set(d.toISOString().slice(0,10),{orders:0,bookings:0,messages:0,revenue:0});
 }
 for(const o of O){const d=localDate(o.at),v=days.get(d);if(v){v.orders++;if(o.st!=='Cancelado')v.revenue+=Number(o.total)||0}}
 for(const b of B){const v=days.get(localDate(b.at));if(v)v.bookings++}
 for(const m of M){const v=days.get(localDate(m.at));if(v)v.messages++}
 const daily=sheet('Evolução diária',['Data (Maputo)','Compras','Reservas','Mensagens','Valor estimado dos pedidos MT'],[...days].map(([d,v])=>[d,v.orders,v.bookings,v.messages,v.revenue]),[22,19,19,19,30]);daily.getColumn(5).numFmt='#,##0.00 "MT"';
 const buffer=await wb.xlsx.writeBuffer();res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store','Content-Length':buffer.length,'X-Content-Type-Options':'nosniff'});res.end(Buffer.from(buffer));
}



async function excel45Days(res){
 const until=new Date(),start=new Date(until.getTime()-45*86400000);
 return excelReport(res,start,until,`IDPZ-relatorio-45-dias-${until.toISOString().slice(0,10)}.xlsx`,'Últimos 45 dias');
}
async function excelMonth(res,month){
 const {year,mon}=allowedReportMonth(month),{start,end}=monthlyWindow(year,mon);
 return excelReport(res,start,Math.min(end.getTime(),Date.now())===end.getTime()?end:new Date(Math.min(end.getTime(),Date.now())),`IDPZ-relatorio-${month}.xlsx`,`Mês ${month}`);
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
async function tournamentList(admin=false){const q=await pool.query('SELECT id,data FROM ipz_tournaments ORDER BY (data->>\'date\') DESC LIMIT 300');return q.rows.filter(x=>!(x.data.demo===true||x.id.startsWith('TOR-DEMO-'))&&(admin||['Publicado','Concluído'].includes(x.data.status))).map(x=>{const item={id:x.id,...x.data};if(!admin){delete item.email;delete item.phone;}return item;});}
async function publicTournament(id){
 const q=await pool.query('SELECT id,data FROM ipz_tournaments WHERE id=$1',[id]);
 if(!q.rows.length||q.rows[0].data.demo===true||id.startsWith('TOR-DEMO-')||!['Publicado','Concluído'].includes(q.rows[0].data.status))return null;
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
   const q=await pool.query(`SELECT p.image FROM ipz_tournament_photos p JOIN ipz_tournaments t ON t.id=p.tournament_id WHERE p.id=$1 AND t.data->>'status' IN ('Publicado','Concluído') AND COALESCE((t.data->>'demo')::boolean,false)=false AND t.id NOT LIKE 'TOR-DEMO-%'`,[tournamentPhoto[1]]);
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
   const blocks=(await pool.query('SELECT court,start_hour,end_hour FROM ipz_court_blocks WHERE block_date=$1',[date])).rows;
   const blocked=(c,st,en)=>blocks.some(b=>b.court===c&&st<b.end_hour&&en>b.start_hour);
   const occupied=(c,st,en)=>blocked(c,st,en)||rows.rows.some(x=>x.court===c&&bookingOverlaps({...x.data,time:x.booking_time},st,en));
   if(start&&end){const st=hoursValue(start),en=hoursValue(end);const free=courts.filter(c=>!occupied(c,st,en));return json(res,200,{availableCount:free.length,availableCourts:free,occupiedCourts:courts.filter(c=>!free.includes(c)),start,end,date,price:(en-st)*bookingPrice});}
   const available=Object.fromEntries(times.map(t=>[t,courts.length-courts.filter(c=>occupied(c,hoursValue(t),hoursValue(t)+1)).length]));
   if(court)return json(res,200,{occupied:times.filter(t=>occupied(court,hoursValue(t),hoursValue(t)+1))});
   return json(res,200,{available,times,price:bookingPrice,duration:60});
  }
  if(r==='/api/session'&&m==='GET'){const s=await session(req);return json(res,200,publicSessionInfo(s));}
  if(r==='/api/login'&&m==='POST'){
   const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim(),prev=attempts.get(ip)||{n:0,until:0};
   if(prev.until>Date.now())return error(res,429,'Demasiadas tentativas. Tenta daqui a 15 minutos.');
   const b=await parse(req),email=cut(b.email,200).toLowerCase();
   const predefined=passwords[email];
   const userResult=await pool.query('SELECT email,name,password_hash,panels,active FROM ipz_staff_users WHERE email=$1',[email]);
   const user=userResult.rows[0];
   const valid=!!(predefined?safeCompare(b.password||'',predefined.password):(user?.active&&user?.password_hash&&verifyPassword(b.password||'',user.password_hash)));
   if(!valid||(!predefined&&!user?.panels?.length)){prev.n++;if(prev.n>=5){prev.n=0;prev.until=Date.now()+15*60000;}attempts.set(ip,prev);return error(res,401,'Email ou palavra-passe inválidos');}
   if(user&&user.active===false)return error(res,403,'Conta desactivada');
   const role=predefined?.role||'colaborador';const activePanel=email===OWNER_EMAIL?'admin':user?.panels?.[0]||'recepcao';
   const allowed=await pool.query('SELECT id FROM ipz_access_panels WHERE id=$1',[activePanel]);
   if(!allowed.rows.length)return error(res,403,'Nenhum painel disponível para esta conta');
   attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');
   await pool.query('INSERT INTO ipz_sessions(token_hash,email,role,active_panel,expires_at) VALUES($1,$2,$3,$4,now()+interval \'8 hours\')',[hash,email,role,activePanel]);
   const s=await sessionInfo({headers:{cookie:'ipz_session='+token}});
   return json(res,200,publicSessionInfo(s),{'Set-Cookie':setCookie(token)});
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
  // Troca de painel: apenas entre perfis atribuídos ao próprio utilizador.
  if(r==='/api/admin/switch-panel'&&m==='POST'){
   const b=await parse(req),id=cut(b.panelId,80);
   if(!s.panels.some(p=>p.id===id))return error(res,403,'Painel não atribuído a este utilizador');
   const token=cookies(req),hash=crypto.createHash('sha256').update(token).digest('hex');
   await pool.query('UPDATE ipz_sessions SET active_panel=$2 WHERE token_hash=$1',[hash,id]);
   return json(res,200,publicSessionInfo(await session(req)));
  }
  if(r==='/api/admin/panels'&&m==='GET'){
   requireAccess(s,'panels.manage');const users=await pool.query('SELECT email,name,panels,active FROM ipz_staff_users ORDER BY email');
   return json(res,200,{panels:await allPanels(),users:users.rows});
  }
  if(r==='/api/admin/panels'&&m==='POST'){
   requireAccess(s,'panels.manage');const b=await parse(req),name=cut(b.name,65),permissions=normalizePermissions(b.permissions);
   if(name.length<3||name.length>65||!permissions.length)bad('Indica nome e permissões válidas');
   const id='panel_'+crypto.randomBytes(7).toString('hex');
   await pool.query('INSERT INTO ipz_access_panels(id,name,permissions) VALUES($1,$2,$3::jsonb)',[id,name,JSON.stringify(permissions)]);
   return json(res,201,{ok:true,id});
  }
  const panelRoute=r.match(/^\/api\/admin\/panels\/(panel_[a-f0-9]{14})$/);
  if(panelRoute){requireAccess(s,'panels.manage');const id=panelRoute[1];
   if(m==='PATCH'){const b=await parse(req),name=cut(b.name,65),permissions=normalizePermissions(b.permissions);
    if(name.length<3||!permissions.length)bad('Indica nome e permissões válidas');
    const q=await pool.query('UPDATE ipz_access_panels SET name=$2,permissions=$3::jsonb WHERE id=$1 AND protected=false RETURNING id',[id,name,JSON.stringify(permissions)]);
    if(!q.rows.length)return error(res,404,'Painel não encontrado');return json(res,200,{ok:true});}
   if(m==='DELETE'){await tx(async db=>{await db.query('DELETE FROM ipz_access_panels WHERE id=$1 AND protected=false',[id]);
    await db.query('UPDATE ipz_staff_users SET panels=array_remove(panels,$1) WHERE $1=ANY(panels)',[id]);
    await db.query('UPDATE ipz_staff_users SET active=false WHERE cardinality(panels)=0 AND email <> $1',[RECEPTION_EMAIL]);
    await db.query('DELETE FROM ipz_sessions WHERE active_panel=$1',[id]);});return json(res,200,{ok:true});}
  }
  if(r==='/api/admin/staff'&&m==='POST'){
   requireAccess(s,'panels.manage');const b=await parse(req),email=validateStaffEmail(cut(b.email,200).toLowerCase());
   if(email===OWNER_EMAIL)bad('A conta do Administrador principal não pode ser alterada',403);
   const name=cut(b.name,80),pw=String(b.password||''),panels=[...new Set(Array.isArray(b.panels)?b.panels:[])];
   if(!name||!panels.length||panels.length>15)bad('Nome e painéis obrigatórios');
   const found=await pool.query('SELECT id FROM ipz_access_panels WHERE id=ANY($1::text[])',[panels]);
   if(found.rows.length!==panels.length)bad('Painel inválido');
   if(email===RECEPTION_EMAIL){
    await pool.query('UPDATE ipz_staff_users SET name=$2,panels=$3,active=true WHERE email=$1',[email,name,panels]);
   }else{
    if(pw.length<12||pw.length>160)bad('A palavra-passe deve ter entre 12 e 160 caracteres');
    await pool.query('INSERT INTO ipz_staff_users(email,name,password_hash,panels) VALUES($1,$2,$3,$4)',[email,name,hashPassword(pw),panels]);
   }
   return json(res,201,{ok:true});
  }
  const staffRoute=r.match(/^\/api\/admin\/staff\/([^/]+)$/);
  if(staffRoute){requireAccess(s,'panels.manage');const email=validateStaffEmail(decodeURIComponent(staffRoute[1]).toLowerCase());
   if(email===OWNER_EMAIL)bad('A conta do Administrador principal está protegida',403);
   if(m==='PATCH'){
    const b=await parse(req),panels=[...new Set(Array.isArray(b.panels)?b.panels:[])],name=cut(b.name,80);
    if(!name||!panels.length||panels.length>15)bad('Atribui pelo menos um painel');
    const found=await pool.query('SELECT id FROM ipz_access_panels WHERE id=ANY($1::text[])',[panels]);if(found.rows.length!==panels.length)bad('Painel inválido');
    if(email===RECEPTION_EMAIL&&(!panels.length||b.active===false))bad('Não podes desactivar a conta base da Recepção');
    const pw=String(b.password||'');if(pw&&(pw.length<12||pw.length>160))bad('Palavra-passe demasiado curta');
    const q=await pool.query('UPDATE ipz_staff_users SET name=$2,panels=$3,active=$4,password_hash=CASE WHEN $5::text IS NULL THEN password_hash ELSE $5 END WHERE email=$1 RETURNING email',[email,name,panels,b.active!==false,pw?hashPassword(pw):null]);
    if(!q.rows.length)return error(res,404,'Utilizador não encontrado');
    await pool.query('DELETE FROM ipz_sessions WHERE email=$1',[email]);return json(res,200,{ok:true});
   }
   if(m==='DELETE'){
    if(email===RECEPTION_EMAIL)bad('A conta base da Recepção não pode ser apagada',403);
    await tx(async db=>{await db.query('DELETE FROM ipz_sessions WHERE email=$1',[email]);await db.query('DELETE FROM ipz_staff_users WHERE email=$1',[email]);});return json(res,200,{ok:true});
   }
  }


  // Agenda operacional: todas as rotas exigem sessão, alterações respeitam permissões.
  if(r==='/api/admin/calendar'&&m==='GET'){requireAccess(s,'calendar.view');
   const from=u.searchParams.get('from')||'',to=u.searchParams.get('to')||'';
   if(!validDay(from)||!validDay(to)||to<from||(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000>42)return error(res,400,'Intervalo inválido (máximo 43 dias)');
   return json(res,200,await calendarData(from,to));
  }
  if(r==='/api/admin/calendar/blocks'&&m==='POST'){
   requireAccess(s,'calendar.blocks');
   const id=await createCourtBlock(await parse(req),s);return json(res,201,{ok:true,id});
  }
  const removeBlock=r.match(/^\/api\/admin\/calendar\/blocks\/(BLQ-[A-Za-z0-9]+)$/);
  if(removeBlock&&m==='DELETE'){
   requireAccess(s,'calendar.blocks');
   await deleteCourtBlock(removeBlock[1],s);return json(res,200,{ok:true});
  }
  const moveBooking=r.match(/^\/api\/admin\/calendar\/bookings\/(RES-[A-Za-z0-9]+)\/reschedule$/);
  if(moveBooking&&m==='PATCH'){if(!hasAccess(s,'bookings.edit')&&!hasAccess(s,'calendar.edit'))bad('Sem permissão para reagendar',403);return json(res,200,{ok:true,booking:await rescheduleBooking(moveBooking[1],await parse(req),s)});}
  if(r==='/api/admin/gallery'&&m==='POST'){
    requireAccess(s,'gallery.edit');const b=await parse(req,400000),id=ref('GAL');
    const caption=cut(b.caption,160);if(!caption)bad('Indica uma legenda');
    await pool.query('INSERT INTO ipz_gallery(id,caption,image) VALUES($1,$2,$3)',[id,caption,galleryImage(b.image)]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/gallery/')&&m==='DELETE'){
    requireAccess(s,'gallery.edit');const id=r.split('/').pop();await pool.query('DELETE FROM ipz_gallery WHERE id=$1',[id]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/tournaments'&&m==='GET'){requireAccess(s,'tournaments.view');return json(res,200,{items:await tournamentList(true)});}
  const adminPhoto=r.match(/^\/api\/admin\/tournaments\/photo\/([A-Za-z0-9_-]+)$/);
  if(adminPhoto&&m==='GET'){
   requireAccess(s,'tournaments.view');const q=await pool.query('SELECT image FROM ipz_tournament_photos WHERE id=$1',[adminPhoto[1]]),uri=q.rows[0]?.image;if(!uri)return error(res,404,'Imagem não encontrada');
   const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.split(',')[1],'base64');res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  const rankingRoute=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/ranking$/);
  if(rankingRoute&&m==='PUT'){
   requireAccess(s,'tournaments.edit');const id=rankingRoute[1],b=await parse(req);
   const q=await pool.query('SELECT data FROM ipz_tournaments WHERE id=$1',[id]);if(!q.rows.length)return error(res,404,'Torneio inexistente');
   const ranking=cleanRanking(b.ranking,q.rows[0].data.participants);
   await pool.query("UPDATE ipz_tournaments SET data=jsonb_set(data,'{ranking}',$2::jsonb) WHERE id=$1",[id,JSON.stringify(ranking)]);
   return json(res,200,{ok:true,ranking});
  }
  const photosRoute=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/photos$/);
  if(photosRoute&&m==='GET'){
   requireAccess(s,'tournaments.view');const q=await pool.query('SELECT id,caption FROM ipz_tournament_photos WHERE tournament_id=$1 ORDER BY created_at DESC',[photosRoute[1]]);
   return json(res,200,{items:q.rows.map(x=>({...x,url:'/api/admin/tournaments/photo/'+x.id}))});
  }
  if(photosRoute&&m==='POST'){
   requireAccess(s,'tournaments.edit');const b=await parse(req,400000),id=ref('TFOTO');
   const q=await pool.query('SELECT id FROM ipz_tournaments WHERE id=$1',[photosRoute[1]]);if(!q.rows.length)return error(res,404,'Torneio inexistente');
   const caption=cut(b.caption,160)||'Fotografia do torneio';
   const n=await pool.query('SELECT count(*)::int AS n FROM ipz_tournament_photos WHERE tournament_id=$1',[photosRoute[1]]);
   if(n.rows[0].n>=80)return error(res,409,'Limite de 80 fotografias por torneio');
   await pool.query('INSERT INTO ipz_tournament_photos(id,tournament_id,caption,image) VALUES($1,$2,$3,$4)',[id,photosRoute[1],caption,galleryImage(b.image)]);
   return json(res,201,{ok:true,id});
  }
  const deletePhoto=r.match(/^\/api\/admin\/tournaments\/([A-Za-z0-9_-]+)\/photos\/([A-Za-z0-9_-]+)$/);
  if(deletePhoto&&m==='DELETE'){
   requireAccess(s,'tournaments.edit');await pool.query('DELETE FROM ipz_tournament_photos WHERE tournament_id=$1 AND id=$2',[deletePhoto[1],deletePhoto[2]]);
   return json(res,200,{ok:true});
  }

  if(r==='/api/admin/tournaments'&&m==='POST'){
    requireAccess(s,'tournaments.edit');const v=tournamentBody(await parse(req),true),id=ref('TOR');
    await pool.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb)',[id,JSON.stringify({...v,organizer:v.name,status:'Publicado',draw:[],createdAt:new Date().toISOString()})]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/tournaments/')&&m==='PATCH'){
    requireAccess(s,'tournaments.edit');const id=r.split('/').pop(),b=await parse(req);
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
     requireAccess(s,'tournaments.edit');await pool.query('DELETE FROM ipz_tournaments WHERE id=$1',[r.split('/').pop()]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/audit'&&m==='GET'){requireAccess(s,'panels.manage');const q=await pool.query('SELECT happened_at,actor_email,actor_role,entity_type,entity_ref,previous_status,new_status FROM ipz_audit_log ORDER BY happened_at DESC LIMIT 300');return json(res,200,{items:q.rows});}
  if(r==='/api/admin/export-45-days'&&m==='GET'){requireAccess(s,'reports.view');return excel45Days(res);}
  if(r==='/api/admin/reports/months'&&m==='GET'){requireAccess(s,'reports.view');return json(res,200,{months:reportMonths(),timezone:MONTH_ZONE,retentionMonths:3});}
  if(r==='/api/admin/reports/export'&&m==='GET'){requireAccess(s,'reports.view');return excelMonth(res,u.searchParams.get('month'));}
  const sm=r.match(/^\/api\/snapshot\/(orders|bookings|messages|products)$/);
  if(sm&&m==='GET'){requireAccess(s,sm[1]+'.view');return json(res,200,{docs:await snapshot(sm[1])});}
  const itemRoute=r.match(/^\/api\/item\/(orders|bookings|messages)\/([A-Za-z0-9_-]+)$/);
  if(itemRoute&&m==='PATCH'){
   const [,c,id]=itemRoute,patch=await parse(req);
   if(!/^\w+-[A-Za-z0-9]+$/.test(id))return error(res,400,'Referência inválida');
   requireAccess(s,c+'.edit');await modifyRecord(c,{list:[{ref:id,...patch}]},s);return json(res,200,{ok:true});
  }
  const doc=r.match(/^\/api\/doc\/(orders|bookings|messages|products)\/([a-zA-Z0-9_-]+)$/);
  if(doc){const [,c,id]=doc;
   if(m==='GET'){requireAccess(s,c+'.view');let data=await getDoc(c,id);return json(res,200,{exists:!!data,data});}
   if(m==='PUT'){
    if(c==='products'){requireAccess(s,'products.edit');await saveProduct(id,await parse(req,1100000));}
    else {requireAccess(s,c+'.edit');if(id!=='local')return error(res,400,'Identificador inválido');await modifyRecord(c,await parse(req),s);}
    return json(res,200,{ok:true});
   }
  }
  return error(res,404,'Rota inexistente');
 }
 if(m!=='GET'&&m!=='HEAD')return error(res,405,'Método não permitido');
 const file=r==='/'?'index.html':decodeURIComponent(r.slice(1));
 if(!['index.html','admin.html','script.js','styles.css','redesign.css','animations.css','animations.js','community.js','community.css','admin-enhancements.css','booking-v7.css','admin-ui.css','admin-ui.js','admin-calendar.js','admin-calendar.css','admin-panels.js','admin-panels.css','admin-status.css','monthly-reports.css','whatsapp-shop.css','booking-whatsapp.css','logo-theme.css','idpz-logo-white.png','court.svg','padel-balls.svg','favicon.ico'].includes(file))return error(res,404,'Ficheiro não encontrado');
 const abs=path.resolve(ROOT,file);fs.stat(abs,(e,info)=>{if(e||!info.isFile())return error(res,404,'Ficheiro não encontrado');
  res.writeHead(200,{'Content-Type':mime[path.extname(abs)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Cache-Control':/\.(?:html|js|css)$/.test(file)?'no-cache, must-revalidate':'public, max-age=600'});
  if(m==='HEAD')return res.end();fs.createReadStream(abs).pipe(res);
 });
}
boot().then(()=>http.createServer((req,res)=>Promise.resolve(handler(req,res)).catch(e=>{console.error('[API]',e.message);if(!res.headersSent)error(res,e.status||500,e.status?e.message:'Erro interno. Tenta novamente.');})).listen(PORT,'0.0.0.0',()=>console.log(`Indoor Padel Zone em http://localhost:${PORT}`)))
.catch(e=>{console.error('Falha a ligar PostgreSQL:',e.message);process.exit(1);});
