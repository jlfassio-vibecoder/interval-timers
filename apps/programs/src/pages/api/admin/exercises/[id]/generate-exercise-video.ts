import type { APIRoute } from 'astro';
import RunwayML, { APIError } from '@runwayml/sdk';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import {
  getGeneratedExerciseById,
  updateGeneratedExerciseVideos,
} from '@/lib/supabase/admin/generated-exercises-server';
import { buildExerciseVideoPrompt } from '@/lib/gemini-server';
import { uploadBufferToStorage } from '@/lib/supabase/admin/storage-upload';
import { validateVideoAgainstBiomechanics } from '@/lib/biomechanical-validation';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

type VideoProvider = 'runway' | 'gemini';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const POST: APIRoute = async ({ request, params, cookies }) => {
  const { id: exerciseId } = params ?? {};

  if (!exerciseId) {
    return jsonError('Exercise ID is required', 400);
  }

  let body: { provider?: string; videoSourceUrl?: string } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as { provider?: string; videoSourceUrl?: string };
  } catch {
    // ignore parse errors, use default provider
  }
  const provider: VideoProvider = body.provider === 'gemini' ? 'gemini' : 'runway';
  const videoSourceUrl =
    typeof body.videoSourceUrl === 'string' ? body.videoSourceUrl.trim() : undefined;

  const runwayApiKey = process.env.RUNWAYML_API_SECRET || import.meta.env.RUNWAYML_API_SECRET;
  const geminiApiKey = process.env.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

  if (provider === 'runway' && (!runwayApiKey || runwayApiKey.trim() === '')) {
    return jsonError('RUNWAYML_API_SECRET is not configured. Add it to your environment.', 500);
  }

  if (provider === 'gemini' && (!geminiApiKey || geminiApiKey.trim() === '')) {
    return jsonError('GEMINI_API_KEY is not configured. Add it to your environment.', 500);
  }

  try {
    await verifyAdminRequest(request, cookies);

    const exercise = await getGeneratedExerciseById(exerciseId);
    if (!exercise) {
      return jsonError('Exercise not found', 404);
    }
    const primaryImageUrl = exercise.imageUrl;
    const useVideoToVideo =
      provider === 'runway' && videoSourceUrl && videoSourceUrl.startsWith('https://');

    if (!useVideoToVideo) {
      if (!primaryImageUrl || !primaryImageUrl.startsWith('http')) {
        return jsonError('Exercise must have a valid primary image URL for video generation', 400);
      }
    }

    const biomechanics = exercise.biomechanics ?? {};
    const performanceCues = biomechanics.performanceCues ?? [];
    const commonMistakes = biomechanics.commonMistakes ?? [];
    const promptText = await buildExerciseVideoPrompt(exercise.exerciseName, performanceCues, {
      biomechanicalChain: biomechanics.biomechanicalChain,
      pivotPoints: biomechanics.pivotPoints,
      stabilizationNeeds: biomechanics.stabilizationNeeds,
      commonMistakes,
    });

    let videoBuffer: Buffer;

    if (provider === 'runway') {
      const client = new RunwayML({ apiKey: runwayApiKey! });

      if (useVideoToVideo && videoSourceUrl) {
        const createTask = client.videoToVideo.create({
          model: 'gen4_aleph',
          videoUri: videoSourceUrl,
          promptText,
          ratio: '1280:720',
        });

        await createTask;

        const completed = await createTask.waitForTaskOutput({
          timeout: 300000,
        });

        const outputUrls = (completed as { output?: string[] }).output;
        if (!outputUrls?.length) {
          return jsonError('Runway did not return a video URL', 500);
        }

        const outUrl = outputUrls[0];
        const videoResponse = await fetch(outUrl);
        if (!videoResponse.ok) {
          return jsonError('Failed to download generated video from Runway', 500);
        }
        videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      } else {
        const createTask = client.imageToVideo.create({
          model: 'gen4_turbo',
          promptImage: primaryImageUrl!,
          promptText,
          ratio: '1280:720',
          duration: 5,
        });

        await createTask;

        const completed = await createTask.waitForTaskOutput({
          timeout: 300000,
        });

        const outputUrls = (completed as { output?: string[] }).output;
        if (!outputUrls?.length) {
          return jsonError('Runway did not return a video URL', 500);
        }

        const videoUrl = outputUrls[0];
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          return jsonError('Failed to download generated video from Runway', 500);
        }
        videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      }
    } else {
      // provider === 'gemini' (Veo)
      const imageResponse = await fetch(primaryImageUrl);
      if (!imageResponse.ok) {
        return jsonError('Failed to fetch exercise image for video generation', 500);
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageBase64 = imageBuffer.toString('base64');
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const mimeType = contentType.includes('png') ? 'image/png' : 'image/jpeg';

      const ai = new GoogleGenAI({ apiKey: geminiApiKey! });
      const veoModel = 'veo-3.1-generate-preview';

      let operation = await ai.models.generateVideos({
        model: veoModel,
        prompt: promptText,
        image: { imageBytes: imageBase64, mimeType },
        config: { aspectRatio: '16:9', durationSeconds: 6 },
      });

      const pollIntervalMs = 10000;
      const maxWaitMs = 300000;
      const startTime = Date.now();

      while (!operation.done) {
        if (Date.now() - startTime > maxWaitMs) {
          return jsonError('Gemini video generation timed out', 504);
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      if (operation.error) {
        const errMsg =
          (operation.error as { message?: string }).message ?? 'Video generation failed';
        if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          return jsonError('Gemini API quota exceeded. Try again later.', 429);
        }
        if (errMsg.includes('SAFETY') || errMsg.includes('BLOCKED')) {
          return jsonError('Video was blocked by safety filters. Try a different exercise.', 400);
        }
        return jsonError(errMsg, 500);
      }

      const genVideo = operation.response?.generatedVideos?.[0]?.video;
      if (!genVideo) {
        return jsonError('Gemini did not return a video', 500);
      }

      const tmpPath = path.join(os.tmpdir(), `veo-${exerciseId}-${Date.now()}.mp4`);
      try {
        await ai.files.download({ file: genVideo, downloadPath: tmpPath });
        videoBuffer = fs.readFileSync(tmpPath);
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    }

    const validation = await validateVideoAgainstBiomechanics(videoBuffer, undefined, {
      skipValidation: true,
    });
    if (!validation.passed && validation.needsReview) {
      return new Response(
        JSON.stringify({
          validated: false,
          needsReview: true,
          error: 'Video did not pass biomechanical validation. Please review manually.',
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const storagePath = `generated-exercises/${exerciseId}/video/${Date.now()}.mp4`;
    const { downloadUrl } = await uploadBufferToStorage(videoBuffer, storagePath, 'video/mp4');

    const existingVideos =
      exercise.videos && exercise.videos.length > 0
        ? exercise.videos.map((v, i) => ({
            videoUrl: v.videoUrl,
            videoStoragePath: v.videoStoragePath ?? '',
            label: v.label,
            hidden: v.hidden ?? false,
            position: v.position ?? i,
          }))
        : exercise.videoUrl
          ? [
              {
                videoUrl: exercise.videoUrl,
                videoStoragePath: exercise.videoStoragePath ?? '',
                hidden: false,
                position: 0,
              },
            ]
          : [];
    const videos = [
      ...existingVideos,
      {
        videoUrl: downloadUrl,
        videoStoragePath: storagePath,
        position: existingVideos.length,
        hidden: false,
      },
    ];

    await updateGeneratedExerciseVideos(exerciseId, videos);

    return new Response(
      JSON.stringify({
        videoUrl: downloadUrl,
        videoStoragePath: storagePath,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error: unknown) {
    let message = 'Video generation failed';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    console.error('[generate-exercise-video]', message, error);

    if (error instanceof Error && (message === 'UNAUTHENTICATED' || message === 'UNAUTHORIZED')) {
      return jsonError('Unauthorized', 401);
    }

    // Runway API errors (credits, rate limits, etc.)
    if (error instanceof APIError) {
      const runwayErr = error.error as { error?: string } | undefined;
      const runwayMsg = typeof runwayErr?.error === 'string' ? runwayErr.error : message;
      if (runwayMsg.includes('enough credits') || runwayMsg.includes('credits')) {
        return jsonError(
          'Runway account has insufficient credits. Add credits at runwayml.com.',
          402
        );
      }
      if (error.status === 429) {
        return jsonError('Runway rate limit exceeded. Please try again later.', 429);
      }
      return jsonError(
        runwayMsg,
        error.status && error.status >= 400 && error.status < 600 ? error.status : 502
      );
    }

    return jsonError(message, 500);
  }
};
