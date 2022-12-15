const { app, BrowserWindow, ipcMain, dialog, nativeTheme, autoUpdater } = require('electron')
const path = require('path');
var loader = null; // background worker to load dd
var db = null; // worker: nothing setup yet
var mainWindow = null;

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: true
    }
  })
  mainWindow.webContents.openDevTools();

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

  ipcMain.handle('stats', function (stats) {
    console.log("got some stats: " + JSON.stringify(stats));
  });

  return mainWindow;
}

app.whenReady().then(() => {
  //ipcMain.on('set-title', handleSetTitle)
  ipcMain.removeHandler('dialog:openFile'); // in case window gets opened again
  ipcMain.handle('dialog:openFile', handleFileOpen);
  mainWindow = createWindow();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (typeof Worker == 'undefined') {
    mainWindow.webContents.send('message', { "Error": "no Worker!" });
  }

  // test if we can send a message to the main process
  setTimeout(function () {
    mainWindow.webContents.send('message', { 'BBLA': 'me me me' });
  }, 1000);

  // initial loader
  loader = new Worker(path.resolve(__dirname, 'loader.js'));
  loader.on('message', function (msg) {
    //console.log("got a message: " + JSON.stringify(msg));
    // for loadDatabase we will have
    if (msg[0] == "loadDefaults") {
      // we should send all of these to the database db, they should have enough context to be readable
      // we could check if there is really something to do here before we send this message - sometimes msg[1] is an empty array
      db.postMessage(["announce", msg]);
    } else {
      console.log("Error: unknown message coming to main from loader: " + JSON.stringify(msg[0]));
      msg[0] += " (unknown type)";
      mainWindow.webContents.send('message', msg);
    }
  })

  db = new Worker(path.resolve(__dirname, 'db.js'));
  db.on('message', function (msg) {
    //mainWindow.webContents.send('message', { 'Message received from db': JSON.stringify(msg) });
    //console.log("Receive a message from the db");
    // if we receive an update message we should check if the user interface needs to be updated
    if (msg[0] == "update") {
      //console.log("there have been some update on the database, update the user interface now");
      update();
    } else if (msg[0] == "stats") {
      // update these fields in the renderer
      mainWindow.webContents.send('stats', msg[1]);
    } else {
      mainWindow.webContents.send('message', { "Error, unknown msg received (should be stats or update)": msg[0] });
    }
  });

  // trigger a load of the basic data dictionaries (will add them to db)
  loader.postMessage(["loadDefaults", { "description": "initial request to load list of data dictionaries" }]);
  update();
})

function update() {
  // request some updates to the user interface
  // request a summary update first
  db.postMessage(["stats", { "description": "send back some basic stat updates" }]);
}
