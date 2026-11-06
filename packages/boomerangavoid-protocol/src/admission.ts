// Server-only policy. Never import this subpath into a browser bundle.
import {createHash, createHmac} from 'node:crypto';

import {PILOT_ORIGIN,PRODUCTION_ORIGIN,PRODUCTION_AUTH_URL,PILOT_AUDIENCE,isStagingAuthUrl} from './admission-config';
export {PILOT_ORIGIN,PRODUCTION_ORIGIN,PRODUCTION_AUTH_URL,PILOT_AUDIENCE} from './admission-config';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Environment = Readonly<Record<string, string | undefined>>;
export type AdmissionPolicy = Readonly<{mode:'closed'} | {
  mode:'pilot'|'production'|'development'; origin:string; authUrl:string;
  audience:string; userIds:readonly string[]; fingerprint:string;
}>;
const closed:AdmissionPolicy = Object.freeze({mode:'closed'});
function origin(value:string|undefined, loopback=false):string|null {
  if (!value || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (value !== url.origin || url.username || url.password) return null;
    if (loopback) return url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) ? value : null;
    return url.protocol==='https:' && !url.port ? value : null;
  } catch { return null; }
}
export function readAdmissionPolicy(env:Environment, side:'platform'|'room'):AdmissionPolicy {
  // Preserve explicitly opted-in, loopback-only local guest reviews. No hosted fallback.
  const mode = env.BOOMERANGAVOID_ACCESS_MODE ?? (side==='room' && env.NODE_ENV!=='production' && env.BAV_ALLOW_GUESTS==='1' ? 'development' : 'closed');
  const appOrigin = env.BOOMERANGAVOID_APP_ORIGIN ?? (mode==='development' ? 'http://127.0.0.1:5177' : '');
  const authUrl = env.BOOMERANGAVOID_AUTH_URL ?? '';
  const audience = env.BOOMERANGAVOID_TICKET_AUDIENCE ?? (mode==='development' ? 'boomerangavoid' : '');
  let userIds:string[] = [];
  if (mode==='pilot') {
    if (appOrigin!==PILOT_ORIGIN || audience!==PILOT_AUDIENCE || !isStagingAuthUrl(authUrl)) return closed;
    const raw = env.BOOMERANGAVOID_PILOT_USER_IDS;
    if (!raw || raw.length>2048) return closed;
    userIds = raw.split(',').map(id=>id.trim().toLowerCase());
    if (!userIds.length || userIds.length>32 || userIds.some(id=>!uuid.test(id)) || new Set(userIds).size!==userIds.length) return closed;
    userIds.sort();
  } else if (mode==='production') {
    if (appOrigin!==PRODUCTION_ORIGIN || authUrl!==PRODUCTION_AUTH_URL || audience!=='boomerangavoid' || env.BOOMERANGAVOID_PILOT_USER_IDS!==undefined) return closed;
  } else if (mode==='development') {
    if (env.NODE_ENV==='production' || !origin(appOrigin,true) || !['127.0.0.1','localhost'].includes(env.BAV_BIND??'127.0.0.1') || env.BOOMERANGAVOID_PILOT_USER_IDS!==undefined) return closed;
    if (authUrl && (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(authUrl) || authUrl===PRODUCTION_AUTH_URL)) return closed;
    if (!/^[a-z0-9-]{1,80}$/.test(audience)) return closed;
  } else return closed;
  if (side==='platform' && (env.NEXT_PUBLIC_SITE_URL!==appOrigin || env.NEXT_PUBLIC_SUPABASE_URL!==authUrl || (mode==='development'&&!isStagingAuthUrl(authUrl)))) return closed;
  if (side==='room') {
    if(mode==='pilot'&&!['1','2'].includes(env.BAV_MAX_ROOMS??''))return closed;
    const origins = env.BAV_ALLOWED_ORIGINS?.split(',').map(s=>s.trim());
    if (mode!=='development' && (origins?.length!==1 || origins[0]!==appOrigin)) return closed;
    if (mode==='development' && origins?.some(s=>!origin(s,true))) return closed;
    const receipt = env.BOOMERANGAVOID_RECEIPT_URL;
    if (receipt) {
      try {
        const u = new URL(receipt);
        if (u.username || u.password || u.search || u.hash || u.pathname.replace(/\/$/,'')!=='/api/v1/boomerangavoid/receipts') return closed;
        if (mode==='development' ? !origin(u.origin,true) : u.origin!==appOrigin) return closed;
      } catch { return closed; }
    }
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([1,mode,appOrigin,authUrl,audience,userIds])).digest('hex');
  return Object.freeze({mode,origin:appOrigin,authUrl,audience,userIds:Object.freeze(userIds),fingerprint});
}
export function admissionStatus(policy:AdmissionPolicy, request:Request):403|503|null {
  if (policy.mode==='closed') return 503;
  if (new URL(request.url).origin!==policy.origin) return 403;
  const supplied = request.headers.get('origin');
  return supplied && supplied!==policy.origin ? 403 : null;
}
export function admissionAllowsUser(policy:AdmissionPolicy, userId:string):boolean {
  if (policy.mode==='closed') return false;
  if (policy.mode==='development') return typeof userId==='string' && userId.length>0;
  const normalized=userId.toLowerCase();
  return uuid.test(normalized) && (policy.mode==='production' || policy.userIds.includes(normalized));
}
export function admissionSecret(secret:string|undefined, policy:AdmissionPolicy):string|undefined {
  if (policy.mode==='closed' || !secret || Buffer.byteLength(secret,'utf8')<32) return undefined;
  // Development fixtures retain the existing local wire contract only on loopback.
  return policy.mode==='development' ? secret : createHmac('sha256',secret).update('boomerangavoid/admission/v1/'+policy.fingerprint).digest('hex');
}
export function admissionAudience(policy:AdmissionPolicy, epoch:string):string {
  if (policy.mode==='closed' || !/^[a-f0-9]{32}$/.test(epoch)) throw new Error('admission_unavailable');
  return policy.mode==='development' ? policy.audience+':'+epoch : policy.audience+':'+policy.fingerprint+':'+epoch;
}
