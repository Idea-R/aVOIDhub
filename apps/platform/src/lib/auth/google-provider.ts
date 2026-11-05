export async function isGoogleSignInAvailable(url:string,key:string):Promise<boolean> {
  const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(8000),cache:'no-store'})
  if(!response.ok)throw new Error('provider_check_failed')
  const settings=await response.json()
  return settings?.external?.google===true
}
