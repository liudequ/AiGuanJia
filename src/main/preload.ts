import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS } from './ipc/handlers';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'AiGuanJia'
});

contextBridge.exposeInMainWorld('flowApi', {
  runFlow: (template: unknown) => ipcRenderer.invoke(IPC_CHANNELS.flowRun, template),
  getRuns: () => ipcRenderer.invoke(IPC_CHANNELS.runsGet)
});
