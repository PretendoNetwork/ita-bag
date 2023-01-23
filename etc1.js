const Jimp = require('jimp');
const { Buffer } = require('node:buffer');

const etc1LUT = [ [ 2, 8, -2, -8 ], [ 5, 17, -5, -17 ], [ 9, 29, -9, -29 ], [ 13, 42, -13, -42 ], [ 18, 60, -18, -60 ], [ 24, 80, -24, -80 ], [ 33, 106, -33, -106 ], [ 47, 183, -47, -183 ] ];


class ETC1 {
	constructor(size, etc1, alpha) {
		this.size = size;
		this.etc1 = etc1;
		this.alpha = alpha;
	}

	async toPNGBase64URI() {
		const width = this.size;
		const height = this.size;

		// * We first convert the image to RGBA8 and store it on output
		let output = Buffer.alloc(width * height * 4);
		const image = new Jimp(width, height);

		// * this.alpha is a boolean to tell the decoder to use ETC1A4 instead of ETC1.
		// * This is done to enable compatibility with both formats, as they are both used in game.
		const decodedData = this.etc1Decode(this.etc1, width, height, this.alpha);

		//  The 3DS doesn't use Z-order for ETC1, but it scrambles the pixels on a specific way
		const etc1Order = this.etc1Scramble(width, height);

		let i = 0;
		for (let tY = 0; tY < height / 4; tY++) {
			for (let tX = 0; tX < width / 4; tX++) {
				const TX = etc1Order[i] % (width / 4);
				const TY = (etc1Order[i] - TX) / (width / 4);
				for (let y = 0; y < 4; y++) {
					for (let x = 0; x < 4; x++) {
						const dataOffset = ((TX * 4) + x + (((TY * 4) + y) * width)) * 4;
						const outputOffset = ((tX * 4) + x + (((tY * 4 + y)) * width)) * 4;

						for (let offset = 0; offset < 4; offset++)
						{
							output[outputOffset + offset] = decodedData[dataOffset + offset];
						}
					}
				}
				i += 1;
			}
		}

		// * Since we don't use Z-order, we can iterate over all pixels like normal
		i = 0;
		for (let currentY = 0; currentY < height; currentY++)
		{
			for (let currentX = 0; currentX < width; currentX++)
			{
				const r = output.readUint8(i);
				const g = output.readUint8(i + 1);
				const b = output.readUint8(i + 2);
				const a = output.readUint8(i + 3);
				i += 4;

				const color = Jimp.rgbaToInt(r, g, b, a);

				image.setPixelColor(color, currentX, currentY);
			}
		}

		return image.getBase64Async(Jimp.MIME_PNG);
	}

	etc1Decode(input, width, height, alpha)
	{
		let output = Buffer.alloc(width * height * 4);
		let offset = 0;

		// * Decode using 4x4 blocks
		for (let y = 0; y < height / 4; y++)
		{
			for (let x = 0; x < width / 4; x++)
			{
				let colorBlock = Buffer.alloc(8);
				let alphaBlock = Buffer.alloc(8);

				// * Decode as ETC1A4 if alpha is enabled. Decode as ETC1 if we don't
				if (alpha)
				{
					for (let i = 0; i < 8; i++)
					{
						colorBlock[7 - i] = input[offset + 8 + i];
						alphaBlock[i] = input[offset + i];
					}
					offset += 16;
				}
				else
				{
					for (let i = 0; i < 8; i++)
					{
						colorBlock[7 - i] = input[offset + i];
						alphaBlock[i] = 0xff;
					}
					offset += 8;
				}

				colorBlock = this.etc1DecodeBlock(colorBlock);

				let toggle = false;
				let alphaOffset = 0;
				for (let tX = 0; tX < 4; tX++)
				{
					for (let tY = 0; tY < 4; tY++)
					{
						const outputOffset = (x * 4 + tX + ((y * 4 + tY) * width)) * 4;
						const blockOffset = (tX + (tY * 4)) * 4;
						for (let offset = 0; offset < 3; offset++)
						{
							output[outputOffset + offset] = colorBlock[blockOffset + offset];
						}

						const a = toggle ? ((alphaBlock[alphaOffset++] & 0xf0) >> 4) : (alphaBlock[alphaOffset] & 0xf);
						output[outputOffset + 3] = (a << 4) | a;
						toggle = !toggle;
					}
				}
			}
		}

		return output;
	}

