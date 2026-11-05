import { randomBytes } from 'node:crypto';
export const runtimeStatus={draining:false,ticketEpoch:randomBytes(16).toString('hex')};
