const { SarcFile } = require('@themezernx/sarclib/dist');
const { decompressYaz0 } = require('@themezernx/yaz0lib/dist');

const rootSarc = new SarcFile();
rootSarc.loadFrom(__dirname + '/../data_v131_USA.sarc');

const VIRTUAL_ARCHIVE = {};

/**
 * Unpacks a SARC archive into the given object
 *
 * @param {SarcFile} sarc SARC file to unpack
 * @param {object} root Destination object
 */
function sarcToObject(sarc, root) {
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

sarcToObject(rootSarc, VIRTUAL_ARCHIVE);

const tree = createFileSystemTree(VIRTUAL_ARCHIVE);

document.querySelector('.file-system').appendChild(tree);