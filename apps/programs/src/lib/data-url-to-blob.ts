/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Convert a data URL (e.g. from canvas.toDataURL) to a Blob for upload.
 */

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Invalid data URL: missing comma separator');
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  } catch (e) {
    throw new Error(
      e instanceof DOMException ? 'Invalid data URL: base64 decoding failed' : 'Invalid data URL'
    );
  }
}
