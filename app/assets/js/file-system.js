import { createTab, openTab } from './tabs.js';
import { VIRTUAL_ARCHIVE, sarcToObject, objectToSarc } from './archive.js';

const { ipcRenderer } = require('electron');
const { SarcFile } = require('@themezernx/sarclib/dist');


/**
 * Creates a file system tree on the current branch
 *
 * @param {object} object Base object for the tree to be stored on to
 * @param {string} name Name of the folder/branch
 * @param {string} virtualPath virtual file path to be stored on each child
 * @returns {Element} <details> element containing the current tree branch
 */
export function createFileSystemTree(object, name='Root', virtualPath='') {
	const root = document.createElement('details');
	const summary = document.createElement('summary');

	summary.appendChild(document.createTextNode(name));
	root.appendChild(summary);

	summary.addEventListener('click', setSelectedFolder);

	for (const key in object) {
		const value = object[key];
		let childElement;

		let newVirtualPath = `${virtualPath}/${key}`;

		if (value.constructor === Object) {
			// * Value is an folder, extend the tree
			childElement = createFileSystemTree(value, key, newVirtualPath);
		} else {
			// * Value is a file
			childElement = document.createElement('span');
			childElement.appendChild(document.createTextNode(key));
			childElement.addEventListener('click', openFile);
		}

		childElement.setAttribute('data-v-path', newVirtualPath);
		root.appendChild(childElement);
	}

	return root;
}

/**
 * Sets the clicked virtual folder to be selected
 *
 * @param {event} event Mouse click event
 */
function setSelectedFolder({ target }) {
	const currentSelectedFolder = document.querySelector('summary.selected');
	if (currentSelectedFolder) {
		currentSelectedFolder.classList.remove('selected');
	}

	target.classList.add('selected');
}

/**
 * Opens the clicked file
 *
 * @param {event} event Mouse click event
 */
function openFile({ target }) {
	const filePath = target.getAttribute('data-v-path');

	const existingTab = document.querySelector(`.tab[data-for="${filePath}"]`);

	if (existingTab) {
		openTab(filePath);
	} else {
		createTab(filePath);
	}
}

/**
 * Import a selected archive file
 *
 * @param {String} path Path to load from
 */
export function importSARC(path) {
	const rootSarc = new SarcFile();
	
	try {
	rootSarc.loadFrom(path);
	} catch (error) {
		alert(`Error loading SARC archive: ${error.message}!`);
		return;
	}
	sarcToObject(rootSarc, VIRTUAL_ARCHIVE);

	const tree = createFileSystemTree(VIRTUAL_ARCHIVE);

	const fs = document.querySelector('.file-system');
	while (fs.firstChild) {
		fs.removeChild(fs.firstChild);
	}

	document.querySelector('.file-system').appendChild(tree);
}

/**
 * Export the current archive file
 *
 * @param {String} path Path to save to
 */
export function exportSARC(path) {
	const sarc = objectToSarc(VIRTUAL_ARCHIVE);
	sarc.saveTo(path, 0);
}