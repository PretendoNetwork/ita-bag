const Stream = require('./stream');
const RGB565 = require('./rgb565');
const ETC1 = require('./etc1');

const MAGIC = Buffer.from('PRBS');

class PRBS {
	constructor(buffer) {
		this.stream = new Stream(buffer);

		this.parse();
	}

	parse() {
		const magicCheck = this.stream.readBytes(4);

		if (!MAGIC.equals(magicCheck)) {
			throw new Error('Wrong PRBS magic');
		}

		const fileVersion = this.stream.readUInt32LE();

		if (fileVersion !== 0x3) {
			throw new Error('Wrong PRBS version');
		}

		this.stream.skip(0x4); // * Skip file length
		const headerStartAddress = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Skip Header end address
		const displayNamesStartAddress = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Skip display names end address
		const images32x32And64x64StartAddress = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Skip 32x32 and 64x64 images end address
		this.stream.skip(0x4); // * Skip optional images end address
		const image128x128StartAddress = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Skip 128x128 image end address
		const collisionDataStartAddress = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Skip collision data end address

		this.readHeader(headerStartAddress);

		this.readDisplayNames(displayNamesStartAddress);
		this.read32x32And64x64Images(images32x32And64x64StartAddress);
		this.read128x128Image(image128x128StartAddress);
		this.readCollisionData(collisionDataStartAddress);
	}

	readHeader(startAddress) {
		this.stream.seek(startAddress);

		this.id = this.stream.readUInt32LE();
		this.stream.skip(0x4); // * Unknown, usually 0?
		this.fileName = this.stream.readBytes(0x30).toString().replace(/\0/g, '');
		this.category = this.stream.readBytes(0x30).toString().replace(/\0/g, '');
		this.titleID = this.stream.readUInt64LE();
		this.stream.skip(0x4); // * Unknown, usually same as first unknown?
		this.stream.skip(0x4); // * Unknown signed int
		this.stream.skip(0x4); // * Unknown signed int
		this.horizontalTiles = this.stream.readUInt32LE();
		this.verticalTiles = this.stream.readUInt32LE();
		this.stream.skip(0x10); // * Unknown, usually always zero when 1x1 tile?
		this.fullImageWidthScale = this.stream.readFloatLE();
		this.fullImageHeightScale = this.stream.readFloatLE();
		this.stream.skip(0x8); // * Unknown, usually always zero when 1x1 tile?
	}

	readDisplayNames(startAddress) {
		this.stream.seek(startAddress);

		this.displayNames = {
			japanese: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			english: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			french: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			german: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			italian: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			spanish: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			chineseSimple: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			korean: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			dutch: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			portuguese: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			russian: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			chineseTraditional: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			unknown1: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			unknown2: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			unknown3: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, ''),
			unknown4: this.stream.readBytes(0x100).toString('utf16le').replace(/\0/g, '')
		};
	}

	read32x32And64x64Images(startAddress) {
		this.stream.seek(startAddress);

		const rgb5656_64x64 = this.stream.readBytes(0x2000);
		const a4_64x64 = this.stream.readBytes(0x800);

		const rgb5656_32x32 = this.stream.readBytes(0x800);
		const a4_32x32 = this.stream.readBytes(0x200);

		this.images = {
			small: new RGB565(32, rgb5656_32x32, a4_32x32),
			medium: new RGB565(64, rgb5656_64x64, a4_64x64)
		};
	}

	read128x128Image(startAddress) {
		this.stream.seek(startAddress);

		const etc1a4_128x128 = this.stream.readBytes(0x4000);

		// TODO - Use A8 data
		const a8_128x128 = this.stream.readBytes(0x4000);

		this.images.large = new ETC1(128, etc1a4_128x128, true);
	}

	readCollisionData(startAddress) {
		this.stream.seek(startAddress);
	}
}

module.exports = PRBS;
