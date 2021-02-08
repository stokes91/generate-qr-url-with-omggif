/*
   Copyright 2021 Alexander Stokes

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

const omggif = require('omggif');

const { ReedSolomonEncoder } = require('rs-finite-field')(0x100, 0x11D, 1);

const FormatPatterns = [
  0x11f7, 0x67a7, 0x2adf, 0x5c8f,
  0x7a33, 0x0c63, 0x411b, 0x374b
];

class MaskGenerator {
  constructor(options) {
    Object.assign(this, options);
    this.pixels = [];
  }

  atCoord(coord) {
    let { x, y } = coord;

    if (y > 5) {
      y += 1;
    }

    if (this.mask === null) {
      return 1;
    }

    switch (this.mask) {
      case 0:
        return (x + y) % 2;
      case 1:
        return (y % 2);
      case 2:
        return (x % 3);
      case 3:
        return ((x + y) % 3);
      case 4:
        return ((Math.floor(x / 3) + Math.floor(y / 2)) % 2);
      case 5:
        return (x * y % 2 + x * y % 3);
      case 6:
        return (((x * y) % 2 + (x * y) % 3) % 2);
      case 7:
        return (((x + y) % 2 + (x * y) % 3) % 2);
    }
  }

  drawLineH(x, y, l) {
    for (let i = 0; l--; i++)
      this.pixels.push({ x: x + i, y });
  }

  drawLineV(x, y, l) {
    while (l--)
      this.pixels.push({ x, y: y + l });
  }

  drawVersionFormat() {
    this.drawLineH(0, 8, 6);
    this.drawLineH(7, 8, 2);
    this.drawLineV(8, 7, 1);
    this.drawLineV(8, 0, 6);
    const formatA = this.pixels;
    this.pixels = [];

    this.drawLineV(8, 14, 7);
    this.drawLineH(13, 8, 8);
    const formatB = this.pixels;

    this.pixels = [{ x: 8, y: 13 }];

    const symbol = FormatPatterns[this.mask];

    for (let j = 15; j--;) {
      if (((symbol >>> j) & 1) === 0) continue;

      this.pixels.push(formatA[j]);
      this.pixels.push(formatB[j]);
    }

    this.drawFinder(3, 3);
    this.drawFinder(17, 3);
    this.drawFinder(3, 17);

    return this.pixels;
  }

  drawFinder(x, y) {
    this.drawLineH(-3 + x, -3 + y, 6);
    this.drawLineV(-3 + x, -2 + y, 6);
    this.drawLineH(-2 + x, 3 + y, 6);
    this.drawLineV(3 + x, -3 + y, 6);
    for (let l = 3; l--;) {
      this.drawLineH(-1 + x, l - 1 + y, 3);
      this.pixels.push({ x: 12 - l * 2, y: 6 });
      this.pixels.push({ x: 6, y: 12 - l * 2 });
    }
  }
}

class QRCodeByteMap {
  constructor(options) {
    Object.assign(this, options);

    this.byteMap = [];
  }

  writeUp(coord, l) {
    while (l--) {
      this.coloradoUp(coord);
      coord.row -= 4;
    }
  }

  writeDn(coord, l) {
    while (l--) {
      this.coloradoDn(coord);
      coord.row += 4;
    }
  }

  coloradoUp(coord) {
    const { row, col } = coord;

    this.byteMap.push([
      { y: -3, x: -1 },
      { y: -3, x: 0 },
      { y: -2, x: -1 },
      { y: -2, x: 0 },
      { y: -1, x: -1 },
      { y: -1, x: 0 },
      { y: 0, x: -1 },
      { y: 0, x: 0 }
    ].map((coord) => {
      const { x, y } = coord;
      const at = { x: x + col, y: y + row };
      return at;
    }));
  }

  coloradoDn(coord) {
    const { row, col } = coord;

    this.byteMap.push([
      { y: 3, x: -1 },
      { y: 3, x: 0 },
      { y: 2, x: -1 },
      { y: 2, x: 0 },
      { y: 1, x: -1 },
      { y: 1, x: 0 },
      { y: 0, x: -1 },
      { y: 0, x: 0 }
    ].map((coord) => {
      const { x, y } = coord;
      const at = { x: x + col, y: y + row };
      return at;
    }));
  }
}

function ToAlphaSet(byte) {
  if (byte > 0x2f && byte < 0x3a) {
    return byte - 0x30;
  }
  else if (byte > 0x40 && byte < 0x5b) {
    return byte - 0x37;
  }
  else if (byte === 0x20) {
    return 0x24;
  }
  else if (byte > 0x23 && byte < 0x26) {
    return byte + 0x01;
  }
  else if (byte > 0x29 && byte < 0x2c) {
    return byte - 0x03;
  }
  else if (byte > 0x2c && byte < 0x30) {
    return byte - 0x04;
  }
  else if (byte === 0x3a) {
    return 0x2c;
  }
  return 0;
}

class ColorRun {
  constructor() {
    this.currentColor = null;
    this.length = 0;
    this.score = 0;
    this.run = [];
  }

  append(color) {
    if (this.currentColor === color) {
      this.length += 1;
      if (this.length === 5) {
        this.score += 3;
      }
      else if (this.length > 5) {
        this.score += 1;
      }
    }
    else {
      this.run.push(this.length);
      this.currentColor = color;
      this.length = 1;
    }
  }

  getPenalty() {
    this.run.push(this.length);
    this.run.push(0);

    let count = 0;

    while (this.run.length > 5) {
      const whiteSpace = this.run.shift();
      const darkSpace = this.run.shift();

      if (darkSpace !== 1 ||
        this.run[0] !== 1 ||
        this.run[1] !== 3 ||
        this.run[2] !== 1 ||
        this.run[3] !== 1 ||
        (whiteSpace <= 3 && this.run[4] <= 3)) continue;

      count += 1;
    }

    return this.score + count * 40;
  }
}

class AllocPixels {
  constructor(options) {
    Object.assign(this, options);

    this.score = 0;

    const mg = new MaskGenerator(this);

    this.pixels = mg.drawVersionFormat();

    for (let i = 0; i < this.byteMap.length; i++) {
      let symbol = this.symbols[i];

      this.byteMap[i].filter((that, j) => {
        const bitMask = mg.atCoord(that) === 0;
        const bitData = ((symbol >>> j) & 1) !== 0;

        return (bitData ^ bitMask);
      }).map((that) => {
        let { x, y } = that;

        if (y > 5) {
          y += 1;
        }

        this.pixels.push({ x, y });
      });
    }

    const edgeLengthSquared = this.edgeLength * this.edgeLength;
    const data = new Array(edgeLengthSquared).fill(0);

    this.pixels.forEach((that) => {
      data[that.y * this.edgeLength + that.x] = 1;
    });

    for (let y = 0; y < this.edgeLength; y++) {
      const runHorizontal = new ColorRun();
      const runVerticalSwappedCoords = new ColorRun();

      for (let x = 0; x < this.edgeLength; x++) {

        const c = x + y * this.edgeLength;
        const u = x * this.edgeLength + y;

        runHorizontal.append(data[c]);
        runVerticalSwappedCoords.append(data[u]);
      }

      this.score += runHorizontal.getPenalty();
      this.score += runVerticalSwappedCoords.getPenalty();
    }

    const oneLessThanEdgeLength = this.edgeLength - 1;
    for (let x = 0; x < oneLessThanEdgeLength; x++) {
      for (let y = 0; y < oneLessThanEdgeLength; y++) {
        const c = x + y * this.edgeLength;
        const d = c + 1;
        const e = c + this.edgeLength;
        const f = c + this.edgeLength + 1;

        if (data[c] === data[d] &&
          data[c] === data[e] &&
          data[c] === data[f]) {
          this.score += 3;
        }
      }
    }

    let black = 0;
    for (let i = 0; i < edgeLengthSquared; i++) {
      if (data[i] === 0) black++;
    }

    const offset = Math.abs(black * 2 - edgeLengthSquared) * 10;
    let k = 0;

    while (offset > (k + 1) * edgeLengthSquared) {
      k++;
      this.score += 10;
    }

    return;
  }

  toGif(options) {
    const {
      quietZone,
      scale
    } = options;

    const imageSizeEdge = (this.edgeLength + quietZone * 2) * scale;

    const data = new Array(imageSizeEdge * imageSizeEdge).fill(0);

    this.pixels.forEach((that) => {
      const position = (that.y + quietZone) * this.scale * imageSizeEdge + ((that.x + quietZone) * this.scale);

      if (this.scale <= 1) {
        data[position] = 1;
        return;
      }

      for (let yp = this.scale; yp--;) {
        for (let xp = this.scale; xp--;) {
          data[position + imageSizeEdge * yp + xp] = 1;
        }
      }
    });

    const byteArray = [];
    const gif = new omggif.GifWriter(byteArray, imageSizeEdge, imageSizeEdge);
    gif.addFrame(0, 0, imageSizeEdge, imageSizeEdge, data, {
      palette: [
        0xffffff,
        0x000000
      ]
    });

    return Buffer.from(byteArray);
  }
}

class Encoder {
  constructor(options) {
    this.scale = 2;
    this.quietZone = 1;

    Object.assign(this, options);
  }

  encodeShortUrl23(data) {
    if (!/^[0-9A-Z\$\%\*\+\-\.\/\:]{23}$/.test(data)) {
      throw Error('Malformatted URI');
    }

    const unpacked = [];
    for (let i = 0; i < data.length; i += 1) {
      const byte = data.charCodeAt(i);
      unpacked.push(ToAlphaSet(byte));
    }

    const packed = [];
    for (let i = 0; i < 21; i += 2) {
      packed.push(unpacked[i] * 45 + unpacked[i + 1]);
    }
    packed.push(unpacked[22]);

    let len = data.length;
    this.symbols = [
      0x20,
      (len << 3) + (packed[0] >> 8),
      packed[0] & 0xFF,
      packed[1] >> 3,
      ((packed[1] << 5) & 0xFF) + (packed[2] >> 6),
      ((packed[2] << 2) & 0xFF) + (packed[3] >> 9),
      (packed[3] >> 1) & 0xFF,
      ((packed[3] << 7) & 0xFF) + (packed[4] >> 4),
      ((packed[4] << 4) & 0xFF) + (packed[5] >> 7),
      ((packed[5] << 1) & 0xFF) + (packed[6] >> 10),
      (packed[6] >> 2) & 0xFF,
      ((packed[6] << 6) & 0xFF) + (packed[7] >> 5),
      ((packed[7] << 3) & 0xFF) + (packed[8] >> 8),
      packed[8] & 0xFF,
      packed[9] >> 3,
      ((packed[9] << 5) & 0xFF) + (packed[10] >> 6),
      ((packed[10] << 2) & 0xFF) + (packed[11] >> 4),
      (packed[11] << 4) & 0xF0
    ];

    this.selectSymbolDimensions();
    this.generateEcc();
    this.writeSymbols();

    return this;
  }

  selectSymbolDimensions() {
    this.ecc = 7;
    this.capacity = 19;
    this.edgeLength = 21;

    return this;
  }

  generateEcc() {
    while (this.symbols.length < this.capacity) {
      this.symbols.push(0xec);
      if (this.symbols.length < this.capacity)
        this.symbols.push(0x00);
    }

    const rse = ReedSolomonEncoder.factory(this.ecc);
    this.symbols = rse.encode(this.symbols);
  }

  draw(coord) {
    this.pixels.push(coord);
  }

  writeSymbols() {
    const dt = new QRCodeByteMap(this);
    this.byteMap = dt.byteMap;

    dt.writeUp({ col: 20, row: 19 }, 3);
    dt.writeDn({ col: 18, row: 8 }, 3);
    dt.writeUp({ col: 16, row: 19 }, 3);
    dt.writeDn({ col: 14, row: 8 }, 3);
    dt.writeUp({ col: 12, row: 19 }, 5);
    dt.writeDn({ col: 10, row: 0 }, 5);
    dt.writeUp({ col: 8, row: 11 }, 1);
    dt.writeDn({ col: 5, row: 8 }, 1);
    dt.writeUp({ col: 3, row: 11 }, 1);
    dt.writeDn({ col: 1, row: 8 }, 1);
  }

  renderGif() {
    const allocations = [];

    for (let mask = 0; mask < 8; mask++) {
      this.mask = mask;
      allocations.push(new AllocPixels(this));
    }

    let bestMask = 0;
    let bestScore = Infinity;

    for (let mask = 0; mask < 8; mask++) {
      const score = allocations[mask].score;
      if (score >= bestScore) continue;
      bestScore = score;
      bestMask = mask;
    }

    return allocations[bestMask].toGif(this);
  }
}

module.exports = Encoder;
