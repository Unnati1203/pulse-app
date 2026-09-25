import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import { Client } from '@elastic/elasticsearch';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import axios from 'axios';
import pino from 'pino';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const queue = new Queue('emailQueue', { connection: redis });
const es = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200', maxRetries: 1, requestTimeout: 1500 });
const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
app.set('trust proxy', 1);
app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(cors({ origin: frontend, credentials: true }));
app.use(express.json({ limit: '2mb' }));
const sessionOptions: session.SessionOptions = { secret: process.env.SESSION_SECRET || 'development-secret-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 } };
if (process.env.USE_REDIS_SESSION === 'true') sessionOptions.store = new RedisStore({ client: redis as any, prefix: 'pulse:sess:' });
app.use(session(sessionOptions));
app.use(passport.initialize()); app.use(passport.session());
passport.serializeUser((u: any, done) => done(null, u));
passport.deserializeUser(async (user: any, done) => { try { done(null, typeof user === 'object' ? user : await prisma.user.findUnique({ where: { id: user } })); } catch (e) { done(null, { id: user }); } });
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback' }, async (_a, _r, profile, done) => {
 const email = profile.emails?.[0]?.value;
 try { if (!email) return done(new Error('Google account did not provide an email')); const profileUser = { id: `google-${profile.id}`, googleId: profile.id, name: profile.displayName, email, avatar: profile.photos?.[0]?.value }; const user = await prisma.user.upsert({ where: { googleId: profile.id }, update: { name: profile.displayName, email, avatar: profile.photos?.[0]?.value }, create: { googleId: profile.id, name: profile.displayName, email, avatar: profile.photos?.[0]?.value } }); done(null, user); } catch (e) { log.warn({ err: e }, 'Database unavailable; using the Google profile for the development session'); done(null, { id: `google-${profile.id}`, googleId: profile.id, name: profile.displayName, email, avatar: profile.photos?.[0]?.value }); }
}));

