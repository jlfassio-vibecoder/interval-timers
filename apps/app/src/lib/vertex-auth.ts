/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vertex AI auth: supports GOOGLE_APPLICATION_CREDENTIALS_JSON (base64 or raw JSON)
 * for serverless/containerized deployments without file-based ADC.
 */

export interface VertexAuthOptions {
  projectId: string;
  region?: string;
  scope?: string;
}

/**
 * Get an access token for Vertex AI. Uses GOOGLE_APPLICATION_CREDENTIALS_JSON
 * when set (base64 or raw JSON string), otherwise falls back to Application
 * Default Credentials (gcloud auth or GOOGLE_APPLICATION_CREDENTIALS file path).
 */
export async function getVertexAccessToken(
  options: VertexAuthOptions
): Promise<string | null> {
  const credentialsJson =
    typeof process !== 'undefined' ? process.env?.GOOGLE_APPLICATION_CREDENTIALS_JSON : undefined;

  const { GoogleAuth } = await import('google-auth-library');
  const scope = options.scope ?? 'https://www.googleapis.com/auth/cloud-platform';

  let auth;
  if (credentialsJson?.trim()) {
    try {
      const credentials = parseCredentialsJson(credentialsJson.trim());
      auth = new GoogleAuth({
        credentials,
        scopes: [scope],
        projectId: options.projectId,
      });
    } catch (err) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        console.warn('[vertex-auth] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', err);
      }
      auth = new GoogleAuth({
        scopes: [scope],
        projectId: options.projectId,
      });
    }
  } else {
    auth = new GoogleAuth({
      scopes: [scope],
      projectId: options.projectId,
    });
  }

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token ?? null;
}

function parseCredentialsJson(value: string): Record<string, unknown> {
  let decoded: string;
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0) {
    try {
      decoded = Buffer.from(value, 'base64').toString('utf-8');
    } catch {
      decoded = value;
    }
  } else {
    decoded = value;
  }
  return JSON.parse(decoded) as Record<string, unknown>;
}
