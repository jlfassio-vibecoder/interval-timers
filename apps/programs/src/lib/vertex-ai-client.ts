/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Vertex AI / OpenAPI chat client for DeepSeek v3.2.
 * Provides timeout and retry for consistent reliability across endpoints.
 */

const MAX_ERROR_LOG_LENGTH = 500;

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

    const isRetryable = response.status === 429 || response.status === 503;
    if (isRetryable && retries < maxRetries) {
      const delay = baseDelay * Math.pow(2, retries);
      const reason = response.status === 429 ? 'Rate limited' : 'Service unavailable';
      console.warn(
        `${logPrefix} ${reason} (${response.status}). Retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
      continue;
    }

    const errorText = await response.text();
    throw new Error(
      `AI API error: ${response.status} - ${errorText.substring(0, MAX_ERROR_LOG_LENGTH)}`
    );
  }

  if (!response || !response.ok) {
    throw new Error('Failed to get AI response after retries');
  }

  const apiData = await response.json();
  if (apiData.choices?.[0]?.message?.content) {
    return apiData.choices[0].message.content;
  }
  if (apiData.content) {
    return apiData.content;
  }
  throw new Error('Unexpected API response format');
}
