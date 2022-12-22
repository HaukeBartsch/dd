const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('save', {
    search: function (arg) {
        ipcRenderer.invoke('save:search', arg);
    }
});

ipcRenderer.on('pattern', function (evt, pattern) {
    console.log(pattern);
    //alert(JSON.stringify(pattern));
    document.getElementById('pattern').value = pattern;
});
