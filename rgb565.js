const Jimp = require('jimp');

// * pre-computed to save time
const Z_VALUE_LOOKUP_TABLE = [
	[
		0, 2, 8, 10,
		32, 34, 40, 42
	],
	[
		1, 3, 9, 11,
		33, 35, 41, 43
	],
	[
		4, 6, 12, 14,
		36, 38, 44, 46
	],
	[
		5, 7, 13, 15,
		37, 39, 45, 47
	],
	[
		16, 18, 24, 26,
		48, 50, 56, 58
	],
	[
		17, 19, 25, 27,
		49, 51, 57, 59
	],
	[
		20, 22, 28, 30,
		52, 54, 60, 62
	],
	[
		21, 23, 29, 31,
		53, 55, 61, 63
	]
];

/*
 * ORIGINAL z VALUE CALCULATION
 *
 * THIS TAKES IN THE TILES CURRENT x,y
 * POSITION AND RETURNS z
 *
 * THIS WAS REMOVED FOR SPEED REASONS
 * IN FAVOR OF A LOOKUP TABLE
 *
 *
 *	function bits(num) {
 *		let ret = num;
 *		let loops = 0;
 *
 *		while(ret > 0) {
 *			ret /= 2;
 *			loops++;
 *		}
 *
 *		return loops;
 *	}
 *
 *	function getZFromXY(X, Y) {
 *		let Z = 0;
 *
 *		for (let bX = 0; bX <= bits(X); bX++) {
 *			Z += ((X & Math.pow(2, bX)) << bX);
 *		}
 *
 *		for (let bY = 0; bY <= bits(Y); bY++) {
 *			Z += ((Y & Math.pow(2, bY)) << (bY + 1));
 *		}
 *
 *		return Z;
 *	}
*/

class RGB565 {
	constructor(width, height, rgb565, a4) {
		this.width = width;
		this.height = height;
		this.rgb565 = rgb565;
		this.a4 = a4;
	}

	async toPNGBase64URI() {
		const width = this.width;
		const height = this.height;

		const image = new Jimp(width, height);

		// * Badge images are stored as rgb565 data using 8x8 tiles
		// * Loop over the images tiles
		for (let tileWalkerY = 0; tileWalkerY < height / 8; tileWalkerY++) {
			for (let tileWalkerX = 0; tileWalkerX < width / 8; tileWalkerX++) {

				// * Loop over the current 8x8 tile x,y
				for (let tileY = 0; tileY < 8; tileY++) {
					for (let tileX = 0; tileX < 8; tileX++) {
						// * The real x,y of the pixel about to be set
						const x = tileX + tileWalkerX * 8;
						const y = tileY + tileWalkerY * 8;

						// * Tile colors use a z value to calculate the index
						// * see above code for details
						const z = Z_VALUE_LOOKUP_TABLE[tileX][tileY];

						// * Actual color index
						const i = z + (tileWalkerY * 8 * width) + (tileWalkerX * 64);

						const rgb = this.rgb565.readUint16LE(i * 2);

						const r = (rgb & 0b1111100000000000) >> 8;
						const g = (rgb & 0b0000011111100000) >> 3;
						const b = (rgb & 0b0000000000011111) << 3;
						const a = this.a4 ? (this.a4[Math.floor(i / 2)] >> (4 * (i % 2)) & 0x0F) * 0x11 : 0xFF;

						const color = Jimp.rgbaToInt(r, g, b, a);

						image.setPixelColor(color, x, y);
					}
				}
			}
		}

		return image.getBase64Async(Jimp.MIME_PNG);
	}

	async fromImage(image, alpha) {
		this.width = image.bitmap.width;
		this.height = image.bitmap.height;

		this.rgb565 = Buffer.alloc(this.width * this.height * 2);

		if (alpha) {
			this.a4 = Buffer.alloc(Math.floor(this.width * this.height / 2));
		}

		// * Badge images are stored as rgb565 data using 8x8 tiles
		// * Loop over the images tiles
		for (let tileWalkerY = 0; tileWalkerY < this.height / 8; tileWalkerY++) {
			for (let tileWalkerX = 0; tileWalkerX < this.width / 8; tileWalkerX++) {

				// * Loop over the current 8x8 tile x,y
				for (let tileY = 0; tileY < 8; tileY++) {
					for (let tileX = 0; tileX < 8; tileX++) {
						// * The real x,y of the pixel about to be set
						const x = tileX + tileWalkerX * 8;
						const y = tileY + tileWalkerY * 8;

						// * Tile colors use a z value to calculate the index
						// * see above code for details
						const z = Z_VALUE_LOOKUP_TABLE[tileX][tileY];

						// * Actual color index
						const i = z + (tileWalkerY * 8 * this.width) + (tileWalkerX * 64);

						const rgba = image.getPixelColor(x, y);

						let {r, g, b, a} = Jimp.intToRGBA(rgba);

						r = r >> 3;
						g = g >> 2;
						b = b >> 3;

						if (alpha) {
							a = a >> 4 << (4 * (i % 2));
							this.a4[Math.floor(i / 2)] |= a;
						}

						const color = r << 11 | g << 5 | b;

						this.rgb565.writeUint16LE(color, i * 2);
					}
				}
			}
		}
	}
}

module.exports = RGB565;
