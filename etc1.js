// * Based on https://github.com/infval/AMLUnpacker_TrueRemembrance/blob/master/AMLUnpacker_Python/etc1decoder.py
const Jimp = require('jimp');

const ETC1_LOOK_UP_TABLE = [
	[2 , 8  , -2 , -8  ],
	[5 , 17 , -5 , -17 ],
	[9 , 29 , -9 , -29 ],
	[13, 42 , -13, -42 ],
	[18, 60 , -18, -60 ],
	[24, 80 , -24, -80 ],
	[33, 106, -33, -106],
	[47, 183, -47, -183]
];

class ETC1 {
	constructor(size, etc1, alpha) {
		this.size = size;
		this.etc1 = etc1;
		this.alpha = alpha;
	}

	intToS8(n) {
		n &= 0xFF;

		if (n & 0x80) {
			n -= 0x100;
		}

		return n;
	}

	decode(data, width, height, alpha) {
		const output = Buffer.alloc(width * height * 4);

		const decodedData = this.etc1Decode(data, width, height, alpha);
		const etc1Order = this.etc1Scramble(width, height);

		let i = 0;
		for (let tY = 0; tY < Math.floor(height / 4); tY++) {
			for (let tX = 0; tX < Math.floor(height / 4); tX++) {
				const TX = etc1Order[i] % Math.floor(width / 4);
				const TY = Math.floor((etc1Order[i] - TX) / Math.floor(width / 4));

				//console.log('i', i, 'TX', TX, 'TY', TY);

				for (let y = 0; y < 4; y++) {
					for (let x = 0; x < 4; x++) {
						const dataOffset   = ((TX * 4) + x + ((TY * 4 + y) * width)) * 4;
						const outputOffset = ((tX * 4) + x + ((tY * 4 + y) * width)) * 4;

						output.fill(decodedData.subarray(dataOffset, dataOffset + 4), outputOffset, outputOffset+4);
					}
				}
				i += 1;
			}
		}

		return output;
	}

	etc1Decode(input, width, height, alpha) {
		const output = Buffer.alloc(width * height * 4);
		let offset = 0;

		for (let y = 0; y < Math.floor(height / 4); y++) {
			for (let x = 0; x < Math.floor(width / 4); x++) {
				let colorBlock = Buffer.alloc(8);
				const alphaBlock = Buffer.alloc(8);

				if (alpha) {
					for (let i = 0; i < 8; i++) {
						colorBlock[7 - i] = input[offset + 8 + i];
						alphaBlock[i] = input[offset + i];
					}

					offset += 16;
				} else {
					for (let i = 0; i < 8; i++) {
						colorBlock[7 - i] = input[offset + i];
						alphaBlock[i] = 0xff;
					}

					offset += 8;
				}

				colorBlock = this.etc1DecodeBlock(colorBlock);

				let toggle = false;
				let alphaOffset = 0;
				for (let tX = 0; tX < 4; tX++) {
					for (let tY = 0; tY < 4; tY++) {
						const outputOffset = (x * 4 + tX + ((y * 4 + tY) * width)) * 4;
						const blockOffset = (tX + (tY * 4)) * 4;

						output.fill(colorBlock.subarray(blockOffset, blockOffset + 3), outputOffset, outputOffset+3);
						let a;

						if (toggle) {
							a = (alphaBlock[alphaOffset] & 0xf0) >> 4;
							alphaOffset += 1;
						} else {
							a = (alphaBlock[alphaOffset] & 0x0f);
						}

						output[outputOffset + 3] = (a << 4) | a;
						toggle = !toggle;
					}
				}
			}
		}

		return output;
	}

