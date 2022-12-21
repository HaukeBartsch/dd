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

// someone typed something into the search field
// we should wait a bit before sending it off, user might keep entering characters
document.getElementById('search').addEventListener("keyup", delay(function (e) {
    //ipcRenderer.send('search', e.target.value);
    window.search.string(e.target.value);
}, 500));

window.onresize = function() {
    document.getElementsByClassName('middle')[0].style.height = (window.innerHeight-50) + "px";
}

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
            console.log("scrolled into view!");
        }
    }
});