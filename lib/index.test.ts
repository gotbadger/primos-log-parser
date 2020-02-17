import { fromPath } from "./index";
import { basename, join } from "path";

const FIXTURES_BASE_PATH = join(basename(__dirname), "..", "fixtures");
const FIXTURE_BASE = join(FIXTURES_BASE_PATH, "base.DLF");
const FIXTURE_RELAY = join(FIXTURES_BASE_PATH, "relay.DLF");

test("works", () => {
  return expect(fromPath(FIXTURE_BASE)).resolves.toStrictEqual({
    date: 315943898,
    s1: 8.9,
    s2: 17.7,
    s3: 0,
    s4: 0,
    s5: 0,
    s6: 0
  });
});
