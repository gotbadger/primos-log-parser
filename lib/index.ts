import { open } from "fs/promises";

const ENTRY_LENGTH = 40;
const NO_SENSOR_VALUE = 2500;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export type ReadingType = {
  date: number;
  realDate: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
  r1: boolean;
  he1: number;
  status: number;
  t1: number;
};

function formatSensorTemp(buff: Buffer, offset: number): number {
  const val = buff.readInt16LE(offset);
  return NO_SENSOR_VALUE == val ? 0 : val / 10;
}

function formatRelay(buff: Buffer, offset: number): boolean {
  const val = buff.readInt16LE(offset);
  return val == 200;
}

function validateOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(
      `offset must be a non-negative integer, got ${JSON.stringify(offset)}`
    );
  }
}

/**
 * @param url url of DLF file for use with wifi SD cards
 * @param offset Offset of entries from end of file. Default 0 i.e latest entry.
 */
export async function fromUrl(url: string, offset = 0): Promise<ReadingType> {
  validateOffset(offset);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(
      `Request Failed: ${response.status} ${response.statusText || "Unknown Error"}`
    );
  }
  const body = await readBodyWithLimit(response);
  const sourceStart = body.length - ENTRY_LENGTH * (offset + 1);
  if (sourceStart < 0) {
    throw new Error(
      `offset ${offset} is beyond the start of the response (${body.length} bytes)`
    );
  }
  const entryBuffer = body.subarray(sourceStart, sourceStart + ENTRY_LENGTH);
  return fromBuffer(entryBuffer);
}

async function readBodyWithLimit(response: Response): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Request Failed: response has no body");
  }
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        throw new Error(
          `Request Failed: response body exceeds ${MAX_BODY_BYTES} bytes`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/**
 * @param path Path to .DLF file
 * @param offset Offset of entries from end of file. Default 0 i.e latest entry.
 */
export async function fromPath(path: string, offset = 0): Promise<ReadingType> {
  validateOffset(offset);
  const fh = await open(path, "r");
  try {
    const { size } = await fh.stat();
    const latestOffset = size - ENTRY_LENGTH * (offset + 1);
    if (latestOffset < 0) {
      throw new Error(
        `offset ${offset} is beyond the start of file (${size} bytes)`
      );
    }
    const entryBuffer = Buffer.alloc(ENTRY_LENGTH);
    const { bytesRead } = await fh.read(
      entryBuffer,
      0,
      ENTRY_LENGTH,
      latestOffset
    );
    if (bytesRead !== ENTRY_LENGTH) {
      throw new Error(
        `Short read: expected ${ENTRY_LENGTH} bytes, got ${bytesRead}`
      );
    }
    return fromBuffer(entryBuffer);
  } finally {
    await fh.close();
  }
}

function fromBuffer(entryBuffer: Buffer): ReadingType {
  if (entryBuffer.length != ENTRY_LENGTH) {
    throw new Error("Binary data buffer invalid");
  }
  const date = entryBuffer.readUInt32LE(0);
  const sensors = [4, 6, 8, 10, 12, 14].map(offset =>
    formatSensorTemp(entryBuffer, offset)
  );
  // theres should be information on more relays but i dont know the offsets
  const relay = [16].map(offset => formatRelay(entryBuffer, offset));

  // date is off by 50 years probably to save space on log entries
  let realDate = new Date(date);
  realDate.setUTCFullYear(realDate.getUTCFullYear() + 50);

  return {
    date,
    realDate: realDate.getTime(),
    s1: sensors[0],
    s2: sensors[1],
    s3: sensors[2],
    s4: sensors[3],
    s5: sensors[4],
    s6: sensors[5],
    r1: relay[0],
    he1: entryBuffer.readInt16LE(22),
    status: entryBuffer.readInt16LE(26),
    t1: entryBuffer.readInt16LE(32)
  };
}