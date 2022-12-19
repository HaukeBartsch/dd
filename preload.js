const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    setTitle: (title) => ipcRenderer.send('set-title', title),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
})

contextBridge.exposeInMainWorld('search', {
  string: function (arg) {
    //ipcRenderer.send('string', arg);
    ipcRenderer.invoke('search:string', arg);
  }
});

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system')
});

// receive a message from the main process
ipcRenderer.on('message', function (evt, message) {
  console.log(message); 
  alert(JSON.stringify(message));
});

// receive a message from the main process
ipcRenderer.on('stats', function (evt, message) {
  console.log("update the stats on the page: " + JSON.stringify(message));
  //alert(JSON.stringify(message));

  const information = document.getElementById('stats-text');
  information.innerHTML = "<button class='btn btn-info'>instruments " + message["instruments"] + "</button>"
    + "<button class='btn btn-info'>projects: " + message["projects"] + "</button>"
    + "<button class='btn btn-info'>fields: " + message["fields"] + "</button>";
});

// receive a message from the main process
ipcRenderer.on('search', function (evt, message) {
  // get a search result back and populate the views
  alert("got search result!" + JSON.stringify(message));

  // in order to draw the results from a search we need to fill in the corresponding rows,
  // we expect a row for each of the returned searches
});

