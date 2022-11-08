const {app, BrowserWindow, ipcMain, dialog, nativeTheme} = require('electron')
const path = require('path');
var loader = null; // background worker to load dd

const {
    Worker,
    isMainThread,
    setEnvironmentData,
    getEnvironmentData,
  } = require('node:worker_threads');
  

async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog()
    if (canceled) {
      return
    } else {
      return filePaths[0]
    }
}

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1400,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        //nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: true
      }
    })
  
  /*  ipcMain.on('set-title', (event, title) => {
      const webContents = event.sender
      const win = BrowserWindow.fromWebContents(webContents)
      win.setTitle(title)
    }) */
//    ipcMain.on('open-file', (event) => {
  //      return handleFileOpen();
    //})
    mainWindow.loadFile('index.html')

    ipcMain.handle('dark-mode:toggle', () => {
        if (nativeTheme.shouldUseDarkColors) {
          nativeTheme.themeSource = 'light'
        } else {
          nativeTheme.themeSource = 'dark'
        }
        return nativeTheme.shouldUseDarkColors
    })
    
    ipcMain.handle('dark-mode:system', () => {
        nativeTheme.themeSource = 'system'
    })

    return mainWindow;
}

app.whenReady().then(() => {
    //ipcMain.on('set-title', handleSetTitle)
    ipcMain.handle('dialog:openFile', handleFileOpen);
    var mainWindow = createWindow();

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit()
    })
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // test if we can send a message to the main process
    setTimeout(function() {
        mainWindow.webContents.send('message', { 'BBLA': 'me me me'});
    }, 1000);

    // load the initial loader
    var loader = new Worker('./loader.js');
    loader.onmessage = (e) => {
        //result.textContent = e.data;
        console.log('Message received from worker: ' + e.data);
    }

    setTimeout(function() {
        loader.postMessage(["hi there", "its me!"]);
    }, 4000);


})

/*function handleSetTitle (event, title) {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    win.setTitle(title)
};*/

