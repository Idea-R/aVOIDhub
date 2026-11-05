import {PROTOCOL,CONTENT_HASH}from '@avoid/boomerangavoid-protocol'
export async function getRoomTicketAudience(serverUrl:string,baseAudience:string,development=false):Promise<string>{
 const url=new URL('/health',serverUrl)
 if(url.username||url.password||(url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw new Error('invalid_room_service')
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)})
 if(!response.ok)throw new Error('room_service_unready')
 const health=await response.json()
 if(health.protocol!==PROTOCOL||health.contentHash!==CONTENT_HASH||typeof health.ticketEpoch!=='string'||!/^[a-f0-9]{32}$/.test(health.ticketEpoch))throw new Error('room_version_mismatch')
 return `${baseAudience}:${health.ticketEpoch}`
}
