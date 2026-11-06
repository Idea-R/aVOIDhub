import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAdmissionPolicy,admissionStatus,admissionAllowsUser,admissionSecret,admissionAudience,PILOT_ORIGIN,PRODUCTION_ORIGIN,PRODUCTION_AUTH_URL,PILOT_AUDIENCE} from '../src/admission';
import {mintTicket,TicketVerifier} from '../src/tickets';
import {signReceiptEnvelope,verifyReceiptEnvelope} from '../src/receipts';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const auth='https://abcdefghijklmnopqrst.supabase.co',baseSecret='public-test-fixture-not-an-application-credential';
const env={NODE_ENV:'production',BOOMERANGAVOID_ACCESS_MODE:'pilot',BOOMERANGAVOID_APP_ORIGIN:PILOT_ORIGIN,BOOMERANGAVOID_AUTH_URL:auth,BOOMERANGAVOID_TICKET_AUDIENCE:PILOT_AUDIENCE,BOOMERANGAVOID_PILOT_USER_IDS:alice+','+bob,NEXT_PUBLIC_SITE_URL:PILOT_ORIGIN,NEXT_PUBLIC_SUPABASE_URL:auth,BAV_ALLOWED_ORIGINS:PILOT_ORIGIN,BAV_MAX_ROOMS:'2'};
test('pilot allowlist is bounded, canonical and never inferred from metadata',()=>{
 const p=readAdmissionPolicy(env,'platform');assert.equal(p.mode,'pilot');assert.equal(admissionAllowsUser(p,alice.toUpperCase()),true);assert.equal(admissionAllowsUser(p,'33333333-3333-4333-8333-333333333333'),false);
 const q=readAdmissionPolicy({...env,BOOMERANGAVOID_PILOT_USER_IDS:` ${bob.toUpperCase()}, ${alice} `},'room');assert.deepEqual(q,p);
 for(const ids of [undefined,'',' ',alice+',',alice+','+alice,'*','not-a-uuid',Array(33).fill(alice).join(','),'x'.repeat(2049)])assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_PILOT_USER_IDS:ids},'platform').mode,'closed');
});
test('unset, empty, unknown, and non-pilot modes never open a hosted pilot',()=>{
 for(const mode of [undefined,'','PILOT','authenticated','development','production','closed'])assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_ACCESS_MODE:mode},'room').mode,'closed');
 assert.equal(readAdmissionPolicy({},'platform').mode,'closed');assert.equal(readAdmissionPolicy({NODE_ENV:'production',BAV_ALLOW_GUESTS:'1'},'room').mode,'closed');
});
test('pilot requires the exact preview origin, staging project and matching effective platform config',()=>{
 for(const appOrigin of [PRODUCTION_ORIGIN,PILOT_ORIGIN+'/',PILOT_ORIGIN+':443',PILOT_ORIGIN.replace('64--','65--'),PILOT_ORIGIN.replace('https:','http:'),'https://avoidgame.io@evil.test',PILOT_ORIGIN+'.evil.test'])assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_APP_ORIGIN:appOrigin},'platform').mode,'closed');
 for(const authUrl of [PRODUCTION_AUTH_URL,PRODUCTION_AUTH_URL+'/',PRODUCTION_AUTH_URL+':443',PRODUCTION_AUTH_URL.toUpperCase(),auth+'/',auth+'?x=1','http://abcdefghijklmnopqrst.supabase.co'])assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_AUTH_URL:authUrl,NEXT_PUBLIC_SUPABASE_URL:authUrl},'platform').mode,'closed');
 assert.equal(readAdmissionPolicy({...env,NEXT_PUBLIC_SUPABASE_URL:PRODUCTION_AUTH_URL},'platform').mode,'closed');
 assert.equal(readAdmissionPolicy({...env,NEXT_PUBLIC_SITE_URL:PRODUCTION_ORIGIN},'platform').mode,'closed');
 assert.equal(readAdmissionPolicy({...env,BAV_ALLOWED_ORIGINS:PILOT_ORIGIN+','+PRODUCTION_ORIGIN},'room').mode,'closed');
 assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_TICKET_AUDIENCE:'boomerangavoid'},'room').mode,'closed');
 for(const limit of [undefined,'','0','3','NaN','2.0'])assert.equal(readAdmissionPolicy({...env,BAV_MAX_ROOMS:limit},'room').mode,'closed');
});
test('ordinary same-origin GET works without Origin; production/lookalike/forwarded identities cannot override request URL',()=>{
 const p=readAdmissionPolicy(env,'platform');assert.equal(admissionStatus(p,new Request(PILOT_ORIGIN+'/api')),null);
 assert.equal(admissionStatus(p,new Request(PILOT_ORIGIN+'/api',{headers:{Origin:PRODUCTION_ORIGIN}})),403);
 assert.equal(admissionStatus(p,new Request(PRODUCTION_ORIGIN+'/api',{headers:{Origin:PILOT_ORIGIN,'X-Forwarded-Host':new URL(PILOT_ORIGIN).hostname}})),403);
 assert.equal(admissionStatus({mode:'closed'},new Request(PILOT_ORIGIN)),503);
});
test('production policy cannot inherit pilot config or staging identity',()=>{
 const prod={...env,BOOMERANGAVOID_ACCESS_MODE:'production',BOOMERANGAVOID_APP_ORIGIN:PRODUCTION_ORIGIN,BOOMERANGAVOID_AUTH_URL:PRODUCTION_AUTH_URL,BOOMERANGAVOID_TICKET_AUDIENCE:'boomerangavoid',BOOMERANGAVOID_PILOT_USER_IDS:undefined,NEXT_PUBLIC_SITE_URL:PRODUCTION_ORIGIN,NEXT_PUBLIC_SUPABASE_URL:PRODUCTION_AUTH_URL,BAV_ALLOWED_ORIGINS:PRODUCTION_ORIGIN};
 assert.equal(readAdmissionPolicy(prod,'platform').mode,'production');assert.equal(readAdmissionPolicy({...prod,BOOMERANGAVOID_PILOT_USER_IDS:''},'room').mode,'closed');
 assert.equal(readAdmissionPolicy({...prod,BOOMERANGAVOID_AUTH_URL:auth},'room').mode,'closed');
 assert.equal(admissionStatus(readAdmissionPolicy(prod,'platform'),new Request(PILOT_ORIGIN)),403);
});
test('development conveniences require nonproduction and loopback; explicit pilot never enables guests',()=>{
 const dev={NODE_ENV:'test',BOOMERANGAVOID_ACCESS_MODE:'development',BOOMERANGAVOID_APP_ORIGIN:'http://127.0.0.1:5177'};
 assert.equal(readAdmissionPolicy(dev,'room').mode,'development');
 for(const override of [{NODE_ENV:'production'},{BAV_BIND:'0.0.0.0'},{BOOMERANGAVOID_APP_ORIGIN:PILOT_ORIGIN},{BOOMERANGAVOID_AUTH_URL:PRODUCTION_AUTH_URL},{BAV_ALLOWED_ORIGINS:PILOT_ORIGIN}])assert.equal(readAdmissionPolicy({...dev,...override},'room').mode,'closed');
 assert.equal(readAdmissionPolicy({...env,NODE_ENV:'development',BAV_ALLOW_GUESTS:'1'},'room').mode,'pilot');
 const platform={...dev,BOOMERANGAVOID_AUTH_URL:auth,NEXT_PUBLIC_SUPABASE_URL:auth,NEXT_PUBLIC_SITE_URL:dev.BOOMERANGAVOID_APP_ORIGIN};
 assert.equal(readAdmissionPolicy(platform,'platform').mode,'development');
 assert.equal(readAdmissionPolicy({...platform,NEXT_PUBLIC_SUPABASE_URL:PRODUCTION_AUTH_URL},'platform').mode,'closed');
 assert.equal(readAdmissionPolicy({...platform,BOOMERANGAVOID_AUTH_URL:undefined,NEXT_PUBLIC_SUPABASE_URL:undefined},'platform').mode,'closed');
});
test('pilot receipt destinations reject production, other previews, credentials and redirects at config time',()=>{
 const endpoint=PILOT_ORIGIN+'/api/v1/boomerangavoid/receipts';
 assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_RECEIPT_URL:endpoint},'room').mode,'pilot');
 for(const url of [endpoint.replace('64--','65--'),endpoint.replace(PILOT_ORIGIN,PRODUCTION_ORIGIN),endpoint+'?forward=1',endpoint+'#x',endpoint.replace('https://','https://user:pass@'),PILOT_ORIGIN+'/wrong'])assert.equal(readAdmissionPolicy({...env,BOOMERANGAVOID_RECEIPT_URL:url},'room').mode,'closed');
});
test('policy changes revoke old audience/key material even if the operator reuses the same base secret',()=>{
 const a=readAdmissionPolicy(env,'room'),epoch='a'.repeat(32),key=admissionSecret(baseSecret,a)!;
 const token=mintTicket({userId:alice,name:'Fixture',seats:1,room:'create',audience:admissionAudience(a,epoch)},key,1000);
 assert.ok(new TicketVerifier(key,admissionAudience(a,epoch)).verify(token,'create',1001));
 for(const overrides of [{BOOMERANGAVOID_PILOT_USER_IDS:alice},{BOOMERANGAVOID_AUTH_URL:'https://tsrqponmlkjihgfedcba.supabase.co'},{BOOMERANGAVOID_ACCESS_MODE:'production',BOOMERANGAVOID_APP_ORIGIN:PRODUCTION_ORIGIN,BOOMERANGAVOID_AUTH_URL:PRODUCTION_AUTH_URL,BOOMERANGAVOID_TICKET_AUDIENCE:'boomerangavoid',BOOMERANGAVOID_PILOT_USER_IDS:undefined,BAV_ALLOWED_ORIGINS:PRODUCTION_ORIGIN}]){
  const b=readAdmissionPolicy({...env,...overrides},'room');assert.notEqual(admissionSecret(baseSecret,b),key);assert.notEqual(admissionAudience(a,epoch),admissionAudience(b,epoch));assert.equal(new TicketVerifier(admissionSecret(baseSecret,b)!,admissionAudience(b,epoch)).verify(token,'create',1001),null);
  // Envelope validation fails on the MAC before parsing the receipt payload.
  assert.equal(verifyReceiptEnvelope(new TextEncoder().encode('{}'),signReceiptEnvelope('{}',key,1000),admissionSecret(baseSecret,b)!,1001),null);
 }
 assert.equal(new TicketVerifier(baseSecret,admissionAudience(a,epoch)).verify(token,'create',1001),null);
 assert.equal(admissionSecret(baseSecret,{mode:'closed'}),undefined);assert.equal(admissionSecret('short',a),undefined);
});
