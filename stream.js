class Stream {
	/**
	 *
	 * @param {Buffer} buffer Buffer object
	 */
	constructor(buffer) {
		this._buffer = buffer;
		this._offset = 0;
	}

	/**
	 *
	 * @param {number} value Bytes to skip
	 */
	skip(value) {
		this._offset += value;
	}

	/**
	 *
	 * @param {number} offset Address to seek to
	 */
	seek(offset) {
		this._offset = offset;
	}

	/**
	 *
	 * @param {number} len Bytes to read
	 * @returns {Buffer} Read bytes
	 */
	read(len) {
		const read = this._buffer.subarray(this._offset, this._offset + len);
		this._offset += len;

		return read;
	}

	/**
	 *
	 * @param {number} len Bytes to read
	 * @returns {Buffer} Read bytes
	 */
	readBytes(len) {
		return this.read(len);
	}

	/**
	 *
	 * @returns {number} Read number
	 */
	readUInt32LE() {
		return this.readBytes(4).readUInt32LE();
	}

	/**
	 *
	 * @returns {number} Read number
	 */
	readUInt64LE() {
		return this.readBytes(8).readBigUInt64LE();
	}

	/**
	 *
	 * @returns {number} Read float
	 */
	readFloatLE() {
		return this.readBytes(4).readFloatLE();
	}
}

module.exports = Stream;