	etc1DecodeBlock(data) {
		const blockTop	= data.readUInt32LE();
		const blockBottom = data.readUInt32LE(4);

		const flip = (blockTop & 0x1000000) > 0;
		const difference = (blockTop & 0x2000000) > 0;

		let r1 = 0;
		let g1 = 0;
		let b1 = 0;
		let r2 = 0;
		let g2 = 0;
		let b2 = 0;

		if (difference) {
			r1 = (blockTop & 0x0000f8);
			g1 = (blockTop & 0x00f800) >> 8;
			b1 = (blockTop & 0xf80000) >> 16;

			r2 = (r1 >> 3) + (this.intToS8((blockTop & 0x00007) <<  5) >> 5);
			g2 = (g1 >> 3) + (this.intToS8((blockTop & 0x00700) >>  3) >> 5);
			b2 = (b1 >> 3) + (this.intToS8((blockTop & 0x70000) >> 11) >> 5);

			r1 |= r1 >> 5;
			g1 |= g1 >> 5;
			b1 |= b1 >> 5;

			r2 = (r2 << 3) | (r2 >> 2);
			g2 = (g2 << 3) | (g2 >> 2);
			b2 = (b2 << 3) | (b2 >> 2);
		} else {
			r1 = (blockTop & 0x0000f0);
			g1 = (blockTop & 0x00f000) >> 8;
			b1 = (blockTop & 0xf00000) >> 16;

			r2 = (blockTop & 0x00000f) << 4;
			g2 = (blockTop & 0x000f00) >> 4;
			b2 = (blockTop & 0x0f0000) >> 12;

			r1 |= r1 >> 4;
			g1 |= g1 >> 4;
			b1 |= b1 >> 4;

			r2 |= r2 >> 4;
			g2 |= g2 >> 4;
			b2 |= b2 >> 4;
		}

		const table1 = (blockTop >> 29) & 7;
		const table2 = (blockTop >> 26) & 7;

		const output = Buffer.alloc(4 * 4 * 4);

		if (!flip) {
			for (let y = 0; y < 4; y++) {
				for (let x = 0; x < 2; x++) {
					const color1 = this.etc1Pixel(r1, g1, b1, x, y, blockBottom, table1);
					const color2 = this.etc1Pixel(r2, g2, b2, x + 2, y, blockBottom, table2);

					let offset = (y * 4 + x) * 4;
					output.fill(Buffer.from(color1), offset, offset+3);

					offset = (y * 4 + x + 2) * 4;
					output.fill(Buffer.from(color2), offset, offset+3);

					//console.log(r1, g1, b1, x	, y, blockBottom, table1);
					//console.log('-------');
				}
			}
		} else {
			for (let y = 0; y < 2; y++) {
				for (let x = 0; x < 4; x++) {
					const color1 = this.etc1Pixel(r1, g1, b1, x, y, blockBottom, table1);
					const color2 = this.etc1Pixel(r2, g2, b2, x, y + 2, blockBottom, table2);

					let offset = (y * 4 + x) * 4;
					output.fill(Buffer.from(color1), offset, offset+3);

					offset = ((y + 2) * 4 + x) * 4;
					output.fill(Buffer.from(color2), offset, offset+3);
				}
			}
		}

		return output;
	}

	etc1Pixel(r, g, b, x, y, block, table) {
		const index = x * 4 + y;
		const MSB = block << 1;
		let pixel;

		if (index < 8) {
			pixel = ETC1_LOOK_UP_TABLE[table][((block >> (index + 24)) & 1) + ((MSB >> (index + 8)) & 2)];
		} else {
			pixel = ETC1_LOOK_UP_TABLE[table][((block >> (index +  8)) & 1) + ((MSB >> (index - 8)) & 2)];
		}

		r = this.saturate(r + pixel);
		g = this.saturate(g + pixel);
		b = this.saturate(b + pixel);

		return [r, g, b];
	}

	saturate(value) {
		if (value > 0xff) {
			return 0xff;
		} if (value < 0) {
			return 0;
		}
		return value;
	}

	etc1Scramble(width, height) {
		const tileScramble = new Array(Math.floor(width / 4) * Math.floor(height / 4));
		let baseAccumulator = 0;
		let rowAccumulator = 0;
		let baseNumber = 0;
		let rowNumber = 0;

		for (let tile = 0; tile < tileScramble.length; tile++) {
			if ((tile % Math.floor(width / 4) == 0) && tile > 0) {
				if( rowAccumulator < 1) {
					rowAccumulator += 1;
					rowNumber += 2;
					baseNumber = rowNumber;
				} else {
					rowAccumulator = 0;
					baseNumber -= 2;
					rowNumber = baseNumber;
				}
			}

			tileScramble[tile] = baseNumber;

			if (baseAccumulator < 1) {
				baseAccumulator += 1;
				baseNumber += 1;
			} else {
				baseAccumulator = 0;
				baseNumber += 3;
			}
		}

		return tileScramble;
	}

	async toPNGBase64URI() {
		const width = this.size;
		const height = this.size;

		const decoded = this.decode(this.etc1, width, height, this.alpha);

		const image = new Jimp({
			data: decoded,
			width,
			height
		});

		return image.getBase64Async(Jimp.MIME_PNG);
	}
}

module.exports = ETC1;