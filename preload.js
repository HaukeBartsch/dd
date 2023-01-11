const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openSettings: () => ipcRenderer.invoke('openSettings'),
  openSave: (arg) => ipcRenderer.invoke('openSave', arg),
  showAbout: () => ipcRenderer.invoke('show-about'),
  newMessage: (package) => ipcRenderer.invoke('new-message', package)
});

contextBridge.exposeInMainWorld('search', {
  string: function (arg) {
    ipcRenderer.invoke('search:string', arg);
  }
});

contextBridge.exposeInMainWorld('leftSelect', {
  drop: function (type, id, color, content) {
    ipcRenderer.invoke('leftSelect:drop', type, id, color, content);
    // just get a copy of this box (ignore all the special info)
    var elem = document.querySelectorAll('div.box[type="' + type + '"][typeid="' + id + '"]');
    // remove all old children
    var c = document.getElementById('left-side-box-drop').lastElementChild;
    while (c != null) {
      document.getElementById('left-side-box-drop').removeChild(c);
      c = document.getElementById('left-side-box-drop').lastElementChild;
    }
    // make a copy and set as new content
    var newbox = elem[0].cloneNode(true);
    document.getElementById('left-side-box-drop').appendChild(newbox);
    // if we start dragging we should destroy this box
    newbox.ondragend = function () {
      document.getElementById('left-side-box-drop').lastElementChild.remove();
      // reset the highlight
      document.getElementById("left-side-box-drop").classList.remove("box-drop-highlight");
      document.getElementById("left-side-box-drop").classList.add("box-drop-normal");
    }
    // we should ask for the content from content  from the database... otherwise we don't have something to show here
    // add the info for this card to the message box as well
    var title = elem[0].getElementsByClassName("title")[0].innerHTML;
    document.getElementById("new-message-box").getElementsByClassName("message-box-title")[0].innerHTML = title;

    var uid = elem[0].getAttribute("uid");
    if (uid != "undefined")
      document.getElementById("new-message-box").setAttribute("uid", uid);

    // maybe we should add type and the id as well?
    document.getElementById("new-message-box").setAttribute("card_type", type);
    document.getElementById("new-message-box").setAttribute("card_id", id);
    // create a unique id for this message


    // clear the description, but maybe that is too dangerous
    // document.getElementById('new-message-box').getElementsByClassName("message-box-content")[0].innerHTML = "new message";
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

function numberWithCommas(x) {
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

ipcRenderer.on('populateMessages', function (evt, messages) {
  // we got some messages to display, show them and activate a new message box
  document.getElementById('new-message-box').style.display = "";
  // add a unique ID to the new-message-box
  var uuid = uuidv4();
  document.getElementById('new-message-box').setAttribute("uuid", uuid);
  document.getElementById('new-message-box-id').innerHTML = uuid;

  var message_list = document.getElementById('message-list');
  for (var i = 0; i < message_list.childNodes.length; i++) {
    if (typeof message_list.childNodes[i].classList != "undefined" && !message_list.childNodes[i].classList.contains("keep")) {
      message_list.removeChild(message_list.childNodes[i]);
    }
  }

  for (var i = 0; i < messages.length; i++) {
    // create a new message box and add
    var entry = messages[i][1];
    var txt = "<div class='message-box' uuid='" + entry.uid + "'>" +
      "<div class='message-box-title'>" + entry.name + "</div>" +
      "<div class='message-box-id'>" + entry.uid + "</div>" +
      "<div class='message-box-content'>" + entry.description + "</div>" +
      "</div>";
    document.getElementById('message-list').innerHTML += txt;
  }
});


// receive a message from the main process
ipcRenderer.on('stats', function (evt, message) {
  //console.log("update the stats on the page: " + JSON.stringify(message));
  //alert(JSON.stringify(message));

  const information = document.getElementById('stats-text');
  var information_1 = document.getElementById('info1');
  var information_2 = document.getElementById('info2');
  var information_3 = document.getElementById('info3');
  if (information_1 == null) {
    information.innerHTML += "<button class='btn btn-info' id='info1'>instruments " + numberWithCommas(message["instruments"]) + "</button>";
  }
  if (information_2 == null) {
    information.innerHTML += "<button class='btn btn-info' id='info2'>projects: " + numberWithCommas(message["projects"]) + "</button>";
  }
  if (information_3 == null) {
    information.innerHTML += "<button class='btn btn-info' id='info3'>fields: " + numberWithCommas(message["fields"]) + "</button>";
  }
  document.getElementById('info1').innerHTML = "instruments " + numberWithCommas(message["instruments"]);
  document.getElementById('info2').innerHTML = "projects: " + numberWithCommas(message["projects"]);
  document.getElementById('info3').innerHTML = "fields: " + numberWithCommas(message["fields"]);

/*  information.innerHTML = "<button class='btn btn-info'>instruments " + numberWithCommas(message["instruments"]) + "</button>"
    + "<button class='btn btn-info'>projects: " + numberWithCommas(message["projects"]) + "</button>"
    + "<button class='btn btn-info'>fields: " + numberWithCommas(message["fields"]) + "</button>"; */
});

ipcRenderer.on('left-drop', function (evt, message) {
  // lookup the 
  console.log("got a left-drop " + JSON.stringify(message));

  // lookup some messages for this drop
  ipcRenderer.invoke('message:lookup', message.uid);
});

/**
 * receive a message from the main process with a finished search
 */
ipcRenderer.on('search', function (evt, message) {
  //
  // make space for new boxes
  //
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
    } else if (typeof searchResult.search != 'undefined') {
      type = 'search';
    } else if (typeof searchResult.message != 'undefined') {
      type = 'message';
    } else {
      console.log("unknown type in search result: " + JSON.stringify(Object.keys(searchResult)));
      continue;
    }
    // now we know how to display these
    // we expect a field for search results of these three types 'field', 'instrument', 'project', 'search'
    if (type != "message") {
      addBox(type, searchResult[type]);
    } else {
      console.log("found a search for message, what to do???");
    }
  }
  // lets find out if any rows are empty, hide those
  const row = document.getElementsByClassName("slider");
  for (var i = 0; i < row.length; i++) {
    var numEntries = row[i].getElementsByClassName("box").length;
    if (numEntries == 0) {
      row[i].parentNode.parentNode.style.display = "none";
    } else {
      row[i].parentNode.parentNode.style.display = "block";
    }
  }

  // in order to draw the results from a search we need to fill in the corresponding rows,
  // we expect a row for each of the returned searches
});

var colorCache = {}; // memorize the color number if we have seen this variable before

/**
 * return the html text for a box of a given type
 */
function createBox(type, result, numboxes) {
  s = {
    project: "",
    instrument: "",
    project_version: "",
    instrument_version: "",
    instrument_part: ""
  };
  if (typeof result.uri != 'undefined' && result.uri.length > 0) {
    s = parseURI(result.uri);
  }
  s.instrument_version = s.instrument_version == null ? "" : s.instrument_version;
  s.project_version = s.project_version == null ? "" : s.project_version;
  result.field_label = result.field_label != null ? result.field_label : ""; // are we changing the data in place?

  if (typeof result.uid == "undefined") {
    console.log("ERROR: we have a result that does not have a uid> " + result.field_label);
  }

  var color = "q" + (numboxes % 8) + "-8";
  if (type == "project") {
    if (result.name in colorCache) {
      color = colorCache[result.name];
    } else {
      colorCache[result.name] = color;
    }
    return "<div class='box Pastel2-" + color + "' color='" + color + "' type = 'project' typeid = '" + result.id + "' draggable = 'true' uri='" + result.uri + "' uid='" + result.uid + "'>" + "<div class='title'>" + result.name + "</div>" +
      "<div class='description'>" + (typeof result.description != 'undefined' ? result.description : "") + "</div>" +
      "<div class='project-name' title='Protocol name and project'>" + decodeURI(s.protocol) + " " + decodeURI(s.project) + "</div>" +
      "<div class='instrument-name' title='Instrument and version'> " + decodeURI(s.instrument) + " " + decodeURI(s.instrument_version) + "</div > " +
      "</div>";
  } else if (type == "field") {
    if (result.field_name in colorCache) {
      color = colorCache[result.field_name];
    } else {
      colorCache[result.field_name] = color;
    }
    return "<div class='box Pastel1-" + color + "' color='" + color + "' type='field' typeid='" + result.id + "' draggable='true' uri='" + result.uri + "' uid='" + result.uid + "'>" + "<div class='title'>" + result.field_name + "</div>" +
      "<div class='description'>" + result.field_label + "</div>" +
      "<div class='project-name' title='Project name and version'>" + decodeURI(s.project) + " " + decodeURI(s.project_version) + "</div>" +
      "<div class='instrument-name' title='Instrument and version'>" + decodeURI(s.instrument) + " " + decodeURI(s.instrument_version) + "</div>" +
      "</div>";
  } else if (type == "instrument") {
    if (result["Instrument Title"] in colorCache) {
      color = colorCache[result["Instrument Title"]];
    } else {
      colorCache[result["Instrument Title"]] = color;
    }
    return "<div class='box Pastel2-" + color + "' color='" + color + "' type='instrument' typeid='" + result.id + "' draggable='true' uri='" + result.uri + "' uid='" + result.uid + "'>" + "<div class='title'>" + result["Instrument Title"] + "</div>" +
      "<div class='description'>" + result["Description"] + "</div>" +
      "<div class='project-name' title='Project name and version'>" + decodeURI(s.project) + " " + decodeURI(s.project_version) + "</div>" +
      "<div class='instrument-name' title='Instrument and version'>" + decodeURI(s.instrument) + " " + decodeURI(s.instrument_version) + "</div>" +
      "</div>";
  } else if (type == "search") {
    return "<div class='box search-card' color='search-card' type='search' typeid='" + result.id + "' draggable='true' uri='" + result.uri + "' uid='" + result.uid + "'>" + "<div class='title'>" + result["name"] + "</div>" +
      "<div class='description'>" + result["description"] + "</div>" +
      "<div class='pattern'>/" + result["pattern"] + "/i</div>" +
      "<div class='project-name' title='Project name and version'>" + decodeURI(s.project) + " " + decodeURI(s.project_version) + "</div>" +
      "<div class='instrument-name' title='Instrument and version'>" + decodeURI(s.instrument) + " " + decodeURI(s.instrument_version) + "</div>" +
      "</div>";
  }
}


function addBox(type, result) {
  // find a row with that type
  let row = document.getElementsByClassName(type);
  if (type == "search") { // add to instrument rows
    row = document.getElementsByClassName("instrument");
  }

  // how many elements are already in that list?
  for (var r = 0; r < row.length; r++) {
    var numboxes = row[r].getElementsByClassName('box').length;
    if (numboxes < 30) {
      // add the result here, if we never add we will not see the results, so make sure you have sufficient rows available
      var b = createBox(type, result, numboxes);
      var div = document.createElement('div');
      div.classList.add("slider");
      div.innerHTML = b.trim();
      var bb = div.firstChild;
      if (type == 'project') {
        row[r].appendChild(bb); //  .innerHTML += b;
      } else if (type == 'field') {
        row[r].appendChild(bb);  // innerHTML += b;
      } else if (type == 'instrument') {
        row[r].appendChild(bb);  // innerHTML += b;
      } else if (type == "search") {
        row[r].appendChild(bb);  //innerHTML += b;
      }
      var d = document.createElement("div");
      d.classList.add("select-button");
      d.style.opacity = 0;
      bb.appendChild(d);
      setTimeout((function (dd) {
        return function () {
          dd.style.opacity = .2;
        };
      })(d), 500);
      // if we could add the result break here, otherwise continue searching

      // we should adjust the size of the content in case we are using too much space for the title
      var title_size = bb.getElementsByClassName("title")[0].offsetHeight;
      var description_size = bb.getElementsByClassName("description")[0].offsetHeight;
      //console.log("title_size: " + title_size + " description_size: " + description_size);
      if (title_size + description_size + 40 > 270) {
        // make description size smaller
        var new_size = 270 - 40 - title_size - 20;
        if (new_size > 10) {
          bb.getElementsByClassName("description")[0].style.maxHeight = new_size + "px";
        }
      }

      break;
    }
  }

}

function parseURI(str) {
  // couple of things in here, project name
  var s = {
    protocol: "nda:",
    project: "",
    project_version: "",
    instrument: "",
    instrument_version: "",
    instrument_part: ""
  };
  // example: "redcap://ABCD?instrument=abcd_asrs&release=v4.0&version=v01", 
  var parsed = null;
  try {
    parsed = new URL(str);
  } catch (e) {
    // something went wrong
    return s;
  }
  s.project = parsed.pathname.slice(2);
  s.protocol = parsed.protocol;
  if (typeof parsed.searchParams == "object") {
    s.instrument = decodeURIComponent(parsed.searchParams.get("instrument"));
    s.instrument_version = decodeURIComponent(parsed.searchParams.get("version"));
    s.instrument_part = decodeURIComponent(parsed.searchParams.get("part"));
    s.project_version = decodeURIComponent(parsed.searchParams.get("release"));
  }
  s.instrument = s.instrument != "null" ? s.instrument : "";
  s.instrument_version = s.instrument_version != "null" ? s.instrument_version : "";
  s.instrument_part = s.instrument_part != "null" ? s.instrument_part : "";
  s.project_version = s.project_version != "null" ? s.project_version : "";

  return s;
}
