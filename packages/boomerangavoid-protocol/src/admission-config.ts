// Public configuration checks only; no account lists, credentials or Node imports.
export const PILOT_ORIGIN='https://deploy-preview-64--coruscating-squirrel-a47ad9.netlify.app';
export const PRODUCTION_ORIGIN='https://avoidgame.io';
export const PRODUCTION_AUTH_URL='https://jyuafqzjrzifqbgcqbnt.supabase.co';
export const PILOT_AUDIENCE='boomerangavoid-preview64';
export function isStagingAuthUrl(value:string):boolean {
  return /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value)&&value!==PRODUCTION_AUTH_URL;
}
