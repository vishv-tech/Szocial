/** Bound actual streamed bytes, including chunked requests without Content-Length. */
export async function boundedBody(request: Request, limit: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (length > limit) throw new Error('Request too large');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('Request too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function boundedJson(request: Request, limit = 100_000) {
  return JSON.parse(new TextDecoder().decode(await boundedBody(request, limit)));
}
