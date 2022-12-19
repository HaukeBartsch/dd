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

// receive a message from the main process with a finished search
// the search results should be displayed on screen next
ipcRenderer.on('search', function (evt, message) {
  // get a search result back and populate the views
  // alert("got search result!" + JSON.stringify(message));

  // make space for new boxes
  var rows = document.getElementsByClassName("field");
  // how many elements are already in that list?
  for (var r = 0; r < rows.length; r++) {
    rows[r].innerHTML = "";
  }
  rows = document.getElementsByClassName("instrument");
  // how many elements are already in that list?
  for (var r = 0; r < rows.length; r++) {
    rows[r].innerHTML = "";
  }
  rows = document.getElementsByClassName("project");
  // how many elements are already in that list?
  for (var r = 0; r < rows.length; r++) {
    rows[r].innerHTML = "";
  }


  // message is array of [ 'search string', { field: [{},...] } ]
  for (var i = 0; i < message.length; i++) {
    // we will get only about 300 entries back
    var searchString = message[i][0];
    var searchResult = message[i][1]; // { field: } or { instrument: } or { project: }
    var type = 'field';
    if (typeof searchResult.field != 'undefined') {
      type = 'field';
    } else if (typeof searchResult.instrument != 'undefined') {
      type = 'instrument';
    } else if (typeof searchResult.project != 'undefined') {
      type = 'project';
    } else {
      console.log("unknown type in search result: " + JSON.stringify(Object.keys(searchResult)));
      continue;
    }
    // now we know how to display these
    // we expect a field for search results of these three types 'field', 'instrument', 'project'
    addBox(type, searchResult[type]);

  }


  // in order to draw the results from a search we need to fill in the corresponding rows,
  // we expect a row for each of the returned searches
});

function addBox(type, result) {
  // find a row with that type
  const row = document.getElementsByClassName(type);

  // how many elements are already in that list?
  for (var r = 0; r < row.length; r++) {
    var numboxes = row[r].getElementsByClassName('box').length;
    if (numboxes < 30) {
      // add the result here, if we never add we will not see the results, so make sure you have sufficient rows available
      if (type == 'project') {
        row[r].innerHTML += "<div class='box'>" + "<div class='title'>" + result.name + "</div></div>";
      } else if (type == 'field') {
        row[r].innerHTML += "<div class='box'>" + "<div class='title'>" + result.field_name + "</div>" +
          "<div class='description'>" + result.field_label + "</div>" +
          "</div>";
      } else if (type == 'instrument') {
        row[r].innerHTML += "<div class='box'>" + "<div class='title'>" + result["Instrument Title"] + "</div>" +
          "<div class='description'>" + result["Description"] + "</div>" +
          "</div>";

      }
      break; // done entering this field
    }
  }

}