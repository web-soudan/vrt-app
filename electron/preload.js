const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // APIs can be added here
});