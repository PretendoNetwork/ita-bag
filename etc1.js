// * Based on https://github.com/infval/AMLUnpacker_TrueRemembrance/blob/master/AMLUnpacker_Python/etc1decoder.py
// * ETC1 block encoding based on https://github.com/IcySon55/Kuriimu/blob/master/src/Kontract/Image/Support/ETC1.cs
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

class ETC1Solution {
	constructor(error) {
		this.error = error;
	}
}

class ETC1SolutionSet {
	constructor(flip = 0, difference = 0, soln0 = undefined, soln1 = undefined) {
		this.flip = flip;
		this.difference = difference;
		// Both soln0 or soln1 have to be defined or undefined equally.
		// We will use soln0 to determine this
		if (soln0) {
			this.soln0 = soln0;
			this.soln1 = soln1;
		} else {
			this.soln1 = new ETC1Solution(Number.MAX_SAFE_INTEGER);
			this.soln0 = new ETC1Solution(Number.MAX_SAFE_INTEGER);
		}

	}

	totalError() {
		return this.soln0.error + this.soln1.error;
	}
}

class ETC1Optimizer {
	constructor(r, g, b, limit, error) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.limit = limit;
		this.baseR = this.average(r) * (limit / 256);
		this.baseG = this.average(g) * (limit / 256);
		this.baseB = this.average(b) * (limit / 256);
		this.bestSoln = new ETC1Solution(error);
	}

	average(array) {
		const sum = array.reduce((prev, current) => prev + current, 0);
		const average = sum / array.length;
		return Math.round(average);
	}

	limitValue(value) {
		if (value > this.limit) {
			return this.limit;
		} if (value < 0) {
			return 0;
		}
		return value;
	}

	scale(r, g, b, limit) {
		if (limit == 16) {
			return [r * 17, g * 17, b * 17];
		}

		return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2)];
	}

	computeDeltas(deltas) {
		let x = [];
		let y = [];
		let z = [];

		for (let i = 0; i < deltas.length; i++) {
			x.push(this.limitValue(deltas[i] + this.baseR));
			y.push(this.limitValue(deltas[i] + this.baseG));
			z.push(this.limitValue(deltas[i] + this.baseB));
		}

		return this.testUnscaledColors(x, y, z);
	}

	testUnscaledColors(r, g, b) {
		let success = false;

		// All color arrays should have the same length, so we'll iterate using red
		for (let i = 0; i < r.length; i++) {
			for (let modifierIndex = 0; modifierIndex < ETC1_LOOK_UP_TABLE.length; modifierIndex++) {
				if (this.evaluateSolution(r[i], g[i], b[i], modifierIndex)) {
					success = true;
					if (this.bestSoln.error == 0) return true;
				}
			}
		}
		return success;
	}

	evaluateSolution(r, g, b, intenTable) {
		let soln = new ETC1Solution(0);

		soln.blockR = r;
		soln.blockG = g;
		soln.blockB = b;
		soln.intenTable = intenTable;

		let newTableR = new Array(4);
		let newTableG = new Array(4);
		let newTableB = new Array(4);
		const scaledColor = this.scale(r, g, b, this.limit);
		for (let i = 0; i < 4; i++) {
			newTableR[i] = scaledColor[0] + ETC1_LOOK_UP_TABLE[intenTable][i];
			newTableG[i] = scaledColor[1] + ETC1_LOOK_UP_TABLE[intenTable][i];
			newTableB[i] = scaledColor[2] + ETC1_LOOK_UP_TABLE[intenTable][i];
		}

		for (let i = 0; i < 8; i++) {
			let bestJ = 0;
			let bestError = Number.MAX_SAFE_INTEGER;
			for (let j = 0; j < 3; j++) {
				let error = this.r[i] - newTableR[j];
				error += this.g[i] - newTableG[j];
				error += this.b[i] - newTableB[j];
				if (error < bestError)
				{
					bestError = error;
					bestJ = j;
				}
			}
			soln.error += bestError;
			if (soln.error >= this.bestSoln.error) return false;
			soln.selectorMSB |= (bestJ / 2 << i);
			soln.selectorLSB |= (bestJ % 2 << i);
		}
		this.bestSoln = soln;
		return true;
	}
}

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

	allEqual(array) {
		return array.every( v => v === array[0] );
	}

	errorRGB(r, g, b) {
		return 2 * r * r + 4 * g * g + 3 * b * b; // human perception
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

	encode(data, width, height, alpha) {
		const etc1Scramble = Buffer.alloc(width * height * 4);
		const etc1Order = this.etc1Scramble(width, height);

		let i = 0;
		for (let tY = 0; tY < Math.floor(height / 4); tY++) {
			for (let tX = 0; tX < Math.floor(height / 4); tX++) {
				const TX = etc1Order[i] % Math.floor(width / 4);
				const TY = Math.floor((etc1Order[i] - TX) / Math.floor(width / 4));

				for (let y = 0; y < 4; y++) {
					for (let x = 0; x < 4; x++) {
						const scrambleOffset   = ((TX * 4) + x + ((TY * 4 + y) * width)) * 4;
						const dataOffset = ((tX * 4) + x + ((tY * 4 + y) * width)) * 4;

						etc1Scramble.fill(data.subarray(dataOffset, dataOffset + 4), scrambleOffset, scrambleOffset+4);
					}
				}
				i += 1;
			}
		}

		const output = this.etc1Encode(etc1Scramble, width, height, alpha);

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

	etc1Encode(input, width, height, alpha) {
		let output;
		if (alpha) {
			output = Buffer.alloc(width * height);
		} else {
			output = Buffer.alloc((width * height) / 2);
		}

		const r = Buffer.alloc(width * height);
		const g = Buffer.alloc(width * height);
		const b = Buffer.alloc(width * height);
		const a = Buffer.alloc(width * height);
		let offset = 0;
		for (let tileWalkerY = 0; tileWalkerY < (height / 4); tileWalkerY++) {
			for (let tileWalkerX = 0; tileWalkerX < (width / 4); tileWalkerX++) {
				for (let tileX = 0; tileX < 4; tileX++) {
					for (let tileY = 0; tileY < 4; tileY++) {
						const i = (tileWalkerY * 4 + tileY) * width + (tileWalkerX * 4 + tileX);
						r[offset / 4] = input[i * 4];
						g[offset / 4] = input[i * 4 + 1];
						b[offset / 4] = input[i * 4 + 2];
						a[offset / 4] = input[i * 4 + 3];
						offset += 4;
					}
				}
			}
		}

		for (let blockOffset = 0; blockOffset < Math.floor((width * height) / 16); blockOffset++) {
			let blockIndex = blockOffset * 8;
			if (alpha) {
				blockIndex *= 2;
			}

			const rBlock = r.subarray(blockOffset * 16, blockOffset * 16 + 16);
			const gBlock = g.subarray(blockOffset * 16, blockOffset * 16 + 16);
			const bBlock = b.subarray(blockOffset * 16, blockOffset * 16 + 16);
			const aBlock = a.subarray(blockOffset * 16, blockOffset * 16 + 16);

			const colorBlock = this.etc1EncodeBlock(rBlock, gBlock, bBlock);

			if (alpha) {
				let toggle = false;
				let a = 0;
				for (let alphaOffset = 0; alphaOffset < 16; alphaOffset++) {
					if (toggle) {
						a |= aBlock[alphaOffset] & 0xf0;
						output.fill(a, blockIndex + Math.floor(alphaOffset / 2), blockIndex + Math.floor(alphaOffset / 2) + 1);
						a = 0;
					} else {
						a |= aBlock[alphaOffset] >> 4;
					}

					toggle = !toggle;
				}

				output.fill(colorBlock, blockIndex + 8, blockIndex + 16);
			} else {
				output.fill(colorBlock, blockIndex, blockIndex + 8);
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

	etc1EncodeBlock(r, g, b) {
		const block = Buffer.alloc(8);

		let bestsolns = new ETC1SolutionSet();

		// Special case: all colors of this block are the same
		// TODO - Why this outputs black?
		/*
		if (this.allEqual(r) && this.allEqual(g) && this.allEqual(b)) {
			// TODO - Precompute this array?
			let solidColorLookup = [];
			for (let limit = 16; limit <= 32; limit += 16) {
				for (let modifierIndex = 0; modifierIndex < ETC1_LOOK_UP_TABLE.length; modifierIndex++) {
					for (let selector = 0; selector < ETC1_LOOK_UP_TABLE[modifierIndex].length; selector++) {
						for (let color = 0; color < 256; color++) {
							let packedColors = [];
							for (let packedColor = 0; packedColor < limit; packedColor++) {
								let c = 0;
								if (limit == 32) {
									c = (packedColor << 3) | (packedColor >> 2);
								} else {
									c = packedColor * 17;
								}
								packedColors.push((Math.abs(this.saturate(c + ETC1_LOOK_UP_TABLE[modifierIndex][selector]) - color) << 8) | packedColor);
							}
							solidColorLookup.push(Math.min(packedColors));
						}
					}
				}
			}

			let solutionsArray = [];
			for (let i = 0; i < 64; i++) {
				let red = solidColorLookup[i * 256 + r[0]];
				let green = solidColorLookup[i * 256 + g[0]];
				let blue = solidColorLookup[i * 256 + b[0]];

				const error = this.errorRGB(red >> 8, green >> 8, blue >> 8);

				let soln = new ETC1Solution(error);
				soln.blockR = red;
				soln.blockG = green;
				soln.blockB = blue;
				soln.intenTable = ETC1_LOOK_UP_TABLE[(i >> 2) & 7];

				if ((i & 2) == 2) {
					soln.selectorMSB = 0xFF;
				} else {
					soln.selectorMSB = 0;
				}

				if ((i & 1) == 1) {
					soln.selectorLSB = 0xFF;
				} else {
					soln.selectorLSB = 0;
				}

				solutionsArray.push(new ETC1SolutionSet(0, (i & 32) == 32, soln, soln));
			}

			solutionsArray.sort((a, b) => {
				return a.soln0.error - b.soln0.error;
			});

			bestsolns = solutionsArray[0];
		} else {
			*/
		if (true) {
			for (let flip = 0; flip < 2; flip++) {
				let arrayR1 = [];
				let arrayG1 = [];
				let arrayB1 = [];

				let arrayR2 = [];
				let arrayG2 = [];
				let arrayB2 = [];

				if (!flip) {
					for (let tileX = 0; tileX < 2; tileX++) {
						for (let tileY = 0; tileY < 4; tileY++) {
							const i = tileX * 4 + tileY;
							const i2 = (tileX + 2) * 4 + tileY;

							arrayR1.push(r[i]);
							arrayG1.push(g[i]);
							arrayB1.push(b[i]);

							arrayR2.push(r[i2]);
							arrayG2.push(g[i2]);
							arrayB2.push(b[i2]);
						}
					}
				} else {
					for (let tileY = 0; tileY < 2; tileY++) {
						for (let tileX = 0; tileX < 4; tileX++) {
							const i = tileX * 4 + tileY;
							const i2 = tileX * 4 + tileY + 2;

							arrayR1.push(r[i]);
							arrayG1.push(g[i]);
							arrayB1.push(b[i]);

							arrayR2.push(r[i2]);
							arrayG2.push(g[i2]);
							arrayB2.push(b[i2]);
						}
					}
				}

				for (let difference = 0; difference < 2; difference++) {
					let solns = [new ETC1Solution(), new ETC1Solution()];
					const limit = difference ? 32 : 16;
					let i;
					for (i = 0; i < 2; i++) {
						let errorThreshold = bestsolns.totalError();
						if (i == 1) errorThreshold -= solns[0].error;

						let opt;
						if (i == 1) {
							opt = new ETC1Optimizer(arrayR1, arrayG1, arrayB1, limit, errorThreshold);
						} else {
							opt = new ETC1Optimizer(arrayR2, arrayG2, arrayB2, limit, errorThreshold);
						}

						if (i == 1 && difference) {
							opt.baseR = solns[0].blockR;
							opt.baseG = solns[0].blockG;
							opt.baseB = solns[0].blockB;
							if (!opt.computeDeltas([-4, -3, -2, -1, 0, 1, 2, 3])) break;
						} else {
							if (!opt.computeDeltas([-4, -3, -2, -1, 0, 1, 2, 3, 4])) break;
							// TODO: Fix fairly arbitrary/unrefined thresholds that control how far away to scan for potentially better solutions.
							if (opt.bestSoln.error > 9000) {
								if (opt.bestSoln.error > 18000) {
									opt.computeDeltas([-8, -7, -6, -5, 5, 6, 7, 8]);
								} else {
									opt.computeDeltas([-5, 5]);
								}
							}
						}
						if (opt.bestSoln.error >= errorThreshold) break;
						solns[i] = opt.bestSoln;
					}
					if (i == 2) {
						let solnset = new ETC1SolutionSet(flip, difference, solns[0], solns[1]);
						if (solnset.totalError() < bestsolns.totalError()) {
							bestsolns = solnset;
						}
					}
				}
			}
		}

		let MSB = bestsolns.soln0.selectorMSB << 8 | bestsolns.soln1.selectorMSB;
		let LSB = bestsolns.soln0.selectorLSB << 8 | bestsolns.soln1.selectorLSB;

		if (bestsolns.flip) {
			let flipMSB = 0;
			let flipLSB = 0;
			for (let tileY = 0; tileY < 2; tileY++) {
				for (let tileX = 0; tileX < 4; tileX++) {
					const i = tileX * 4 + tileY;
					const i2 = tileY * 4 + tileX;

					flipMSB |= (MSB >> i) << i2;
					flipLSB |= (LSB >> i) << i2;
				}
			}

			MSB = flipMSB;
			LSB = flipLSB;
		}

		let blockBottom = MSB | LSB << 16;

		/*
		if (!flip) {
			for (let y = 0; y < 4; y++) {
				for (let x = 0; x < 2; x++) {
					const i = y * 4 + x;
					const i2 = y * 4 + x + 2;

					const index1 = this.etc1PixelIndex(r1, g1, b1, r[i], g[i], b[i], table1);
					const index2 = this.etc1PixelIndex(r2, g2, b2, r[i2], g[i2], b[i2], table2);

					let MSB = index1 >> 1;
					let LSB = index1 & 1;

					blockBottom |= MSB << (i + 16) | LSB << i;

					MSB = index2 >> 1;
					LSB = index2 & 1;

					blockBottom |= MSB << (i2 + 16) | LSB << i2;
				}
			}
		} else {
			for (let y = 0; y < 2; y++) {
				for (let x = 0; x < 4; x++) {
					const i = y * 4 + x;
					const i2 = (y + 2) * 4 + x;

					const index1 = this.etc1PixelIndex(r1, g1, b1, r[i], g[i], b[i], table1);
					const index2 = this.etc1PixelIndex(r2, g2, b2, r[i2], g[i2], b[i2], table2);

					let MSB = index1 >> 1;
					let LSB = index1 & 1;

					blockBottom |= MSB << (i + 16) | LSB << i;

					MSB = index2 >> 1;
					LSB = index2 & 1;

					blockBottom |= MSB << (i2 + 16) | LSB << i2;
				}
			}
		}

		r1 = r1 >> 4;
		g1 = g1 >> 4;
		b1 = b1 >> 4;

		r2 = r2 >> 4;
		g2 = g2 >> 4;
		b2 = b2 >> 4;
		*/

		let blockTop = (bestsolns.soln1.intenTable << 29) | (bestsolns.soln0.intenTable << 26) | (bestsolns.difference << 25) | (bestsolns.flip << 24);
		if (!bestsolns.difference) {
			blockTop |= (bestsolns.soln1.blockB << 20) | (bestsolns.soln0.blockB  << 16);
			blockTop |= (bestsolns.soln1.blockG << 12) | (bestsolns.soln0.blockG << 8);
			blockTop |= (bestsolns.soln1.blockR << 4) | bestsolns.soln0.blockR;
		} else {
			blockTop |= (bestsolns.soln1.blockB << 19) | (bestsolns.soln0.blockB << 16);
			blockTop |= (bestsolns.soln1.blockG << 11) | (bestsolns.soln0.blockG << 8);
			blockTop |= (bestsolns.soln1.blockR << 3) | bestsolns.soln0.blockR;
		}

		block.writeInt32BE(blockBottom);
		block.writeInt32BE(blockTop, 4);

		return block;
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
