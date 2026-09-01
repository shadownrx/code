const { contextBridge } = require('electron');
const os = require('node:os');

contextBridge.exposeInMainWorld('demo', {
  platform: process.platform,
  hostname: os.hostname(),
});
