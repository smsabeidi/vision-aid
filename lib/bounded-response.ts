export class ResponseBodyTooLargeError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Response body exceeds ${maximumBytes} bytes.`);
    this.name = "ResponseBodyTooLargeError";
  }
}

/** Reads an upstream response without allowing an unbounded body into memory. */
export async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError("maximumBytes must be a positive integer.");
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseBodyTooLargeError(maximumBytes);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseBodyTooLargeError(maximumBytes);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}
