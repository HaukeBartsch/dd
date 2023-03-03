"use strict";

//const fs = require("fs-extra");
//var intersect = require('path-intersection');
import { findPathIntersections as intersect } from "./intersect.js";

const name = "something";


function getStartPosition(path) {
    if (typeof path == 'undefined')
        return [0, 0];
    var re_start_coords = /M ([+\-0-9]*) ([+\-0-9]*)/;
    var matches = path.match(re_start_coords);
    if (matches == null) {
        console.log("What is happening? should be an M but is:  \"" + path + "\". Skip");
        return [0, 0];
    }
    var xcoord = parseInt(matches[1]);
    var ycoord = parseInt(matches[2]);
    return [xcoord, ycoord];
}

// the start position is one (random) M value pair at the beginning
// we want to place the center of the object to newPos
function setStartPosition(path, newPos) { // newPos = [0,0]
    if (typeof path == 'undefined')
        return null;
    //var c = getStartPosition(path);
    var cs = ["M", "Q", "Z", "C", "L", "S", "V", "H", "A"];

    var stroke = path.split(" ");
    var center = [0, 0];
    var numCoords = 0;
    var x = 0;
    // find the center of mass of all coordinates (regardless of spline or position)
    for (var k = 0; k < stroke.length; k++) {
        if (cs.indexOf(stroke[k]) != -1) {
            x = 0;
        } else {
            var ii = parseInt(stroke[k]);
            if (((x + 1) % 2) == 0) {
                center[0] += ii;
            } else {
                // even
                center[1] += ii;
                numCoords++;
                //ii = ii - ycoord + newPos[1];
            }
        }
        x++;
    }
    center[0] /= numCoords;
    center[1] /= numCoords;
    center[0] = Math.floor(center[0]);
    center[1] = Math.floor(center[1]);

    var text = "";
    x = 0;
    var isM = false;
    for (var k = 0; k < stroke.length; k++) {
        if (cs.indexOf(stroke[k]) != -1) {
            text += " " + stroke[k];
            if (stroke[k] == "M")
                isM = true;
            else
                isM = false;
            x = 0;
        } else {
            var ii = parseInt(stroke[k]);
            if (((x + 1) % 2) == 0) {
                // even
                ii = ii - center[0] + newPos[0];
            } else {
                // odd
                ii = ii - center[1] + newPos[1];
            }
            text += " " + ii;
        }
        x++;
    }
    return text.trim();
}

const weighted_choice = function (table) {
    const choices = [], cumweights = [];
    let sum = 0;
    for (const k in table) {
        choices.push(k);
        // work with the cumulative sum of weights
        cumweights.push(sum += table[k]);
    }
    return function () {
        const val = Math.random() * sum;
        // a binary search would be better for "large" tables
        for (const i in cumweights) {
            if (val <= cumweights[i]) {
                return choices[i];
            }
        }
    };
};

// would be good to pick one based on the size distribution
function pickStroke(dict, sizeDistribution) {
    // pick a size bin
    const gen = weighted_choice(sizeDistribution.probs);
    var val = parseInt(gen());
    // now we have a range of entries from which to choose from
    var oneChunk = (sizeDistribution.max - sizeDistribution.min) / (sizeDistribution.probs.length - 1.0);
    var lowerLength = oneChunk * val;
    var upperLength = oneChunk * (val + 1);
    let sub = [];
    for (var i = 0; i < dict.length; i++) {
        if (dict[i].length >= lowerLength && dict[i].length <= upperLength)
            sub.push(dict[i]);
    }
    let idx = Math.floor(Math.random() * sub.length);
    return sub[idx];
}

function pickStrokeLarge(dict, proportion) { // how large should the first character be
    var l = dict.length * proportion;
    let idx = Math.floor(Math.random() * l);
    return dict[dict.length - idx - 2]; // in a split the last entry is empty
}

