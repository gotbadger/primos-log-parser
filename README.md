# primos-log-parser

The Primos is a solar thermal controller manufactured by [prozeda](https://prozeda.de/en/product-details/primos-250-sr-2/). The device has an SD card slot that can be used to log sensor readings but unfortunately this log is in a binary format that requires a windows only program to view the data.

This project is an attempt to reverse the binary format so data can be extracted programmatically.

## Installation

```sh
npm install primos-log-parser
```

Requires Node.js 20 or later.

## Usage

Read the latest logged reading from a `.DLF` file on disk:

```js
const { fromPath } = require("primos-log-parser");

const reading = await fromPath("/path/to/LOG0001.DLF");
console.log(reading.s1); // temperature of sensor 1
```

Or fetch it from a WiFi SD card:

```js
const { fromUrl } = require("primos-log-parser");

const reading = await fromUrl("http://192.168.1.50/SD/LOG0001.DLF");
```

### Offsets

Both functions take an optional `offset` argument that selects a record counting
backwards from the end of the file. `offset` defaults to `0`, the latest record.

```js
const previous = await fromPath(path, 1); // the second to last record
```

Offsets are validated: non-integer, negative or out-of-range offsets reject
with an `Error` rather than returning a fabricated reading.

### Output

```ts
type ReadingType = {
  date: number; // raw 32-bit unsigned timestamp from the record
  realDate: number; // derived timestamp, see "Timestamps" below
  s1: number; // sensor 1 temperature (°C)
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
  r1: boolean; // relay 1 state
  he1: number; // raw value, meaning unverified
  status: number; // raw value, meaning unverified
  t1: number; // raw value, meaning unverified
};
```

Notes on the fields:

- Sensors are signed 16-bit values divided by 10, so `175` means 17.5 °C.
  A raw value of `2500` means no sensor is connected and is reported as `0`.
- `r1` is `true` when the raw relay value is `200`. There should be information
  on more relays in the record but their offsets are unknown.
- `he1`, `status` and `t1` are raw signed 16-bit values; their units are unknown.

### Timestamps

The record stores a 32-bit unsigned value. It is interpreted as milliseconds
since the Unix epoch with 50 years added, which matches observed device logs
(the resulting dates land in January 2020 for the captured test data). The
device appears to do this to save space on log entries. `realDate` is that
derived timestamp in milliseconds; `date` is the raw value unchanged.

## Development

```sh
npm ci     # install dependencies
npm test   # build and run the test suite
```

The fixtures in `fixtures/` are real logs captured from a Primos 250 SR 2
controller and their decoded values are verified against the device.

You should be able to read logs for any of the other primos devices, although
this is unverified.

For further info you can see a simple example implmentation using a wifi sd card here: https://github.com/gotbadger/solar-monitor