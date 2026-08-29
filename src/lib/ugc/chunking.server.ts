/**
 * Chunk size is not specified in the build packet - ~800 chars with 100 of
 * overlap is a reasonable starting point for short-form creator content
 * (captions, transcripts, PDF excerpts); revisit once real content shows
 * whether chunks are too coarse or too fragmented for good retrieval.
 */
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}
