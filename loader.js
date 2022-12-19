// This is its own worker thread
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { parse } = require("csv-parse");


parentPort.on('message', function (a) {
    if (a[0] == "loadDefaults") {
        //parentPort.postMessage(["msg", "start loading defaults in loader"]);
        downloadCollection(a[0], "https://raw.githubusercontent.com/HaukeBartsch/dd/main/dd_collection.json");
        downloadREDCapListFromREDCapLoc(a[0]);
    }
    //parentPort.postMessage(["PPPP", a]);
})

// provide a request and send it back so we know what this responds to
function downloadREDCapListFromREDCapLoc(req) {
    url = "https://redcap.vanderbilt.edu/consortium/library/instrument_download.php";

    const fs = require("fs");
    const https = require("https");

    var fname = "redcap_library_instruments.csv";
    const file = fs.createWriteStream(fname);
    console.log("In downloadREDCapListFromREDCapLoc... ");
    https.get(url, response => {
        var stream = response.pipe(file);

        file.on("finish", () => {
            file.close();
        });

        stream.on("finish", function () {
            // what is the string in this stream?
            // read the data from the file again

            // parse the received csv file
            const parser = parse({
                delimiter: ','
            });
            var records = [];
            parser.on('readable', function () {
                let record;
                while ((record = parser.read()) !== null) {
                    records.push(record);
                }
            });
            // Catch any error
            parser.on('error', function (err) {
                console.error(err.message);
            });
            parser.on('end', function () {
                parentPort.postMessage([req, records]);
            });
            const content = fs.readFileSync(fname);
            parser.write(content.toString());
            parser.end();
        });
    });
}

// download all data dictionaries mentioned in this collection
function downloadCollection(req, url) {
    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");


    temp.open("dd_collection_download", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        console.log("In downloadCollection... ");
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                // content.toString());
                contentParsed = JSON.parse(content.toString());
                for (var i = 0; i < contentParsed.length; i++) {
                    // lets download this resource's URL (use the parser from the uri)
                    var url = contentParsed[i].url;
                    var uri = contentParsed[i].uri;
                    s = parseURI(uri);
                    var parser = parseAsNDAInstrument;
                    if (s.protocol == "nda:") {
                        parser = parseAsNDAInstrument;
                    } else {
                        console.log("Error: unknown parser based on uri entry: " + s.protocol + " (could be \"nda\")");
                        continue;
                    }
                    downloadAndParse(req, url, uri, parser);
                    // check if the uri first part is "nda" - use the above reader function
                    console.log("download " + url + " with resource: " + uri);
                }
            });
        });
    }); // should cleanup the downloaded file
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
    var parsed = new URL(str);
    s.project = parsed.host;
    s.protocol = parsed.protocol;
    parsed.searchParams.forEach(function (value, key) {
        var pair = [key, value];
        if (decodeURIComponent(pair[0]) == "instrument") {
            s.instrument = decodeURIComponent(pair[1]);
        } else if (decodeURIComponent(pair[0]) == "version") {
            s.instrument_version = decodeURIComponent(pair[1]);
        } else if (decodeURIComponent(pair[0]) == "part") {
            s.instrument_part = decodeURIComponent(pair[1]);
        } else if (decodeURIComponent(pair[0]) == "release") {
            s.project_version = decodeURIComponent(pair[1]);
        }
    });

    return s;
}

function downloadAndParse(req, url, uri, parser) {
    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");
    temp.track(); // remove the file again after we leave this function

    temp.open('dd_temp_file', function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        console.log("In downloadAndParse for a single instrument... " + uri);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                var c = parser(content.toString()).then(function (ergs) {
                    // add to each entry the FormName
                    for (var i = 0; i < ergs.length; i++) {
                        ergs[i].field.FormName = uri;
                    }
                    // we could analyze the uri here to extract the info we need
                    s = parseURI(uri);

                    parentPort.postMessage([req, ergs]);
                    // we should add a message for the instrument here as well
                    parentPort.postMessage([req, [{
                        "instrument": {
                            "Instrument Title": s.instrument,
                            "Instrument Version": s.instrument_version,
                            "Instrument Part": s.instrument_part,
                            "fields": uri
                        }
                    }]]);
                    parentPort.postMessage([req, [{
                        "project": {
                            "name": s.project,
                            "version": s.project_version,
                            "instruments": uri
                        }
                    }]]);
                });
                /*                    for (var i = 0; i < ergs.length; i++) {
                                        // announce this to the db
                                        parentPort.postMessage([req, ergs[i]]); // this would be "loadDefaults" with an array of dicts but what is the type?
                                    } */
            });
        });
    }); // should cleanup the temporary file now
}

// returns the str as a REDCap instrument structure for db (list of instruments and items)
function parseAsNDAInstrument(str) {
    return new Promise((resolve, reject) => {
        const parser = parse({
            delimiter: ','
        });
        var records = [];
        parser.on('readable', function () {
            let record;
            while ((record = parser.read()) !== null) {
                records.push(record);
            }
        });
        // Catch any error
        parser.on('error', function (err) {
            console.error(err.message);
            reject(err.message);
        });
        parser.on('end', function () {
            // we have a structure here that has the rows of the data dictionary,
            // we should use a JSON structure instead
            var res = [];
            var header = records[0];
            for (var i = 1; i < records.length; i++) {
                var entry = {};
                for (var j = 0; j < header.length; j++) {
                    entry[header[j]] = records[i][j];
                }
                res.push({ "field": entry }); // if this would be an instrument it would say so
            }
            resolve(res);
            //parentPort.postMessage([req, records]);
        });
        parser.write(str);
        parser.end();
    });
}