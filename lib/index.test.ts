import { fromPath, fromUrl } from "./index";
import { basename, join } from "path";
import nock from "nock";

const FIXTURES_BASE_PATH = join(basename(__dirname), "..", "fixtures");
const FIXTURE_BASE = join(FIXTURES_BASE_PATH, "base.DLF");
const FIXTURE_RELAY = join(FIXTURES_BASE_PATH, "relay.DLF");
const FIXTURE_URL_HOST = "http://example.local";
const FIXTURE_URL_PATH = "/base.DLF";
const FIXTURE_URL = `${FIXTURE_URL_HOST}${FIXTURE_URL_PATH}`;

const EXPECTED_BASE_RESULT = {
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

test("relay off", () => {
  return expect(fromPath(FIXTURE_BASE)).resolves.toStrictEqual(
    EXPECTED_BASE_RESULT
  );
});

test("relay on", () => {
  return expect(fromPath(FIXTURE_RELAY)).resolves.toStrictEqual({
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
  });
});

test("get data using offset", () => {
  return expect(fromPath(FIXTURE_RELAY, 79)).resolves.toStrictEqual({
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
  });
});

test("fromUrl", () => {
  nock(FIXTURE_URL_HOST)
    .get(FIXTURE_URL_PATH)
    .replyWithFile(200, FIXTURE_BASE, {
      "Content-Type": "binary"
    });
  return expect(fromUrl(FIXTURE_URL)).resolves.toStrictEqual(
    EXPECTED_BASE_RESULT
  );
});
