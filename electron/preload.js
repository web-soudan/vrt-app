const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // アプリの新しいインスタンス（別ウィンドウ・別プロセス）を起動する
  launchNewInstance: () => ipcRenderer.invoke('launch-new-instance')
});
