export type GoogleAuthEnvironment = Record<string, string | undefined>;

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < value.length; index += 1) {
    binary += String.fromCharCode(value[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

export function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function privateKeyBytes(value: string): Uint8Array {
  const encoded = normalizePrivateKey(value)
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  if (!encoded) throw new Error("invalid private key");
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

export async function createGoogleServiceAccountAccessToken(
  environment: GoogleAuthEnvironment,
  scope: string,
): Promise<string> {
  if (typeof window !== "undefined") {
    throw new Error("La autenticación de Google solo puede ejecutarse en servidor.");
  }
  const email = environment.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = environment.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawPrivateKey) {
    throw new Error("Faltan las credenciales de la cuenta de servicio de Google.");
  }

  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedClaim = base64Url(JSON.stringify({
    iss: email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${encodedHeader}.${encodedClaim}`;

  let signature: string;
  try {
    const signingKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes(rawPrivateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      signingKey,
      new TextEncoder().encode(unsignedToken),
    );
    signature = bytesToBase64Url(new Uint8Array(signed));
  } catch {
    throw new Error("No se pudo firmar la credencial de servicio de Google.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Autenticación de Google fallida con estado HTTP ${response.status}.`);
  }
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("La autenticación de Google no devolvió un access token.");
  }
  return payload.access_token;
}
