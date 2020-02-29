import { stat, read, open } from "fs";
import { promisify } from "util";
import { get } from "http";

const ENTRY_LENGTH = 40;
const NO_SENSOR_VALUE = 2500;
const statAsync = promisify(stat);
const readAsync = promisify(read); // (fd, buffer, offset, length, position, callback)
const openAsync = promisify(open);

export type ReadingType = {
  date: number;
  dateAjusted: number;
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

function fomatSensorTemp(buff: Buffer, offset: number): number {
  const val = buff.readInt16LE(offset);
  return NO_SENSOR_VALUE == val ? 0 : val / 10;
}

function formatRelay(buff: Buffer, offset: number): boolean {
  const val = buff.readInt16LE(offset);
  return val == 200;
}

/**
 * @param url url of DLF file for use with wifi SD cards
 * @param offset Offset of entries from end of file. Default 0 i.e latest entry.
 */
export async function fromUrl(url: string, offset = 0): Promise<ReadingType> {
  return await new Promise<ReadingType>(function(resolve, reject) {
    get(url, resp => {
      const chunks: Uint8Array[] = [];

      resp.on("data", (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      resp.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const entryBuffer = Buffer.alloc(ENTRY_LENGTH);
        const soruceStart = buffer.length - ENTRY_LENGTH * (offset + 1);
        const sourceEnd = soruceStart + ENTRY_LENGTH;
        buffer.copy(entryBuffer, 0, soruceStart, sourceEnd);
        resolve(fromBuffer(entryBuffer));
      });
    }).on("error", err => {
      throw new Error(`Request Failed: ${err.message}`);
    });
  });
}

/**
 * @param path Path to .DLF file
 * @param offset Offset of entries from end of file. Default 0 i.e latest entry.
 */
export async function fromPath(path: string, offset = 0): Promise<ReadingType> {
  const { size } = await statAsync(path);
  const latestOffset = size - ENTRY_LENGTH * (offset + 1);
  const entryBuffer = Buffer.alloc(ENTRY_LENGTH);
  const fd = await openAsync(path, "r");
  await readAsync(fd, entryBuffer, 0, ENTRY_LENGTH, latestOffset);
  return fromBuffer(entryBuffer);
}

function fromBuffer(entryBuffer: Buffer): ReadingType {
  if (entryBuffer.length != ENTRY_LENGTH) {
    throw "Binary data buffer invalid";
  }
  const date = entryBuffer.readUInt32LE(0);
  const sensors = [4, 6, 8, 10, 12, 14].map(offset =>
    fomatSensorTemp(entryBuffer, offset)
  );
  // theres should be information on more relays but i dont know the offsets
  const relay = [16].map(offset => formatRelay(entryBuffer, offset));

  // date is off by 50 years probably to save space on log entries
  let dateAjusted = new Date(date);
  dateAjusted.setUTCFullYear(dateAjusted.getUTCFullYear() + 50);

  return {
    date,
    dateAjusted: dateAjusted.getTime(),
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
