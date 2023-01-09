const { app, BrowserWindow, ipcMain, dialog, nativeTheme, autoUpdater } = require('electron')
const path = require('path');
var loader = null; // background worker to load dd
var db = null; // worker: nothing setup yet
var mainWindow = null;
var saveWindow = null;

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
      contextIsolation: true,
      titleBarStyle: 'customButtonsOnHover'
    }
  })
  mainWindow.webContents.openDevTools();

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
  });

  /*ipcMain.handle('save-dialog:close', () => {
    if (saveWindow != null) {
      saveWindow.close();
    }
  }); */

  ipcMain.handle('stats', function (stats) {
    console.log("got some stats: " + JSON.stringify(stats));
  });

  // specify the pattern we are searching for right now
  ipcMain.handle("openSave", function (ev, ...args) {
    // open the dialog for getting save values
    console.log("open the settings dialog: " + JSON.stringify(args));
    var pattern = args[0]; // the search pattern

    saveWindow = new BrowserWindow({
      title: 'Save',
      parent: mainWindow,
      modal: true,
      show: false,
      frame: true,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 10, y: 10 },
      webPreferences: {
        preload: path.join(__dirname, 'preloadSaveDialog.js'),
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: true
      }
    });
    saveWindow.loadFile('dialogSave.html');
    saveWindow.setWindowButtonVisibility(true);
    saveWindow.once('ready-to-show', function () {
      // set the pattern as a field value
      saveWindow.webContents.send('pattern', pattern);
      saveWindow.show();
    });
  });

  ipcMain.handle('openSettings', function () {
    console.log("open the settings dialog");

    const child = new BrowserWindow({ parent: mainWindow, modal: true, show: false });
    child.loadFile('dialogSettings.html');
    child.once('ready-to-show', function () {
      child.show();
    });
    child.whenReady().then(function () {
      // react to any events from the page

    });
  });

//  ipcMain.handle('search:string', function (searchString) {
//    // start a search action on db
//    console.log("in main.js, receive a search request for a string")
//    db.postMessage(["search", searchString]);
//  });

  return mainWindow;
}

app.whenReady().then(() => {

  ipcMain.removeHandler('save:search');
  ipcMain.handle('save:search', function (ev, data) {
    //mainWindow.webContents.send('message', { "Info": "got a save:save with some values: " + data[0] + " " + data[1] + " pattern: " + data[2] });
    db.postMessage(["saveSearch", { name: data[0], description: data[1], pattern: data[2], "@id": require("os").userInfo().username + ":" + data[2] + ":" + encodeURIComponent(data[0]) }]);
  }); 

  ipcMain.removeHandler('search:string');
  ipcMain.handle('search:string', function (ev, searchString) {
    //console.log("HI");
    //mainWindow.webContents.send('message', { "Info": "search message in main.js on way to db" });
    if (searchString == "") {
      db.postMessage(["searchRandom", searchString]);
    } else {
      db.postMessage(["search", searchString]);
    }
  });

  ipcMain.removeHandler('leftSelect:drop');
  ipcMain.handle('leftSelect:drop', function (ev, type, id, color, content) {
    // we know now that we have dropped something on the left, we should render that box first
    console.log("react to a drop event... at least do something here " + type + " " + id + " " + color + " " + content);

    // we should enable the leave message box, but add the information for this card to the
    // leave message box first (like title)


    // we should make sure we show the messages for this card
    db.postMessage(["getMessages", [type, id, color, content]]);
  });

  ipcMain.removeHandler('show-about');
  ipcMain.handle('show-about', function (ev, ...args) {
    app.setAboutPanelOptions({
      applicationName: 'Data Dictionary Commentary',
      applicationVersion: '0.0.1',
      copyright: 'Free as in Beer',
      credits: 'A hi to all the people putting out cool data!',
      authors: ['Hauke Bartsch'],
      website: 'https://www.github.com/MMIV-center/dd',
      iconPath: path.join(__dirname, 'images/logo_white.png'),
    });

    app.showAboutPanel();
  });


  mainWindow = createWindow();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      // close the workers as  well
      db.terminate();
      loader.terminate();
      app.quit();
    }
  })
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (typeof Worker == 'undefined') {
    mainWindow.webContents.send('message', { "Error": "no Worker!" });
  }

  // test if we can send a message to the main process
  //setTimeout(function () {
  //  mainWindow.webContents.send('message', { 'BBLA': 'me me me' });
  //}, 1000);

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
  });

  db = new Worker(path.resolve(__dirname, 'db.js'));
  db.on('message', function (msg) {
    //mainWindow.webContents.send('message', { 'Message received from db': JSON.stringify(msg) });
    //console.log("Receive a message from the db");
    // if we receive an update message we should check if the user interface needs to be updated
    if (msg[0] == "update") {
      //console.log("there have been some update on the database, update the user interface now");
      update();
    } else if (msg[0] == "search") {
      // got  a search result back from db
      mainWindow.webContents.send('search', msg[1]);
    } else if (msg[0] == "stats") {
      // update these fields in the renderer
      mainWindow.webContents.send('stats', msg[1]);
    } else if (msg[0] == "searchMessage") { // received from db.js a result for a message search, add to interface now
      mainWindow.webContents.send("populateMessages", msg[1]);
    } else if (msg[0] == "haveSomething") { // as soon as we have some values, do a random list of results, need to do the same if search field is empty
      db.postMessage(["searchRandom", "*"]);
      db.postMessage(["loadSearchesFromDisk", ""]); // ask the database to load all previously cached searches, should happen only once.
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
