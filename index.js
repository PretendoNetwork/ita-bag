const { app, BrowserWindow, Menu, MenuItem, ipcMain, dialog } = require('electron');

app.setName('Ita Bag');

/**
 * Creates a new application window
 */
function createWindow() {
	const window = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: { // TODO - Use Electron's contextBridge instead
			nodeIntegration: true,
			contextIsolation: false,
			backgroundThrottling: false
		}
	});

	createAppMenu(window);

	window.webContents.openDevTools();
	window.maximize();
	window.loadFile('app/index.html');

	handleFileOpen(window, 'import-archive', { filters: [{name: 'PrizeCollection Archive', extensions: ['sarc', 'szs']}]})
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

/**
 * Add options to window
 * 
 * @param {BrowserWindow} window // Main window
 */
function createAppMenu(window) {
	const menu = new Menu()
	menu.append(new MenuItem({
	label: 'File',
	submenu: 
	[{
		id: 'save-tab',
		label: 'Save Tab',
		accelerator: 'CmdOrCtrl+S',
		click: () => { window.webContents.send('save') }
	},
	{
		id: 'save-all-tabs',
		label: 'Save All Tabs',
		accelerator: 'CmdOrCtrl+Shift+S',
		click: () => { window.webContents.send('save-all') }
	},
	{
		type: 'separator'
	},
	{
		id: 'import-archive',
		label: 'Import Archive',
		accelerator: 'CmdOrCtrl+I',
		click: () => { handleFileOpen(window, 'import-archive', { filters: [{name: 'PrizeCollection Archive', extensions: ['sarc', 'szs']}]}) }
	},
	{
		id: 'export-archive',
		label: 'Export Archive',
		accelerator: 'CmdOrCtrl+E',
		click: () => { handleFileSave(window, 'export-archive', { filters: [{name: 'PrizeCollection Archive', extensions: ['sarc', 'szs']}]}) }
	}
	]}))
	
	menu.append(new MenuItem({
		label: 'Debug',
		submenu: 
		[{
			label: 'Reload',
			role: 'reload'
		},
		{
			label: 'Force Reload',
			role: 'forceReload'
		},
		{
			type: 'separator'
		},
		{
			label: 'Open Developer Tools',
			role: 'toggleDevTools'
		}
	]}))

	ipcMain.on('set-menu-item-available', (event, item, available) => {
		Menu.getApplicationMenu().getMenuItemById(item).enabled = available;
	})

	Menu.setApplicationMenu(menu)
}

/**
 * Handles file opening
 * 
 * @param {BrowserWindow} window // Main window
 * @param {String} event // Where to send the path
 * @param {Object} // Options for the dialog
 */
async function handleFileOpen(window, event, options) {
	const { canceled, filePaths } = await dialog.showOpenDialog(window, options);
	if (!canceled) {
		window.webContents.send(event, filePaths[0]);
	}
}

/**
 * Handles file saving
 * 
 * @param {BrowserWindow} window // Main window
 * @param {String} event // Where to send the path
 * @param {Object} // Options for the dialog
 */
async function handleFileSave(window, event, options) {
	const { canceled, filePath } = await dialog.showSaveDialog(window, options);
	if (!canceled) {
		window.webContents.send(event, filePath);
	}
}