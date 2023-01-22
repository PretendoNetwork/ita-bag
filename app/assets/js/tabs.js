const SUPPORTED_FILE_TYPES = [
	'prb'
];

/**
 * Creates a new editor tab and editor
 *
 * @param {string} filePath Virtual file path for creating elements with file metadata
 */
async function createTab(filePath) {
	const fileName = filePath.split('/').pop();
	const fileType = fileName.split('.').pop().toLowerCase();

	if (!SUPPORTED_FILE_TYPES.includes(fileType)) {
		alert(`${fileName} (TYPE ${fileType}) NOT SUPPORTED`);
		return;
	}

	const tab = document.createElement('div');
	const name = document.createElement('span');
	const closeButton = document.createElement('span');
	const closeButtonIcon = document.createElement('i');

	tab.classList.add('tab');
	name.classList.add('file-name');
	closeButton.classList.add('close-button');
	closeButtonIcon.classList.add('gg-close-r');

	tab.setAttribute('data-for', filePath);

	// TODO - Create a fancier CSS-based tooltip
	tab.setAttribute('title', fileName);
	closeButton.setAttribute('title', 'Close editor');

	closeButton.appendChild(closeButtonIcon);
	name.appendChild(document.createTextNode(fileName));
	tab.appendChild(name);
	tab.appendChild(closeButton);

	closeButton.addEventListener('click', event => {
		event.stopPropagation();

		// TODO - Set an "edited" property on the tab, don't check a class for this
		if (closeButton.querySelector('i').classList.contains('gg-asterisk')) {
			const response = confirm('File has changes not yet saved. Changes will be lost. Continue?');

			if (!response) {
				return;
			}
		}

		closeTab(filePath);
	});

	tab.addEventListener('click', () => {
		openTab(filePath);
	});

	const editor = document.querySelector(`template[data-for="${fileType}"]`).content.firstElementChild.cloneNode(true);
	editor.setAttribute('data-for', filePath);

	try {
		await populateTab(editor);

		document.querySelector('.tabs').appendChild(tab);
		document.querySelector('.editors').appendChild(editor);

		openTab(filePath);
	} catch (error) {
		alert(error.message);
	}
}

/**
 * Populates a new editor tab and editor
 *
 * @param {Element} editor File editor element to be populated
 */
async function populateTab(editor) {
	const fileName = editor.getAttribute('data-for').split('/').pop();
	const fileType = fileName.split('.').pop().toLowerCase();

	switch (fileType) {
	case 'prb':
		await populatePRBSTab(editor);
		break;
	}
}

/**
 * Opens an existing editor tab
 *
 * @param {string} filePath Virtual file path for finding elements with file metadata
 */
function openTab(filePath) {
	document.querySelector('.tab.selected')?.classList.remove('selected');
	document.querySelector('.editor.selected')?.classList.remove('selected');

	document.querySelector(`.tab[data-for="${filePath}"]`)?.classList.add('selected');
	document.querySelector(`.editor[data-for="${filePath}"]`)?.classList.add('selected');
}

/**
 * Closes an existing editor tab
 *
 * @param {string} filePath Virtual file path for finding elements with file metadata
 */
function closeTab(filePath) {
	const selectedTab = document.querySelector('.tab.selected');
	let tabToSelectNext;

	const selectedTabPath = selectedTab.getAttribute('data-for');

	if (selectedTabPath === filePath) {
		if (selectedTab.previousSibling) {
			tabToSelectNext = selectedTab.previousSibling;
		} else {
			tabToSelectNext = selectedTab.nextSibling;
		}
	}

	document.querySelector(`.tab[data-for="${filePath}"]`).remove();
	document.querySelector(`.editor[data-for="${filePath}"]`).remove();

	if (tabToSelectNext) {
		openTab(tabToSelectNext.getAttribute('data-for'));
	}
}