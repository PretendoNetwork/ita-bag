const { SarcFile } = require('@themezernx/sarclib/dist');
const { decompressYaz0 } = require('@themezernx/yaz0lib/dist');

export const VIRTUAL_ARCHIVE = {};

/**
 * Unpacks a SARC archive into the given object
 *
 * @param {SarcFile} sarc SARC file to unpack
 * @param {object} root Destination object
 */
export function sarcToObject(sarc, root) {
	for (const entry of sarc.getFiles()) {
		const parts = entry.name.split('/');
		let fileName = parts.pop();

		let branch = root;
		for (const part of parts) {
			if (!branch[part]) {
				branch[part] = {};
			}

			branch = branch[part];
		}

		const fileNameParts = fileName.split('.');
		const extension = fileNameParts.pop();
		let { data } = entry;

		if (extension === 'sarc') {
			fileName = fileNameParts[0];

			const sarc = new SarcFile();
			sarc.load(data);

			branch[fileName] = {};

			sarcToObject(sarc, branch[fileName]);

			continue;
		}

		if (extension === 'szs' && data.subarray(0, 4).toString() === 'Yaz0') {
			fileName = fileNameParts.join('.');

			data = decompressYaz0(data);
		}

		if (fileName === 'Pr_Amiibo1_Chara_Diddy00.prb') {
			const fs = require('node:fs');

			fs.writeFileSync(`./${fileName}`, data);
		}

		branch[fileName] = data;
	}
}

/**
 * Packs an object into a SARC archive
 *
 * @param {object} root Object to pack
 * @param {SarcFile} sarc SARC destination
 * @param {String} currentPath Path of current object to save
 */
export function objectToSarc(object, sarc=new SarcFile, path='') {
	let childElement;

	for (const key in object) {
		const value = object[key];
		let childElement;
		let newPath;

		if(path != '') { newPath = `${path}/${key}` } else {newPath = key}

		if (value.constructor === Object) {
			// * Value is a folder, keep iterating
			childElement = objectToSarc(value, sarc, newPath);
		} else {
			// * Value is a file, add it to the sarc
			sarc.addRawFile(value, newPath);
		}
	}
	return sarc;
}