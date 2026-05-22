import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('appInfo', {
  name: 'AiGuanJia'
});
