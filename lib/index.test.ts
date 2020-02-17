import { fromPath } from "./index";
import { basename, join } from "path";

const FIXTURES_BASE_PATH = join(basename(__dirname), "..", "fixtures");
const FIXTURE_BASE = join(FIXTURES_BASE_PATH, "base.DLF");
const FIXTURE_RELAY = join(FIXTURES_BASE_PATH, "relay.DLF");

test("relay off", () => {
  return expect(fromPath(FIXTURE_BASE)).resolves.toStrictEqual({
    date: 315943898,
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
  });
});

test("relay on", () => {
  return expect(fromPath(FIXTURE_RELAY)).resolves.toStrictEqual({
    date: 315923677,
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
  });
});

test("get data using offset", () => {
  return expect(fromPath(FIXTURE_RELAY, 79)).resolves.toStrictEqual({
    date: 315918937,
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
  });
});