	etc1DecodeBlock(data)
	{
		const blockTop = data.readUint32LE();
		const blockBottom = data.readUint32LE(4);

		const flip = (blockTop & 0x1000000) > 0;
		const difference = (blockTop & 0x2000000) > 0;

		let r1, g1, b1;
		let r2, g2, b2;

		if (difference)
		{
			r1 = blockTop & 0xf8;
			g1 = (blockTop & 0xf800) >> 8;
			b1 = (blockTop & 0xf80000) >> 16;

			r2 = (r1 >> 3) + (((blockTop & 7) << 5) >> 5);
			g2 = (g1 >> 3) + (((blockTop & 0x700) >> 3) >> 5);
			b2 = (b1 >> 3) + (((blockTop & 0x70000) >> 11) >> 5);

			r1 |= r1 >> 5;
			g1 |= g1 >> 5;
			b1 |= b1 >> 5;

			r2 = (r2 << 3) | (r2 >> 2);
			g2 = (g2 << 3) | (g2 >> 2);
			b2 = (b2 << 3) | (b2 >> 2);
		}
		else
		{
			r1 = blockTop & 0xf0;
			g1 = (blockTop & 0xf000) >> 8;
			b1 = (blockTop & 0xf00000) >> 16;

			r2 = (blockTop & 0xf) << 4;
			g2 = (blockTop & 0xf00) >> 4;
			b2 = (blockTop & 0xf0000) >> 12;

			r1 |= r1 >> 4;
			g1 |= g1 >> 4;
			b1 |= b1 >> 4;

			r2 |= r2 >> 4;
			g2 |= g2 >> 4;
			b2 |= b2 >> 4;
		}

		const table1 = (blockTop >> 29) & 7;
		const table2 = (blockTop >> 26) & 7;

		let output = Buffer.alloc(4 * 4 * 4);

		if (!flip)
		{
			for (let y = 0; y <= 3; y++)
			{
				for (let x = 0; x <= 1; x++)
				{
					const [blueColor1, greenColor1, redColor1] = this.etc1Pixel(r1, g1, b1, x, y, blockBottom, table1);
					const [blueColor2, greenColor2, redColor2] = this.etc1Pixel(r2, g2, b2, x + 2, y, blockBottom, table2);

					const offset1 = (y * 4 + x) * 4;
					output[offset1] = blueColor1;
					output[offset1 + 1] = greenColor1;
					output[offset1 + 2] = redColor1;

					const offset2 = (y * 4 + x + 2) * 4;
					output[offset2] = blueColor2;
					output[offset2 + 1] = greenColor2;
					output[offset2 + 2] = redColor2;
				}
			}
		}
		else
		{
			for (let y = 0; y <= 1; y++)
			{
				for (let x = 0; x <= 3; x++)
				{
					const [blueColor1, greenColor1, redColor1] = this.etc1Pixel(r1, g1, b1, x, y, blockBottom, table1);
					const [blueColor2, greenColor2, redColor2] = this.etc1Pixel(r2, g2, b2, x, y + 2, blockBottom, table2);

					const offset1 = (y * 4 + x) * 4;
					output[offset1] = blueColor1;
					output[offset1 + 1] = greenColor1;
					output[offset1 + 2] = redColor1;

					const offset2 = ((y + 2) * 4 + x) * 4;
					output[offset2] = blueColor2;
					output[offset2 + 1] = greenColor2;
					output[offset2 + 2] = redColor2;
				}
			}
		}

		return output;
	}

	etc1Pixel(r, g, b, x, y, block, table)
	{
		const index = x * 4 + y;
		const MSB = block << 1;

		// * The pixels require to be saturated with the value specified by the look up table
		const pixel = index < 8
			? etc1LUT[table][((block >> (index + 24)) & 1) + (MSB >> (index + 8)) & 2]
			: etc1LUT[table][((block >> (index + 8)) & 1) + (MSB >> (index - 8)) & 2];

		r = this.saturate(r + pixel);
		g = this.saturate(g + pixel);
		b = this.saturate(b + pixel);

		return [r, g, b];
	}

	saturate(value)
	{
		if (value > 0xff) return 0xff;
		if (value < 0) return 0;
		return value & 0xff;
	}

	etc1Scramble(width, height)
	{
		// * Scramble the pixels on 4x4 tiles
		let tileScramble = Buffer.alloc((width / 4) * (height / 4));
		let baseAccumulator = 0;
		let rowAccumulator = 0;
		let baseNumber = 0;
		let rowNumber = 0;

		for (let tile = 0; tile < tileScramble.length; tile++)
		{
			if ((tile % (width / 4) == 0) && tile > 0)
			{
				if (rowAccumulator < 1)
				{
					rowAccumulator += 1;
					rowNumber += 2;
					baseNumber = rowNumber;
				}
				else
				{
					rowAccumulator = 0;
					baseNumber -= 2;
					rowNumber = baseNumber;
				}
			}

			tileScramble[tile] = baseNumber;

			if (baseAccumulator < 1)
			{
				baseAccumulator++;
				baseNumber++;
			}
			else
			{
				baseAccumulator = 0;
				baseNumber += 3;
			}
		}

		return tileScramble;
	}
}

module.exports = ETC1;
