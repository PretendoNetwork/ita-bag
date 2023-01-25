import { importSARC, exportSARC } from './file-system.js';
import { saveCurrentTab } from './tabs.js';

const { ipcRenderer } = require('electron');

// File > Save Tab
ipcRenderer.on('save', () => {saveCurrentTab()});

// File > Save All Tabs
ipcRenderer.on('save-all', () => {console.log('SAVE ALL TABS')});

// File > Import Archive
ipcRenderer.on('import-archive', (_event, path) => {
    importSARC(path);
})

// File > Export Archive
ipcRenderer.on('export-archive', (_event, path) => {
    exportSARC(path);
})