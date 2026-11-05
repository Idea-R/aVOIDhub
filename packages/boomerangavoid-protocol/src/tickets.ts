// Server-only. Never import this subpath into the browser bundle.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export interface RoomTicket { v:1; userId:string; name:string; room:string; audience:string; seats:number; issued:number; expires:number; nonce:string }
export function mintTicket(data:Omit<RoomTicket,'v'|'issued'|'expires'|'nonce'>,secret:string,now=Date.now()):string {
 if(secret.length<32)throw new Error('ticket_secret_unconfigured');
 const ticket:RoomTicket={...data,v:1,issued:now,expires:now+60000,nonce:randomBytes(24).toString('base64url')};
 const body=Buffer.from(JSON.stringify(ticket)).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export class TicketVerifier {
 private used=new Map<string,number>();
 constructor(private secret:string,private audience:string){}
 verify(token:unknown,room:string,now=Date.now(),consume=true):RoomTicket|null {
  if(this.secret.length<32||typeof token!=='string'||token.length>2048)return null;
  const [body,signature,...rest]=token.split('.');if(!body||!signature||rest.length)return null;
  const expected=createHmac('sha256',this.secret).update(body).digest();const actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  let t:RoomTicket;try{t=JSON.parse(Buffer.from(body,'base64url').toString());}catch{return null;}
  if(!t||t.v!==1||typeof t.nonce!=='string'||t.nonce.length<16||typeof t.userId!=='string'||!t.userId||typeof t.name!=='string'||t.name.length>24||t.room!==room||t.audience!==this.audience||!Number.isSafeInteger(t.seats)||t.seats<1||t.seats>6||!Number.isSafeInteger(t.issued)||!Number.isSafeInteger(t.expires)||t.expires<=now||t.issued>now+5000||t.expires-t.issued!==60000)return null;
  for(const [key,expires]of this.used)if(expires<=now)this.used.delete(key);
  if(this.used.has(t.nonce)||this.used.size>=20000)return null;
  if(consume)this.used.set(t.nonce,t.expires);return t;
 }
}
