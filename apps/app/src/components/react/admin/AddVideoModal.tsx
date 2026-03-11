/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AddVideoModal Component
 * Modal for adding exercise demonstration videos via upload or Runway/Gemini AI generation.
 */

import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/supabase-instance';
import { uploadExerciseVideo } from '@/lib/supabase/client/storage';
import { addExerciseVideo } from '@/lib/supabase/client/generated-exercises';

interface AddVideoModalProps {
  exerciseId: string;
  exerciseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getAuthToken: () => Promise<string>;
}

type AddMode = 'upload' | 'generate';

const AddVideoModal: React.FC<AddVideoModalProps> = ({
  exerciseId,
  exerciseName,
  isOpen,
  onClose,
  onSuccess,
  getAuthToken,
}) => {
  const [mode, setMode] = useState<AddMode>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [sourceVideoFile, setSourceVideoFile] = useState<File | null>(null);
  const [sourceVideoPreviewUrl, setSourceVideoPreviewUrl] = useState<string | null>(null);
  const [uploadingSourceVideo, setUploadingSourceVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sourceVideoInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setMode('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setSourceVideoUrl(null);
    setSourceVideoFile(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (sourceVideoPreviewUrl) URL.revokeObjectURL(sourceVideoPreviewUrl);
    setSourceVideoPreviewUrl(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, etc.)');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleUploadSave = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!selectedFile || !session?.user) return;

    setSaving(true);
    setError(null);

    try {
      const storagePath = `generated-exercises/${exerciseId}/video/${Date.now()}.${selectedFile.name.split('.').pop() || 'mp4'}`;
      const { downloadUrl, storagePath: savedPath } = await uploadExerciseVideo(
        selectedFile,
        storagePath
      );

      await addExerciseVideo(exerciseId, {
        videoUrl: downloadUrl,
        videoStoragePath: savedPath,
      });

      toast.success('Video added successfully');
      handleClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      toast.error('Failed to add video');
    } finally {
      setSaving(false);
    }
  };

  type VideoProvider = 'runway' | 'gemini';

  const handleSourceVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, etc.)');
      return;
    }
    setError(null);
    if (sourceVideoPreviewUrl) URL.revokeObjectURL(sourceVideoPreviewUrl);
    setSourceVideoFile(file);
    setSourceVideoPreviewUrl(URL.createObjectURL(file));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUploadingSourceVideo(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const storagePath = `generated-exercises/${exerciseId}/video-input/${Date.now()}.${ext}`;
      const { downloadUrl } = await uploadExerciseVideo(file, storagePath);
      setSourceVideoUrl(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload source video');
      setSourceVideoUrl(null);
    } finally {
      setUploadingSourceVideo(false);
    }
  };

  const handleRemoveSourceVideo = () => {
    setSourceVideoUrl(null);
    setSourceVideoFile(null);
    if (sourceVideoPreviewUrl) URL.revokeObjectURL(sourceVideoPreviewUrl);
    setSourceVideoPreviewUrl(null);
    setError(null);
  };

  const handleGenerate = async (provider: VideoProvider = 'runway') => {
    setGenerating(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const body: { provider: VideoProvider; videoSourceUrl?: string } = { provider };
      if (provider === 'runway' && sourceVideoUrl) {
        body.videoSourceUrl = sourceVideoUrl;
      }
      const response = await fetch(`/api/admin/exercises/${exerciseId}/generate-exercise-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Video generation failed');
      }

      if (data.validated === false && data.needsReview) {
        setError(data.error || 'Video needs manual review');
        return;
      }

      toast.success('Video generated successfully');
      handleClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      toast.error('Failed to generate video');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  const canSaveUpload = mode === 'upload' && selectedFile !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Video className="h-5 w-5 text-teal-400" />
            Add Exercise Video
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-700 px-4 pt-4">
          <button
            onClick={() => setMode('upload')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload Video
          </button>
          <button
            onClick={() => setMode('generate')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'generate'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Loader2 className="h-4 w-4" />
            Generate Video
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-slate-400">
            Add a demonstration video for{' '}
            <span className="font-medium text-white">{exerciseName}</span>
          </p>

          {mode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                previewUrl
                  ? 'border-teal-500/50 bg-teal-500/10'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
              }`}
            >
              {previewUrl ? (
                <div className="space-y-3">
                  <video
                    src={previewUrl}
                    controls
                    className="mx-auto max-h-48 rounded-lg"
                    playsInline
                  />
                  <p className="text-sm text-slate-400">{selectedFile?.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-10 w-10 text-slate-500" />
                  <p className="text-sm text-slate-400">Click to select a video</p>
                  <p className="text-xs text-slate-500">MP4, WebM up to 50MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {mode === 'generate' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Generate a video using Runway AI or Google Gemini (Veo). The video will show the
                exercise with full range of motion based on the exercise biomechanics. This may take
                1–3 minutes.
              </p>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Optional: Upload a video for Runway video-to-video (gen4_aleph)
                </p>
                <p className="mb-2 text-xs text-slate-500">
                  Leave empty to generate from the exercise image.
                </p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSourceVideoFile(file);
                  }}
                  onClick={() => sourceVideoInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                    sourceVideoPreviewUrl
                      ? 'border-teal-500/50 bg-teal-500/10'
                      : isDragging
                        ? 'border-teal-500 bg-teal-500/20'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                  }`}
                >
                  {sourceVideoPreviewUrl ? (
                    <div className="space-y-3">
                      <video
                        src={sourceVideoPreviewUrl}
                        controls
                        className="mx-auto max-h-32 rounded-lg"
                        playsInline
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-sm text-slate-400">
                        {sourceVideoFile?.name}
                        {uploadingSourceVideo && ' (uploading...)'}
                        {sourceVideoUrl && !uploadingSourceVideo && ' — ready for Runway v2v'}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSourceVideo();
                        }}
                        disabled={uploadingSourceVideo}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="mx-auto h-8 w-8 text-slate-500" />
                      <p className="text-sm text-slate-400">
                        Drag and drop a video or click to select
                      </p>
                      <p className="text-xs text-slate-500">MP4, WebM</p>
                    </div>
                  )}
                  <input
                    ref={sourceVideoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSourceVideoFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate('runway')}
                  disabled={generating || uploadingSourceVideo}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5" />
                      Generate with Runway
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleGenerate('gemini')}
                  disabled={generating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-600 py-3 font-medium text-white transition-colors hover:bg-slate-500 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5" />
                      Generate with Gemini
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {mode === 'upload' && (
          <div className="flex justify-end gap-2 border-t border-slate-700 p-4">
            <button
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadSave}
              disabled={!canSaveUpload || saving}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Video'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddVideoModal;
