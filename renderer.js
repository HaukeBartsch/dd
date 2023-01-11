const information = document.getElementById('info')
//information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`

const btn = document.getElementById('btn')
const filePathElement = document.getElementById('filePath')

/*btn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openFile()
  filePathElement.innerText = filePath
}) */

document.getElementById('toggle-dark-mode').addEventListener('click', async () => {
    const isDarkMode = await window.darkMode.toggle()
    document.getElementById('theme-source').innerHTML = isDarkMode ? 'Dark' : 'Light'
})
  
document.getElementById('reset-to-system').addEventListener('click', async () => {
    await window.darkMode.system()
    document.getElementById('theme-source').innerHTML = 'System'
})

document.getElementById('new-message-box-content').addEventListener('input', delay(function (e) {
    // lets save this change either as a new message or as a change to an existing message
    var package = {
        content: document.getElementById('new-message-box-content').innerHTML,
        uid: document.getElementById('new-message-box').getAttribute("uid"),
        variable: document.getElementById('new-message-box-title').innerHTML,
        card_type: document.getElementById('new-message-box').getAttribute("card_type"),
        card_id: document.getElementById('new-message-box').getAttribute("card_id"),
        box_id: document.getElementById('new-message-box').getAttribute("uuid")
    };
    window.electronAPI.newMessage(package);
}, 500));

document.getElementById('left-side-box-drop').ondrop = function (ev) {
    ev.preventDefault();
    //console.log("started ondrop");
    // add this as a box here.. 
    var type = ev.dataTransfer.getData("boxType");
    var id = ev.dataTransfer.getData("boxId");
    var color = ev.dataTransfer.getData("boxColor");
    var content = ev.dataTransfer.getData("boxContent");

    // tell main about this drop, should tell the preloader about this event, but we need to do something in main anyway
    window.leftSelect.drop(type, id, color, content);
};

document.getElementById('search').ondrop = function (ev) {
    ev.preventDefault();
    var type = ev.dataTransfer.getData("boxType");
    var id = ev.dataTransfer.getData("boxId");
    var color = ev.dataTransfer.getData("boxColor");
    var content = ev.dataTransfer.getData("boxContent");
    // enter a search value and search
    var elem = document.querySelectorAll('div.box[type="' + type + '"][typeid="' + id + '"]');
    var uri = elem[0].getAttribute("uri");
    if (typeof uri != 'undefined' && uri != null && uri != 'undefined') {
        // instead of putting the uri in here directly we need to make sure that its not interpreted as a regexp, should be a literal search
        uri = uri.replace(/\?/g, "\\?");
        document.getElementById("search").value = uri;
        console.log("set value of search box to " + uri);
        // we need to trigger a change event
        document.getElementById("search").dispatchEvent(new Event('keyup', { 'bubbles': true }));
    } else {
        console.log("Error: this element does not have a uri - but it should have, please fix loader for: " + JSON.stringify(elem));
    }
}

document.getElementById('search').ondragover = function (ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "link";
}

document.getElementById('left-side-box-drop').ondragover = function (ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "link";
    //console.log("started ondragover");
}

document.getElementById('logo').onclick = function (ev) {
    // show the about box
    ev.preventDefault();
    window.electronAPI.showAbout();
}

/**
 * delay will wait with the execution until the user has stopped typing
 * @param {callback} callback function to execute
 * @param {*} ms waiting time
 * @returns 
 */
function delay(fn, ms) {
    let timer = 0
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(fn.bind(this, ...args), ms || 0)
    }
}

var lastSearchString = "";

// someone typed something into the search field
// we should wait a bit before sending it off, user might keep entering characters
document.getElementById('search').addEventListener("keyup", delay(function (e) {
    //ipcRenderer.send('search', e.target.value);
    // each time we have a string that has length > 0 we want to be able to save that
    var v = e.target.value;
    if (typeof v != "undefined" && v.length > 0) {
        document.getElementById('save-search').style.display = 'block';
    } else {
        document.getElementById('save-search').style.display = 'none';
    }
    // we should check if we really got a new string here, only if we have a new string we should 
    // search again
    if (v != lastSearchString) {
        window.search.string(v);
        lastSearchString = v;
    }

}, 500));

window.onresize = function() {
    document.getElementsByClassName('middle')[0].style.height = (window.innerHeight-50) + "px";
}

// add a dialog if user wants to change settings
document.getElementById("settings").addEventListener('click', function (e) {
    console.log("click on settings");
    window.electronAPI.openSettings();
});

document.getElementById("save-search").addEventListener('click', function (e) {
    var pattern = document.getElementById('search').value;
    if (pattern.length > 0) {// ignore if this is no search
        // console.log("click on save search");
        window.electronAPI.openSave(pattern); // open the save search dialog
    } else {
        console.log("click on save search - but no openSave, search field is empty " + JSON.stringify(pattern));
    }
})

// we should react to what is visible on the page (based on scroll events)
function isScrolledIntoView(el) {
    var rect = el.getBoundingClientRect();
    var elemTop = rect.top;
    var elemBottom = rect.bottom;

    // Only completely visible elements return true:
    var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);
    // Partially visible elements return true:
    //isVisible = elemTop < window.innerHeight && elemBottom >= 0;
    return isVisible;
}

// find out if any of the fields need to be filled from the db
function needsUpdate() {

}

const middle_scroll_window = document.getElementById('middle-scroll-window');
middle_scroll_window.addEventListener("scroll", function () {
    // react to the scroll event if we don't have all boxes filled
    const wlist = document.querySelectorAll('.row-list');
    for (var i = 0; i < wlist.length; i++) {
        if (isScrolledIntoView(wlist[i])) {
            // check if we need to update the list with values
            //console.log("scrolled into view!");
        }
    }
});

document.addEventListener("dragstart", function (ev) {
    // only valid for class box
    // todo: check and return if not

    var boxType = ev.target.getAttribute("type");
    var boxId = ev.target.getAttribute("typeid");
    var color = ev.target.getAttribute("color");
    ev.dataTransfer.setData("boxId", boxId);
    ev.dataTransfer.setData("boxType", boxType);
    ev.dataTransfer.setData("boxColor", color);
    ev.dataTransfer.setData("boxContent", ""); //  a json version of the data

    // add a highlight to the drop region
    document.getElementById("left-side-box-drop").classList.remove("box-drop-normal");
    document.getElementById("left-side-box-drop").classList.add("box-drop-highlight");
});

document.addEventListener("dragend", function (ev) {
    document.getElementById("left-side-box-drop").classList.remove("box-drop-highlight");
    document.getElementById("left-side-box-drop").classList.add("box-drop-normal");
})