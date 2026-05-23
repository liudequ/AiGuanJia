import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS } from './ipc/handlers';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'AiGuanJia'
});

contextBridge.exposeInMainWorld('flowApi', {
  runFlow: (template: unknown) => ipcRenderer.invoke(IPC_CHANNELS.flowRun, template),
  getRuns: () => ipcRenderer.invoke(IPC_CHANNELS.runsGet)
});

contextBridge.exposeInMainWorld('projectApi', {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.projectsGetState),
  pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.projectsPickDirectory),
  selectPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.projectsSelectPath, { path })
});
