import { stat, read, open } from "fs";
import { promisify } from "util";

const ENTRY_LENGTH = 40;
const NO_SENSOR_VALUE = 2500;
const statAsync = promisify(stat);
const readAsync = promisify(read); // (fd, buffer, offset, length, position, callback)
const openAsync = promisify(open);

export type TDataSet = {
  date: number; // all dates are correct but year is out by 40 years!
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
};

function fomatSensorTemp(buff: Buffer, offset: number): number {
  const val = buff.readInt16LE(offset);
  return NO_SENSOR_VALUE == val ? 0 : val / 10;
}

export async function fromPath(path: string) {
  const { size } = await statAsync(path);
  const latestOffset = size - ENTRY_LENGTH;
  const entryBuffer = Buffer.alloc(ENTRY_LENGTH);
  const fd = await openAsync(path, "r");
  await readAsync(fd, entryBuffer, 0, ENTRY_LENGTH, latestOffset);
  console.log(entryBuffer);
  // read last 40 bytes
  //fs.read(fd, buffer, offset, length, position, callback);

  const date = entryBuffer.readUInt32LE(0);
  const sensors = [4, 6, 8, 10, 12, 14].map(offset =>
    fomatSensorTemp(entryBuffer, offset)
  );

  return {
    date,
    s1: sensors[0],
    s2: sensors[1],
    s3: sensors[2],
    s4: sensors[3],
    s5: sensors[4],
    s6: sensors[5]
  } as TDataSet;
}
