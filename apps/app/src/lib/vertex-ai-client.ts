/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Vertex AI / OpenAPI chat client for DeepSeek v3.2.
 * Used by Program Factory, Challenge Factory, and Workout Factory (and all /api/ai/* routes).
 *
 * Env (server / API routes only):
 * - GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT_ID (or project_id inside the service account JSON)
 * - GOOGLE_LOCATION or GOOGLE_CLOUD_LOCATION (defaults to "global" if unset; many Vertex endpoints need us-central1)
 * - Credentials (first match wins):
 *   1. GOOGLE_APPLICATION_CREDENTIALS_JSON — single-line JSON (escape inner quotes or use base64/file below)
 *   2. GOOGLE_APPLICATION_CREDENTIALS_BASE64 — base64(utf8 JSON) — reliable on Vercel
 *   3. GOOGLE_APPLICATION_CREDENTIALS — absolute path to the service account .json file (best for local dev)
 *   4. Application Default Credentials (gcloud auth application-default login) if none of the above
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const MAX_ERROR_LOG_LENGTH = 500;

/** API routes can run before Astro's config-time dotenv is visible on `process.env`; reload from known .env paths once. */
const vertexLibDir = dirname(fileURLToPath(import.meta.url));
const vertexAppRoot = resolve(vertexLibDir, '../..');
const vertexMonorepoRoot = resolve(vertexLibDir, '../../../..');
let vertexEnvHydrated = false;

function hydrateVertexEnvFromDisk(): void {
  if (vertexEnvHydrated || typeof process === 'undefined') return;
  vertexEnvHydrated = true;
  const paths = [
    resolve(vertexMonorepoRoot, '.env'),
    resolve(vertexMonorepoRoot, '.env.local'),
    resolve(vertexAppRoot, '.env'),
    resolve(vertexAppRoot, '.env.local'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    // Do not override keys already set by the host (Vercel, CI, shell) so runtime env wins over .env on disk.
    loadDotenv({ path: p, override: false });
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Extract a plain string from getVertexAICredentials error Response for throwing. */
async function credentialErrorToMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j && typeof j.error === 'string' && j.error.trim()) return j.error.trim();
  } catch {
    // use raw text below
  }
  return text.trim() || 'Vertex AI credentials failed';
}

export type VertexAICredentials =
  | { projectId: string; region: string; accessToken: string }
  | { error: Response };

function readProcessEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** If inline env looks like base64 (not leading `{`), decode to UTF-8 JSON. */
function tryDecodeJsonEnvAsBase64(s: string): string | undefined {
  const t = s.trim();
  if (t.startsWith('{')) return undefined;
  try {
    const decoded = stripBom(Buffer.from(t, 'base64').toString('utf8'));
    return decoded.trim().startsWith('{') ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/** Load raw service account JSON from env JSON string, base64, or file path. */
function resolveServiceAccountJsonRaw(logPrefix: string): string | undefined {
  const inline = readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON');
  if (inline) {
    const bom = stripBom(inline);
    const fromB64 = tryDecodeJsonEnvAsBase64(bom);
    if (fromB64) {
      if (import.meta.env?.DEV) {
        console.warn(
          `${logPrefix} GOOGLE_APPLICATION_CREDENTIALS_JSON is base64-encoded; decoded OK. Use raw JSON in this var, or set GOOGLE_APPLICATION_CREDENTIALS_BASE64 instead.`
        );
      }
      return fromB64;
    }
    return bom;
  }

  const b64 = readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS_BASE64');
  if (b64) {
    try {
      return stripBom(Buffer.from(b64, 'base64').toString('utf8'));
    } catch (e) {
      console.error(`${logPrefix} GOOGLE_APPLICATION_CREDENTIALS_BASE64 decode failed:`, e);
      return undefined;
    }
  }

  const filePath = readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (filePath) {
    if (!existsSync(filePath)) {
      console.error(`${logPrefix} GOOGLE_APPLICATION_CREDENTIALS file not found:`, filePath);
      return undefined;
    }
    try {
      return stripBom(readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`${logPrefix} Failed to read GOOGLE_APPLICATION_CREDENTIALS:`, e);
      return undefined;
    }
  }
  return undefined;
}

function hasAnyServiceAccountEnv(): boolean {
  return !!(
    readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON') ||
    readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS_BASE64') ||
    readProcessEnv('GOOGLE_APPLICATION_CREDENTIALS')
  );
}

/**
 * GCP project ID for API routes that still duplicate Vertex auth (prefer migrating to
 * `getVertexAICredentials`). Order matches original `getVertexAICredentials`: **import.meta first**
 * (Astro bakes `PUBLIC_*` at build), then `process.env` (Vercel runtime). Putting `process.env`
 * first broke production when only `PUBLIC_FIREBASE_PROJECT_ID` was baked into `import.meta` and
 * not present on `process.env` at runtime.
 */
export function resolveGoogleProjectId(): string | undefined {
  hydrateVertexEnvFromDisk();
  return (
    import.meta.env?.GOOGLE_PROJECT_ID ||
    import.meta.env?.PUBLIC_FIREBASE_PROJECT_ID ||
    readProcessEnv('GOOGLE_PROJECT_ID') ||
    readProcessEnv('GOOGLE_CLOUD_PROJECT_ID') ||
    readProcessEnv('PUBLIC_FIREBASE_PROJECT_ID')
  );
}

/** Vertex / Gemini region (e.g. us-central1, global). */
export function resolveGoogleLocation(): string {
  hydrateVertexEnvFromDisk();
  return (
    import.meta.env?.GOOGLE_LOCATION ||
    readProcessEnv('GOOGLE_LOCATION') ||
    readProcessEnv('GOOGLE_CLOUD_LOCATION') ||
    readProcessEnv('VERTEX_LOCATION') ||
    'global'
  );
}

/**
 * Resolves project ID, region, and access token for Vertex AI.
 * Use in API routes: if ('error' in creds) return creds.error; then use creds.projectId, etc.
 *
 * @param logPrefix - Optional prefix for auth error logs (e.g. '[generate-scaffold]').
 */
export async function getVertexAICredentials(
  logPrefix = '[vertex-ai]'
): Promise<VertexAICredentials> {
  hydrateVertexEnvFromDisk();

  const envProjectId = resolveGoogleProjectId();

  const credentialsJsonRaw = resolveServiceAccountJsonRaw(logPrefix);

  const region = resolveGoogleLocation();

  try {
    let projectId = envProjectId ?? undefined;
    let parsedKey: { client_email: string; private_key: string; project_id?: string } | undefined;
    if (credentialsJsonRaw) {
      parsedKey = parseServiceAccountJson(credentialsJsonRaw, logPrefix);
      if (typeof parsedKey.project_id === 'string' && parsedKey.project_id) {
        projectId = parsedKey.project_id;
      }
    }
    if (!projectId) {
      return {
        error: new Response(
          JSON.stringify({
            error:
              'GOOGLE_PROJECT_ID or GOOGLE_CLOUD_PROJECT_ID not set. Add one to .env / Vercel env for AI generation.',
          }),
          { status: 500, headers: JSON_HEADERS }
        ),
      };
    }

    const { GoogleAuth } = await import('google-auth-library');
    const auth = parsedKey
      ? new GoogleAuth({
          credentials: { client_email: parsedKey.client_email, private_key: parsedKey.private_key },
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          projectId,
        })
      : new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          projectId,
        });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) throw new Error('Failed to get access token');
    return { projectId, region, accessToken: tokenResponse.token };
  } catch (err) {
    console.error(`${logPrefix} Auth error:`, err);
    const isVercel = readProcessEnv('VERCEL') === '1';
    const hasSa = hasAnyServiceAccountEnv();
    const errMsg = err instanceof Error ? err.message : String(err);
    if (import.meta.env?.DEV) {
      console.error(`${logPrefix} Vertex auth detail:`, errMsg);
    }
    const hint = hasSa
      ? 'Check service account JSON (valid JSON, unexpired key, private_key newlines). Or set GOOGLE_APPLICATION_CREDENTIALS to a .json file path locally. Ensure roles/aiplatform.user on the GCP project.'
      : isVercel
        ? 'AI generation on Vercel requires GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS_BASE64 (service account with Vertex AI User).'
        : 'Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path, or GOOGLE_APPLICATION_CREDENTIALS_JSON / BASE64, or run: gcloud auth application-default login';
    const devSuffix = import.meta.env?.DEV ? ` [${errMsg}]` : '';
    return {
      error: new Response(
        JSON.stringify({
          error: `Authentication failed. ${hint}${devSuffix}`,
        }),
        { status: 500, headers: JSON_HEADERS }
      ),
    };
  }
}

