const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    setTitle: (title) => ipcRenderer.send('set-title', title),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
})

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system')
})

// receive a message from the main process
ipcRenderer.on('message', function (evt, message) {
  console.log(message); 
  alert(JSON.stringify(message));
});

ipcRenderer.on('stats', function (evt, message) {
  console.log("update the stats on the page: " + JSON.stringify(message));
  //alert(JSON.stringify(message));

  const information = document.getElementById('stats-text');
  information.innerHTML = "<button class='btn btn-info'>instruments " + message["instruments"] + "</button>"
    + "<button class='btn btn-info'>projects: " + message["projects"] + "</button>"
    + "<button class='btn btn-info'>fields: " + message["fields"] + "</button>";
});