const fail = (res: Response, status: number, message: string, code: string) => res.status(status).json({ success: false, message, code });
const ok = (res: Response, data: unknown, status=200) => res.status(status).json({ success: true, data });
const auth = (req: Request, res: Response, next: NextFunction) => req.isAuthenticated() ? next() : fail(res, 401, 'Sign in to continue.', 'UNAUTHENTICATED');
const indexEmail = async (email: any) => { try { await es.index({ index: 'pulse-emails', id: email.id, document: { id: email.id, userId: email.userId, recipient: email.recipient, sender: email.sender, subject: email.subject, body: email.body, status: email.status, scheduledAt: email.scheduledAt, sentAt: email.sentAt } }); } catch (e) { log.warn({ err: e }, 'Elasticsearch indexing unavailable'); } };
const updateEmail = async (email: any) => indexEmail(email);
const notifyRateLimit = async (userId: string, sender: string, hour: string, count: number) => {
 const key = `pulse:slack-notified:${userId}:${sender}:${hour}`; if (!(await redis.set(key, '1', 'EX', 172800, 'NX'))) return;
 try { const connections = await prisma.slackConnection.findMany({ where: { userId } }); const queuedCount=await prisma.email.count({where:{userId,sender,status:'SCHEDULED',scheduledAt:{lt:new Date(new Date(`${hour}:00:00.000Z`).getTime()+3600000)}}});
 for (const c of connections) { const result = await axios.post('https://slack.com/api/chat.postMessage', { channel: c.channelId || c.teamId, text: `Pulse rate limit reached\nSender: ${sender}\nLimit: ${process.env.MAX_EMAILS_PER_HOUR || 100} emails/hour\nWindow: ${hour}\nQueued for next window: ${queuedCount}` }, { headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' } }); if (!result.data.ok) log.warn({ error: result.data.error }, 'Slack notification failed'); }
 } catch (e) { log.warn({ err: e }, 'Slack notification skipped'); }
};
const transport = process.env.ETHEREAL_USER && process.env.ETHEREAL_PASSWORD ? nodemailer.createTransport({ host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email', port: Number(process.env.ETHEREAL_PORT || 587), secure: Number(process.env.ETHEREAL_PORT) === 465, auth: { user: process.env.ETHEREAL_USER, pass: process.env.ETHEREAL_PASSWORD } }) : null;
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 5));
const worker = new Worker('emailQueue', async (job: Job<{emailId:string;hourlyLimit?:number;delayMs?:number}>) => {
 const email = await prisma.email.findUnique({ where: { id: job.data.emailId } }); if (!email || email.status === 'SENT' || email.status === 'FAILED' || email.status === 'PROCESSING') return;
 const claimed = await prisma.email.updateMany({ where: { id: email.id, status: 'SCHEDULED' }, data: { status: 'PROCESSING', error: null } }); if (claimed.count !== 1) return;
 const hourDate = new Date(); const hour = hourDate.toISOString().slice(0,13); const windowEnd = new Date(`${hour}:00:00.000Z`); windowEnd.setUTCHours(windowEnd.getUTCHours()+1);
 const rateKey = `email-rate:${email.sender}:${hour}`;
 const script = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],7200) end; if n<=tonumber(ARGV[1]) then return n else redis.call('DECR',KEYS[1]); return 0 end`;
 const allowed = await redis.eval(script, 1, rateKey, String(Math.min(Number(process.env.MAX_EMAILS_PER_HOUR||100), Number(job.data.hourlyLimit||process.env.MAX_EMAILS_PER_HOUR||100)))) as number;
 if (!allowed) { const moved = await prisma.email.update({ where: { id: email.id }, data: { status: 'SCHEDULED', scheduledAt: windowEnd } }); await queue.add('send-email', { emailId: email.id, hourlyLimit: job.data.hourlyLimit, delayMs: job.data.delayMs }, { jobId: `email-${email.id}-${windowEnd.getTime()}`, delay: Math.max(0, windowEnd.getTime()-Date.now()), removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }); await updateEmail(moved); await notifyRateLimit(email.userId, email.sender, hour, 1); return; }
 const lastKey = `email-last-send:${email.sender}`; const minDelay = Math.max(Number(process.env.MIN_EMAIL_DELAY_MS || 2000), Number(job.data.delayMs || 0)); const wait = Number(await redis.eval(`local now=tonumber(ARGV[1]); local gap=tonumber(ARGV[2]); local last=tonumber(redis.call('GET',KEYS[1]) or '0'); local at=math.max(now,last+gap); redis.call('SET',KEYS[1],at); return at-now`, 1, lastKey, Date.now(), minDelay)); if (wait) await new Promise(resolve => setTimeout(resolve, wait));
 if (!transport) throw new Error('Ethereal SMTP is not configured. Set ETHEREAL_USER and ETHEREAL_PASSWORD.');
 try { const result = await transport.sendMail({ from: email.sender, to: email.recipient, subject: email.subject, text: email.body }); const sent = await prisma.email.update({ where: { id: email.id }, data: { status: 'SENT', sentAt: new Date(), etherealMessageId: result.messageId, previewUrl: nodemailer.getTestMessageUrl(result) || null } }); await updateEmail(sent); }
 catch (e) { const message = e instanceof Error ? e.message : 'Email send failed'; await prisma.email.update({ where: { id: email.id }, data: { error: message } }); throw e; }
}, { connection: redis, concurrency, limiter: undefined });
worker.on('failed', (job, error) => { log.error({ jobId: job?.id, err: error }, 'Email job attempt failed'); if (job?.data?.emailId) { const exhausted=job.attemptsMade >= Number(job.opts.attempts||1); void prisma.email.updateMany({ where:{id:job.data.emailId,status:'PROCESSING'}, data:{status:exhausted?'FAILED':'SCHEDULED',error:error.message} }).then(async()=>{const current=await prisma.email.findUnique({where:{id:job.data.emailId}});if(current)await updateEmail(current);}).catch(()=>{}); } });

app.get('/api/health', (_req,res) => ok(res, { status: 'ok' }));
app.get('/api/auth/google', (req,res,next) => process.env.GOOGLE_CLIENT_ID ? passport.authenticate('google', { scope: ['profile','email'], prompt: 'select_account' })(req,res,next) : fail(res,503,'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.','OAUTH_NOT_CONFIGURED'));
app.get('/api/auth/google/callback', (req,res,next) => {
  res.setTimeout(10000, () => {
    if (!res.headersSent) res.redirect(`${frontend}/?error=oauth_backend`);
  });
  passport.authenticate('google', { failureRedirect: `${frontend}/login?error=oauth` })(req,res, () => req.session.save(err => err ? next(err) : res.redirect(frontend)));
});
app.get('/api/auth/me', (req,res) => req.isAuthenticated() ? ok(res, { user: req.user }) : ok(res, { user: null }));
app.post('/api/auth/logout', (req,res) => req.logout(err => err ? fail(res,500,'Could not log out.','LOGOUT_FAILED') : req.session.destroy(() => ok(res, { loggedOut: true }))));

const scheduleSchema = z.object({ subject:z.string().trim().min(1).max(300), body:z.string().min(1).max(100000), sender:z.string().email(), recipients:z.array(z.string().email()).min(1).max(10000), startTime:z.string().datetime(), delayMs:z.number().int().min(0).max(86400000), hourlyLimit:z.number().int().min(1).max(10000).optional() });
app.post('/api/emails/schedule', auth, async (req,res,next) => { try { const parsed = scheduleSchema.safeParse(req.body); if (!parsed.success) return fail(res,400,parsed.error.issues[0]?.message || 'Invalid request.','VALIDATION_ERROR'); const u=req.user as any, input=parsed.data, start=new Date(input.startTime); if(start.getTime()<Date.now()-60000) return fail(res,400,'Start time must be in the future.','INVALID_START_TIME');
 const unique=[...new Set(input.recipients.map(x=>x.trim().toLowerCase()))]; const created=await prisma.email.createManyAndReturn({data:unique.map((recipient,i)=>({userId:u.id,sender:input.sender,recipient,subject:input.subject,body:input.body,scheduledAt:new Date(start.getTime()+i*input.delayMs)}))});
 for(const email of created){const delay=Math.max(0,email.scheduledAt.getTime()-Date.now()); await queue.add('send-email',{emailId:email.id,hourlyLimit:input.hourlyLimit,delayMs:input.delayMs},{jobId:`email-${email.id}`,delay,removeOnComplete:1000,removeOnFail:5000,attempts:3,backoff:{type:'exponential',delay:5000}}); const saved=await prisma.email.update({where:{id:email.id},data:{bullJobId:`email-${email.id}`}}); void indexEmail(saved);}
 ok(res,{scheduled:created.length,emails:created},201);
 } catch(e){next(e);} });
app.get('/api/emails',auth,async(req,res,next)=>{try{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));const status=typeof req.query.status==='string'&&['SCHEDULED','PROCESSING','SENT','FAILED'].includes(req.query.status)?req.query.status:undefined;const q=typeof req.query.q==='string'?req.query.q.slice(0,200):'';const date=typeof req.query.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)?new Date(`${req.query.date}T00:00:00`):null;const dateField=req.query.view==='SENT'?'sentAt':'scheduledAt';const where:any={userId:(req.user as any).id,...(status?{status}:{}),...(date?{[dateField]:{gte:date,lt:new Date(date.getTime()+86400000)}}:{}),...(q?{OR:[{recipient:{contains:q,mode:'insensitive'}},{subject:{contains:q,mode:'insensitive'}},{sender:{contains:q,mode:'insensitive'}}]}:{})};const [items,total]=await Promise.all([prisma.email.findMany({where,orderBy:{scheduledAt:'desc'},skip:(page-1)*limit,take:limit}),prisma.email.count({where})]);ok(res,{items,total,page,limit,pages:Math.ceil(total/limit)});}catch(e){next(e);}});
app.get('/api/emails/search',auth,async(req,res,next)=>{try{const q=z.string().trim().min(1).max(200).parse(req.query.q);const userId=(req.user as any).id;try{const result=await es.search({index:'pulse-emails',query:{bool:{must:[{multi_match:{query:q,fields:['recipient','sender','subject','body'],type:'best_fields',fuzziness:'AUTO'}}],filter:[{term:{userId}}]}},size:50});return ok(res,{items:result.hits.hits.map((h:any)=>h._source),source:'elasticsearch'});}catch(e){log.warn({err:e},'Elasticsearch search unavailable; using PostgreSQL fallback');const items=await prisma.email.findMany({where:{userId,OR:['recipient','sender','subject','body'].map(k=>({[k]:{contains:q,mode:'insensitive'}}))},take:50,orderBy:{createdAt:'desc'}});ok(res,{items,source:'postgres-fallback'});}}catch(e){next(e);}});
app.get('/api/emails/:id',auth,async(req,res,next)=>{try{const item=await prisma.email.findFirst({where:{id:String(req.params.id),userId:(req.user as any).id}});return item?ok(res,item):fail(res,404,'Email not found.','NOT_FOUND');}catch(e){next(e);}});
app.get('/api/dashboard',auth,async(req,res,next)=>{try{const uid=(req.user as any).id;const now=new Date(),today=new Date(now);today.setHours(0,0,0,0);const [scheduled,sentToday,totals,queueCounts]=await Promise.all([prisma.email.count({where:{userId:uid,status:{in:['SCHEDULED','PROCESSING']}}}),prisma.email.count({where:{userId:uid,status:'SENT',sentAt:{gte:today}}}),prisma.email.groupBy({by:['status'],where:{userId:uid},_count:{_all:true}}),queue.getJobCounts('waiting','delayed','active','completed','failed')]);const senderRow=await prisma.email.findFirst({where:{userId:uid},orderBy:{createdAt:'desc'},select:{sender:true}});const currentSender=senderRow?.sender||(req.user as any).email;const usage=Number(await redis.get(`email-rate:${currentSender}:${now.toISOString().slice(0,13)}`)||0);const activity=[];for(let d=6;d>=0;d--){const day=new Date(today);day.setDate(today.getDate()-d);const next=new Date(day);next.setDate(day.getDate()+1);const [s,f,sch]=await Promise.all([prisma.email.count({where:{userId:uid,status:'SENT',sentAt:{gte:day,lt:next}}}),prisma.email.count({where:{userId:uid,status:'FAILED',updatedAt:{gte:day,lt:next}}}),prisma.email.count({where:{userId:uid,createdAt:{gte:day,lt:next}}})]);activity.push({date:day.toISOString().slice(0,10),sent:s,failed:f,scheduled:sch});}ok(res,{scheduled,sentToday,queueDepth:queueCounts.waiting+queueCounts.delayed,usage,sender:currentSender,limit:Number(process.env.MAX_EMAILS_PER_HOUR||100),queue:queueCounts,activity,hasActivity:activity.some(x=>x.sent+x.failed+x.scheduled>0),worker:'ONLINE',concurrency});}catch(e){log.warn({err:e},'Dashboard metrics unavailable; serving offline fallback values.');const limit=Number(process.env.MAX_EMAILS_PER_HOUR||100);ok(res,{scheduled:0,sentToday:0,queueDepth:0,usage:0,sender:(req.user as any)?.email||'unknown',limit,queue:{waiting:0,delayed:0,active:0,completed:0,failed:0},activity:Array.from({length:7},(_,index)=>{const date=new Date();date.setDate(date.getDate()- (6-index));return {date:date.toISOString().slice(0,10),sent:0,failed:0,scheduled:0};}),hasActivity:false,worker:'DEGRADED',concurrency,fallback:true,message:'Database or Redis is not running; showing offline metrics.'});}});
app.get('/api/queue',async(_req,res)=>{try{const counts=await Promise.race([queue.getJobCounts('waiting','delayed','active','completed','failed'),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Queue metrics timed out')),3000))]);ok(res,{counts,worker:redis.status==='ready'?'ONLINE':'DEGRADED',concurrency,redis:redis.status});}catch(e){log.warn({err:e},'Queue metrics unavailable; serving offline fallback values.');ok(res,{counts:{waiting:0,delayed:0,active:0,completed:0,failed:0},worker:'DEGRADED',concurrency,redis:redis.status,fallback:true,message:'Redis is not running; queue is offline.'});}});
app.get('/api/slack/status',auth,async(req,res,next)=>{try{const c=await prisma.slackConnection.findUnique({where:{userId:(req.user as any).id},select:{teamId:true,teamName:true,channelId:true}});ok(res,{connected:!!c,connection:c});}catch(e){next(e);}});
app.get('/api/slack/connect',auth,(req,res)=>{if(!process.env.SLACK_CLIENT_ID||!process.env.SLACK_CLIENT_SECRET)return fail(res,503,'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.','SLACK_NOT_CONFIGURED');const state=require('crypto').randomBytes(24).toString('hex');(req.session as any).slackState=state;(req.session as any).slackUserId=(req.user as any).id;const params=new URLSearchParams({client_id:process.env.SLACK_CLIENT_ID,scope:'chat:write, incoming-webhook',redirect_uri:process.env.SLACK_CALLBACK_URL||'http://localhost:4000/api/slack/callback',state});res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);});
app.get('/api/slack/callback',async(req,res,next)=>{try{const state=req.query.state,code=req.query.code; if(!state||state!==(req.session as any).slackState||typeof code!=='string')return res.redirect(`${frontend}/integrations?error=slack_state`);delete (req.session as any).slackState;const token=await axios.post('https://slack.com/api/oauth.v2.access',new URLSearchParams({client_id:process.env.SLACK_CLIENT_ID||'',client_secret:process.env.SLACK_CLIENT_SECRET||'',code,redirect_uri:process.env.SLACK_CALLBACK_URL||''}),{headers:{'Content-Type':'application/x-www-form-urlencoded'}});if(!token.data.ok)throw new Error(token.data.error);await prisma.slackConnection.upsert({where:{userId:(req.session as any).slackUserId},update:{teamId:token.data.team.id,teamName:token.data.team.name,channelId:token.data.incoming_webhook?.channel_id||null,accessToken:token.data.access_token},create:{userId:(req.session as any).slackUserId,teamId:token.data.team.id,teamName:token.data.team.name,channelId:token.data.incoming_webhook?.channel_id||null,accessToken:token.data.access_token}});res.redirect(`${frontend}/integrations?slack=connected`);}catch(e){next(e);}});
app.delete('/api/slack/disconnect',auth,async(req,res,next)=>{try{await prisma.slackConnection.deleteMany({where:{userId:(req.user as any).id}});ok(res,{disconnected:true});}catch(e){next(e);}});
const restoreScheduledJobs = async () => {
  try {
    if (redis.status !== 'ready') {
      redis.once('ready', () => void restoreScheduledJobs());
      return;
    }
    const scheduled = await prisma.email.findMany({ where: { status: 'SCHEDULED' }, select: { id: true, bullJobId: true, scheduledAt: true }, take: 10000 });
    let restored = 0;
    for (const email of scheduled) {
      const jobId = email.bullJobId || `email-${email.id}`;
      if (await queue.getJob(jobId)) continue;
      await queue.add('send-email', { emailId: email.id }, { jobId, delay: Math.max(0, email.scheduledAt.getTime() - Date.now()), removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
      if (email.bullJobId !== jobId) await prisma.email.update({ where: { id: email.id }, data: { bullJobId: jobId } });
      restored += 1;
    }
    if (restored) log.info({ restored }, 'Restored scheduled emails into BullMQ');
  } catch (e) {
    log.warn({ err: e }, 'Scheduled job restoration skipped; infrastructure is unavailable');
  }
};
void restoreScheduledJobs();
app.use('/admin/queues',(req,res,next)=>auth(req,res,next));
const board=new ExpressAdapter();board.setBasePath('/admin/queues');createBullBoard({queues:[new BullMQAdapter(queue)],serverAdapter:board});app.use('/admin/queues',board.getRouter());
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{log.error({err},'Request failed');if(err instanceof z.ZodError)return fail(res,400,err.issues[0]?.message||'Invalid request.','VALIDATION_ERROR');if(err instanceof SyntaxError)return fail(res,400,'Malformed JSON request.','BAD_JSON');fail(res,500,'Something went wrong.','INTERNAL_ERROR');});
const preferredPort=Number(process.env.PORT||4000);
const listenWithFallback=(port:number)=>{
  const server=app.listen(port, '0.0.0.0',()=>log.info({port,concurrency},'Pulse API and email worker started'));
  server.on('error',(error: NodeJS.ErrnoException)=>{
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      log.warn({ port, nextPort }, 'Port already in use; retrying on the next available port.');
      listenWithFallback(nextPort);
      return;
    }
    throw error;
  });
};
listenWithFallback(preferredPort);
process.on('SIGTERM',async()=>{await worker.close();await queue.close();await redis.quit();await prisma.$disconnect();process.exit(0);});


