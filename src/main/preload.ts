import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  flowRun: 'flow:run',
  runsGet: 'runs:get',
  projectsGetState: 'projects:getState',
  projectsSelectPath: 'projects:selectPath',
  projectsPickDirectory: 'projects:pickDirectory',
  agentsList: 'agents:list',
  agentsAdd: 'agents:add',
  agentsRemove: 'agents:remove'
} as const;

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

contextBridge.exposeInMainWorld('agentApi', {
  list: () => ipcRenderer.invoke(IPC_CHANNELS.agentsList),
  add: (payload?: unknown) => ipcRenderer.invoke(IPC_CHANNELS.agentsAdd, payload),
  remove: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.agentsRemove, { id })
});