function normalizePemPrivateKey(pem: string): string {
  let p = pem.replace(/\r\n/g, '\n');
  p = p.replace(/\\n/g, '\n').trim();
  if (p.includes('BEGIN PRIVATE KEY') && !/\n/.test(p.slice(0, 80))) {
    p = p
      .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
  }
  return p;
}

function parseServiceAccountJson(
  json: string,
  logPrefix: string
): { client_email: string; private_key: string; project_id?: string } {
  try {
    const trimmed = json.trim();
    const key = JSON.parse(trimmed) as Record<string, unknown>;
    if (!key || typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
      throw new Error('Missing client_email or private_key in service account JSON');
    }
    const privateKey = normalizePemPrivateKey(key.private_key);
    const project_id =
      typeof key.project_id === 'string' && key.project_id ? key.project_id : undefined;
    return { client_email: key.client_email, private_key: privateKey, project_id };
  } catch (e) {
    console.error(`${logPrefix} Invalid service account JSON:`, e);
    throw e;
  }
}

export interface VertexAICallOptions {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  projectId: string;
  region: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Optional prefix for retry log messages (e.g. '[generate-program-chain]'). */
  logPrefix?: string;
}

/**
 * Calls Vertex AI OpenAPI chat endpoint with timeout and retry.
 * Retries on 429 (rate limit) and 503 (service unavailable).
 */
