import assert from "node:assert/strict";
import test from "node:test";

import {
  ResponseBodyTooLargeError,
  readBoundedResponseText,
} from "@/lib/bounded-response";

test("reads a response within the configured byte limit", async () => {
  assert.equal(await readBoundedResponseText(new Response("hello"), 5), "hello");
});

test("rejects declared and streamed oversized upstream bodies", async () => {
  await assert.rejects(
    readBoundedResponseText(
      new Response("small", { headers: { "Content-Length": "100" } }),
      10,
    ),
    ResponseBodyTooLargeError,
  );
  await assert.rejects(
    readBoundedResponseText(new Response("eleven-byte"), 10),
    ResponseBodyTooLargeError,
  );
});
