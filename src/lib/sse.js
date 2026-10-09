// Minimal Server-Sent Events parser over a fetch() ReadableStream. Used for
// Mercure (mail.tm live inbox) and streaming LLM responses, where EventSource
// is unusable because it cannot send an Authorization header.

/**
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<{event: string, data: string, id?: string}>}
 */
export async function* parseSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = { event: "message", data: [], id: undefined };

  const flush = function* () {
    if (event.data.length) {
      yield { event: event.event, data: event.data.join("\n"), id: event.id };
    }
    event = { event: "message", data: [], id: undefined };
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.search(/\r\n|\r|\n/)) >= 0) {
        const line = buffer.slice(0, idx);
        const sepLen = buffer[idx] === "\r" && buffer[idx + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(idx + sepLen);
        if (line === "") {
          yield* flush();
          continue;
        }
        if (line.startsWith(":")) continue; // comment / heartbeat
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        let val = colon < 0 ? "" : line.slice(colon + 1);
        if (val.startsWith(" ")) val = val.slice(1);
        if (field === "data") event.data.push(val);
        else if (field === "event") event.event = val;
        else if (field === "id") event.id = val;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split(/\r\n|\r|\n/)) {
        if (line.startsWith("data:")) event.data.push(line.slice(5).replace(/^ /, ""));
      }
    }
    yield* flush();
  } finally {
    reader.releaseLock?.();
  }
}