export async function callVertexAI(options: VertexAICallOptions): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    accessToken,
    projectId,
    region,
    temperature = 0.5,
    maxTokens = 4096,
    timeoutMs = 180000,
    logPrefix = '[vertex-ai]',
  } = options;

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;

  let response: Response | undefined;
  let retries = 0;
  const maxRetries = 3;
  const baseDelay = 2000;

  while (retries <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-ai/deepseek-v3.2-maas',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) break;

    if (response.status === 403) {
      const errorText = await response.text();
      let hint =
        'The service account or user does not have permission to call Vertex AI in this project. ';
      try {
        const errJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errJson?.error?.message?.includes('aiplatform.endpoints.predict')) {
          hint +=
            'Grant the service account (from GOOGLE_APPLICATION_CREDENTIALS_JSON) the role "Vertex AI User" (roles/aiplatform.user) on the GCP project matching GOOGLE_PROJECT_ID. Or set GOOGLE_PROJECT_ID to the project where that service account already has Vertex AI access.';
        }
      } catch {
        // use default hint
      }
      throw new Error(`AI API error: 403 - ${hint}`);
    }

    const isRetryable = response.status === 429 || response.status === 503;
    const totalAttempts = maxRetries + 1;
    if (isRetryable && retries < maxRetries) {
      const delay = baseDelay * Math.pow(2, retries);
      const reason = response.status === 429 ? 'Rate limited' : 'Service unavailable';
      console.warn(
        `${logPrefix} ${reason} (${response.status}). Attempt ${retries + 1}/${totalAttempts} failed; retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
      continue;
    }
    if (isRetryable && retries >= maxRetries) {
      console.warn(`${logPrefix} Attempt ${totalAttempts}/${totalAttempts} failed (${response.status}).`);
    }

    const errorText = await response.text();
    throw new Error(
      `AI API error: ${response.status} - ${errorText.substring(0, MAX_ERROR_LOG_LENGTH)}`
    );
  }

  if (!response || !response.ok) {
    throw new Error('Failed to get AI response after retries');
  }

  const rawBody = await response.text();
  let apiData: unknown;
  try {
    apiData = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `AI API returned non-JSON (e.g. upstream timeout or gateway error). Body: ${rawBody.substring(0, MAX_ERROR_LOG_LENGTH)}`
    );
  }
  if (apiData && typeof apiData === 'object' && 'choices' in apiData) {
    const choices = (apiData as { choices?: Array<{ message?: { content?: string } }> }).choices;
    if (choices?.[0]?.message?.content) {
      return choices[0].message.content;
    }
  }
  if (apiData && typeof apiData === 'object' && 'content' in apiData && typeof (apiData as { content: string }).content === 'string') {
    return (apiData as { content: string }).content;
  }
  throw new Error(`Unexpected API response format. Body: ${rawBody.substring(0, MAX_ERROR_LOG_LENGTH)}`);
}

/**
 * Vertex AI Gemini generateContent (same credentials as Program/Challenge/Workout Factory).
 * Use for Deep Dive and User Instructions so they don't require GEMINI_API_KEY.
 * Retries on 429 (rate limit) and 503 (service unavailable) with exponential backoff.
 */
export interface VertexGeminiOptions {
  systemInstruction: string;
  userPrompt: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  logPrefix?: string;
}

export async function callVertexAIGemini(options: VertexGeminiOptions): Promise<string> {
  const creds = await getVertexAICredentials(options.logPrefix ?? '[vertex-gemini]');
  if ('error' in creds) {
    const msg = await credentialErrorToMessage(creds.error);
    throw new Error(msg);
  }
  const { projectId, region, accessToken } = creds;
  const logPrefix = options.logPrefix ?? '[vertex-gemini]';
  const model = options.model ?? 'gemini-2.0-flash-001';
  const baseUrl =
    region === 'global'
      ? `https://us-central1-aiplatform.googleapis.com`
      : `https://${region}-aiplatform.googleapis.com`;
  const location = region === 'global' ? 'us-central1' : region;
  const endpoint = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      temperature: options.temperature ?? 0.5,
      ...(options.responseMimeType && { responseMimeType: options.responseMimeType }),
    },
  };

  let response: Response | undefined;
  let retries = 0;
  const maxRetries = 3;
  const baseDelay = 2000;

  while (retries <= maxRetries) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) break;

    const errText = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Vertex AI Gemini 403. Ensure the service account has Vertex AI User in project ${projectId}. ${errText.substring(0, 200)}`
      );
    }

    const isRetryable = response.status === 429 || response.status === 503;
    const totalAttempts = maxRetries + 1;
    if (isRetryable && retries < maxRetries) {
      const delay = baseDelay * Math.pow(2, retries);
      const reason = response.status === 429 ? 'Rate limited' : 'Service unavailable';
      console.warn(
        `${logPrefix} ${reason} (${response.status}). Attempt ${retries + 1}/${totalAttempts} failed; retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
      continue;
    }
    if (isRetryable && retries >= maxRetries) {
      console.warn(`${logPrefix} Attempt ${totalAttempts}/${totalAttempts} failed (${response.status}).`);
    }
    throw new Error(`Vertex AI Gemini error: ${response.status} - ${errText.substring(0, MAX_ERROR_LOG_LENGTH)}`);
  }

  if (!response || !response.ok) {
    throw new Error('Vertex AI Gemini failed after retries');
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error(`Vertex AI Gemini unexpected response: ${JSON.stringify(data).substring(0, 300)}`);
  }
  return text.trim();
}
