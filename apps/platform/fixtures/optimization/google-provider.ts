// Deliberately uses only the local synthetic API, never the configured URL/key.
export async function isGoogleSignInAvailable() {
  return (await (await fetch('/__fixture/auth-settings')).json()).enabled === true
}
