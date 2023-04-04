import { Vis2Vec } from "./vis2vec.js";

var _vis2vec = null;
var _vis2vec_cache = {};
// execute callback as soon as we have a logo
function getSVGLogo(identifier, f) {
    if (_vis2vec == null) {
        _vis2vec = new Vis2Vec();
    }
    // we can call init repeatedly, it will only be run once
    _vis2vec.init().then(() => {
        if (typeof _vis2vec_cache[identifier] != 'undefined') {
            // return a copy of the cached object
            var p = _vis2vec_cache[identifier];
            let newpath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            newpath.setAttributeNS(null, "d", p.join(" "));
            (f)(newpath);
        } else {
            let p = _vis2vec.predict();
            _vis2vec_cache[identifier] = p;
            let newpath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            newpath.setAttributeNS(null, "d", p.join(" "));
            (f)(newpath);
        }
    });
}
// let logo = getSVGLogo("DDC");

// comment this out if you want to speed up the display without logos
/*document.getElementById("middle-scroll-window").addEventListener("new-box", function (event) {
    //console.log(event.target);
    let title = event.target.getElementsByClassName("title");
    // maybe we should queue these up, instead of doing all of them at the same time
    setTimeout(function () {
        getSVGLogo(title[0].innerHTML, (logo) => {
            if (logo == null) {
                console.log("warning: did not get a logo");
                return; // do nothing
            }
            // now add this logo to the current box (this)
            //const elem = document.getElementById('single-char');
            var l = document.createElement('div');
            l.innerHTML = "<svg viewBox=\"0 0 1024 1024\" class=\"bd-placeholder-img flex-shrink-0 me-2 rounded\" width=\"62\" height=\"62\" xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"Placeholder: 32x32\" preserveAspectRatio=\"xMidYMid slice\" focusable =\"false\"></svg>";
            l.firstChild.appendChild(logo);
            event.target.getElementsByClassName("logo")[0].appendChild(l);
        });
    }, 10);
}); */