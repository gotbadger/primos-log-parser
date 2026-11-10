import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fromPath, fromUrl, type ReadingType } from "./index";

const ENTRY_LENGTH = 40;

const FIXTURES_BASE_PATH = join(__dirname, "..", "fixtures");
const FIXTURE_BASE = join(FIXTURES_BASE_PATH, "base.DLF");
const FIXTURE_RELAY = join(FIXTURES_BASE_PATH, "relay.DLF");

const EXPECTED_BASE_RESULT: ReadingType = {
  date: 315943898,
  realDate: 1578152743898,
  s1: 8.9,
  s2: 17.7,
  s3: 0,
  s4: 0,
  s5: 0,
  s6: 0,
  r1: false,
  status: 1,
  t1: 4678,
  he1: 0
};

const EXPECTED_RELAY_RESULT: ReadingType = {
  date: 315923677,
  realDate: 1578152723677,
  s1: 17.5,
  s2: 14.7,
  s3: 0,
  s4: 0,
  s5: 0,
  s6: 0,
  r1: true,
  status: 2,
  t1: 4677,
  he1: 4000
};

const EXPECTED_OFFSET_RESULT: ReadingType = {
  date: 315918937,
  realDate: 1578152718937,
  s1: 20.5,
  s2: 11.8,
  s3: 0,
  s4: 0,
  s5: 0,
  s6: 0,
  r1: true,
  status: 2,
  t1: 4676,
  he1: 5000
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

async function withServer(
  handler: Handler,
  fn: (url: string) => Promise<void>
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("could not determine test server port");
  }
  try {
    await fn(`http://127.0.0.1:${address.port}/base.DLF`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test("relay off", async () => {
  assert.deepStrictEqual(await fromPath(FIXTURE_BASE), EXPECTED_BASE_RESULT);
});

test("relay on", async () => {
  assert.deepStrictEqual(await fromPath(FIXTURE_RELAY), EXPECTED_RELAY_RESULT);
});

test("get data using offset", async () => {
  assert.deepStrictEqual(
    await fromPath(FIXTURE_RELAY, 79),
    EXPECTED_OFFSET_RESULT
  );
});

test("fromUrl", async () => {
  const body = await readFile(FIXTURE_BASE);
  await withServer((req, res) => {
    res.writeHead(200, { "Content-Type": "binary" });
    res.end(body);
  }, async url => {
    assert.deepStrictEqual(await fromUrl(url), EXPECTED_BASE_RESULT);
  });
});

test("fromUrl with offset", async () => {
  const body = await readFile(FIXTURE_RELAY);
  await withServer((req, res) => {
    res.writeHead(200, { "Content-Type": "binary" });
    res.end(body);
  }, async url => {
    assert.deepStrictEqual(await fromUrl(url, 79), EXPECTED_OFFSET_RESULT);
  });
});

test("fromUrl rejects non-2xx status", async () => {
  await withServer((req, res) => {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<html>" + "x".repeat(400) + "</html>");
  }, async url => {
    await assert.rejects(fromUrl(url), /Request Failed: 404/);
  });
});

test("fromUrl rejects connection errors", async () => {
  // nothing is listening on this port
  await assert.rejects(fromUrl("http://127.0.0.1:1/base.DLF"));
});

test("invalid offset rejects", async () => {
  await assert.rejects(fromPath(FIXTURE_BASE, -1), /non-negative integer/);
  await assert.rejects(fromPath(FIXTURE_BASE, 1.5), /non-negative integer/);
  await assert.rejects(fromPath(FIXTURE_BASE, NaN), /non-negative integer/);
  await assert.rejects(
    fromPath(FIXTURE_BASE, "0" as unknown as number),
    /non-negative integer/
  );
  await assert.rejects(
    fromUrl("http://127.0.0.1:1/base.DLF", -1),
    /non-negative integer/
  );
});

test("offset beyond start of data rejects", async () => {
  const body = await readFile(FIXTURE_BASE);
  // 219599 bytes is ~5489 full entries; one more is out of range
  const entries = Math.floor(body.length / ENTRY_LENGTH);
  await assert.rejects(fromPath(FIXTURE_BASE, entries + 1), /beyond the start/);
  await withServer((req, res) => {
    res.writeHead(200);
    res.end(body);
  }, async url => {
    await assert.rejects(
      fromUrl(url, entries + 1),
      /beyond the start of the response/
    );
  });
});

test("short file rejects", async () => {
  const dir = await mkdtemp(join(tmpdir(), "primos-test-"));
  try {
    const shortPath = join(dir, "short.DLF");
    await writeFile(shortPath, Buffer.alloc(20));
    await assert.rejects(fromPath(shortPath), /beyond the start of file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing file rejects", async () => {
  await assert.rejects(
    fromPath(join(FIXTURES_BASE_PATH, "does-not-exist.DLF")),
    /ENOENT/
  );
});

test("repeated reads do not leak file descriptors", async () => {
  // far more reads than typical available descriptors; a leaked fd
  // per read would fail with EMFILE/ENFILE before this loop completes
  for (let i = 0; i < 500; i++) {
    await fromPath(FIXTURE_BASE);
  }
});