// Standard Normal variate using Box-Muller transform.
function gaussianRandom(mean = 0, stdev = 1) {
    let u = 1 - Math.random(); //Converting [0,1) to (0,1)
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function pickPosUniform(min, max) {
    // we should prefer center positions
    var min1 = 0;
    var min2 = 0;
    var max1 = 0;
    var max2 = 0;
    if (typeof min == 'object') { // or 'number'
        min1 = min[0];
        min2 = min[1];
    } else {
        min1 = min;
        min2 = min;
    }
    if (typeof max == 'object') {
        max1 = max[0];
        max2 = max[1];
    } else {
        max1 = max;
        max2 = max;
    }

    let r1 = (Math.random() * (max1 - min1)) - min1;
    r1 = (r1 < 0 ? 0 : r1);
    r1 = (r1 > max1 ? max1 : r1);
    let r2 = (Math.random() * (max2 - min2)) - min2;
    r1 = Math.round(r1);
    r2 = Math.round(r2);
    r2 = (r2 < 0 ? 0 : r2);
    r2 = (r2 > max2 ? max2 : r2);
    return [r1, r2];
}

function pickPos(min, max) {
    // we should prefer center positions
    var min1 = 0;
    var min2 = 0;
    var max1 = 0;
    var max2 = 0;
    if (typeof min == 'object') { // or 'number'
        min1 = min[0];
        min2 = min[1];
    } else {
        min1 = min;
        min2 = min;
    }
    if (typeof max == 'object') {
        max1 = max[0];
        max2 = max[1];
    } else {
        max1 = max;
        max2 = max;
    }

    var r1 = gaussianRandom((max1 - min1) / 2.0, (max1 - min1) / 6.0);
    r1 = (r1 < 0 ? 0 : r1);
    r1 = (r1 > max1 ? max1 : r1);
    var r2 = gaussianRandom((max2 - min2) / 2.0, (max2 - min2) / 6.0);
    r1 = Math.round(r1);
    r2 = Math.round(r2);
    r2 = (r2 < 0 ? 0 : r2);
    r2 = (r2 > max2 ? max2 : r2);
    return [r1, r2];
}

function checkIntersection(paths, path1, allowSmallIntersections) {
    if (typeof allowSmallIntersections == 'undefined')
        allowSmallIntersections = true;
    for (var i in paths) {
        var path0 = paths[i];
        var intersection = intersect(path0, path1);
        // Some intersections  might  be ok,  for example of the two strokes are long
        // We would really like to test  here for the angle of intersection but for now
        // we can simply use the number of intersecting points.
        if (allowSmallIntersections && intersection.length == 4 && path0.length > 300 && path1.length > 300) {
            // maybe check if the 4 points are close enough together?
            var cc = [[intersection[0].x, intersection[1].x, intersection[2].x, intersection[3].x], [intersection[0].y, intersection[1].y, intersection[2].y, intersection[3].y]];
            var size = [Math.max(...cc[0]) - Math.min(...cc[0]), Math.max(...cc[1]) - Math.min(...cc[1])];
            if (size[0] + size[1] < 90)
                return false;
            return true;
        }
        if (intersection.length > 0) {
            return true;
        }
    }
    return false; // no intersection
}


function makeRequest(method, url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: xhr.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}

var dictCache = null;
var sizeDistributionCache = null;

class Vis2Vec {
    dictionary = undefined;
    sizeDistribution = undefined;
    constructor() {
        this.dictionary = undefined;
        this.sizeDistribution = undefined;
    }
    // return a promise for when all setup is done
    init() {
        var promises = [];
        if (this.dictionary != undefined) {
            promises.push(Promise.resolve());
        } else {
            promises.push(makeRequest('GET', 'https://raw.githubusercontent.com/HaukeBartsch/vis2vec/main/data/dictionary.txt').then((data) => {
                this.dictionary = [];
                var content = data.toString('utf8').split("\n");
                for (let c in content)
                    this.dictionary.push(content[c]);
            }));
        }
        if (this.sizeDistribution != undefined) {
            promises.push(Promise.resolve());
        } else {
            promises.push(makeRequest('GET', 'https://raw.githubusercontent.com/HaukeBartsch/vis2vec/main/data/sizeDistribution.json').then((data) => {
                this.sizeDistribution = JSON.parse(data);
            }));
        }
        return Promise.all(promises);
    }
    predict() {
        if (typeof this.dictionary == 'undefined' || typeof this.sizeDistribution == 'undefined') {
            throw new Error("Not initialized");
        }
        let box_path = "M 0 0 L 1024 0 L 1024 1024 L 0 1024 L 0 0"; // should be square box as big as our drawing area (0..1024, 0..1024)

        let character = [box_path]; // every character is a list of drawing commands (existing dictionary entries placed inside the box)

        let attempt = 0;
        // how many characters for this?
        var numStrokes = 2 + Math.max(1, Math.floor(gaussianRandom(7, 2)));

        while (attempt < 100) {
            if (character.length > numStrokes)
                break;
            var randomStroke = null;
            randomStroke = pickStroke(this.dictionary, this.sizeDistribution);
            for (var i = 0; i < 100; i++) {
                // the strokes first position is not the center
                var path = setStartPosition(randomStroke, pickPos(0, 1024));
                if (!checkIntersection(character, path)) {
                    character.push(path);
                    break; // try with the next random stroke
                }
                attempt++;
            }
        }
        character.shift();  // remove the box again
        return character;
    }
    predictPath() {
        let character = this.predict();
        let newpath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        newpath.setAttributeNS(null, "d", character.join(" "));
        return newpath;
    }
}


function predict(dictionaryPaths) {

    if (typeof dictionaryPaths == 'undefined') {
        // use the submitted dictionary
        return;
    }

    // get the size distribution from sizeDistribution.json
    var sizeDistribution = null;
    if (sizeDistributionCache == null) {
        const contentRaw = fs.readFileSync("sizeDistribution.json");
        sizeDistribution = JSON.parse(contentRaw);
        sizeDistributionCache = sizeDistribution;
    } else {
        sizeDistribution = sizeDistributionCache;
    }
    var dict = null;
    if (dictCache == null) {
        var dict = [];
        for (var f = 0; f < dictionaryPaths.length; f++) {
            var filePath = dictionaryPaths[f];
            console.log("read: " + filePath);
            const contentRaw = fs.readFileSync(filePath);
            var content = contentRaw.toString('utf8').split("\n");
            for (c in content)
                dict.push(content[c]);
        }
        dictCache = dict;
    } else {
        dict = dictCache;
    }
    //console.log("got " + dict.length + " entries in dictionary.");
    // so we can draw now some number of characters and place them inside a box
    let character = [box_path]; // every character is a list of drawing commands (existing dictionary entries placed inside the box)

    let attempt = 0;
    // how many characters for this?
    var numStrokes = 2 + Math.max(1, Math.floor(gaussianRandom(7, 2)));

    while (attempt < 2000) {
        if (character.length > numStrokes)
            break;
        var randomStroke = null;
        /*if (character.length < 3 && attempt < 200) {
            randomStroke = pickStrokeLarge(dict, 0.001);
        } else { */
        randomStroke = pickStroke(dict, sizeDistribution);
        //}
        for (var i = 0; i < 1000; i++) {
            // the strokes first position is not the center
            var path = setStartPosition(randomStroke, pickPos(0, 1024));
            if (!checkIntersection(character, path)) {
                character.push(path);
                break; // try with the next random stroke
            }
            attempt++;
        }
    }
    character.shift();  // remove the box again
    //console.log(character);
    //console.log("strokes: " + character.length);
    return character;
}




function draw(ctx, length, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, length, length);

    return { length, x, y, color };
}

export { Vis2Vec, name, draw, predict };
