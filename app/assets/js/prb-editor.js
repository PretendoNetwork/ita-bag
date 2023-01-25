import { pathToObjectValue } from './util.js';
import { VIRTUAL_ARCHIVE } from './archive.js';

const PRBS = require('../prbs'); // * Relative to the html file loading the script

/**
 * Populates a newly created PRBS file editor
 *
 * @param {Element} editor File editor element to be populated
 */
export async function populatePRBSTab(editor) {
	const filePath = editor.getAttribute('data-for');
	const fileData = pathToObjectValue(VIRTUAL_ARCHIVE, filePath.substring(1));

	const badge = new PRBS(fileData);

	editor.querySelector('input[data-for="prd-badge-id"]').value = badge.id;
	editor.querySelector('input[data-for="prd-title-id"]').value = badge.titleID.toString(16).toUpperCase();
	editor.querySelector('input[data-for="prd-category"]').value = badge.category;

	const smallImage = await badge.images.small.toPNGBase64URI();
	const mediumImage = await badge.images.medium.toPNGBase64URI();
	const largeImage = await badge.images.large.toPNGBase64URI();

	editor.querySelector('img[data-for="prb-image-32"]').src = smallImage;
	editor.querySelector('img[data-for="prb-image-64"]').src = mediumImage;
	editor.querySelector('img[data-for="prb-image-128"]').src = largeImage;

	editor.querySelector('input[data-for="prd-language-japanese"]').value = badge.displayNames.japanese;
	editor.querySelector('input[data-for="prd-language-english"]').value = badge.displayNames.english;
	editor.querySelector('input[data-for="prd-language-french"]').value = badge.displayNames.french;
	editor.querySelector('input[data-for="prd-language-german"]').value = badge.displayNames.german;
	editor.querySelector('input[data-for="prd-language-italian"]').value = badge.displayNames.italian;
	editor.querySelector('input[data-for="prd-language-spanish"]').value = badge.displayNames.spanish;
	editor.querySelector('input[data-for="prd-language-chinese-simple"]').value = badge.displayNames.chineseSimple;
	editor.querySelector('input[data-for="prd-language-korean"]').value = badge.displayNames.korean;
	editor.querySelector('input[data-for="prd-language-dutch"]').value = badge.displayNames.dutch;
	editor.querySelector('input[data-for="prd-language-portuguese"]').value = badge.displayNames.portuguese;
	editor.querySelector('input[data-for="prd-language-russian"]').value = badge.displayNames.russian;
	editor.querySelector('input[data-for="prd-language-chinese-traditional"]').value = badge.displayNames.chineseTraditional;
	//editor.querySelector('input[data-for="prd-language-unknown-1"]').value = badge.displayNames.unknown1;
	//editor.querySelector('input[data-for="prd-language-unknown-2"]').value = badge.displayNames.unknown2;
	//editor.querySelector('input[data-for="prd-language-unknown-3"]').value = badge.displayNames.unknown3;
	//editor.querySelector('input[data-for="prd-language-unknown-4"]').value = badge.displayNames.unknown4;


	const inputs = editor.querySelectorAll('input[type="text"]');

	for (const input of inputs) {
		input.addEventListener('input', () => {
			document.querySelector('.tab.selected .modified-icon').classList.add('gg-asterisk');
			document.querySelector('.tab.selected').modified = true;
		});
	}
}

// TODO - Saving back to the virtual file system
export async function savePRBSTab(editor) {
console.log("SAVE TAB");
}