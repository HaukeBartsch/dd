const { Worker, isMainThread, parentPort } = require('worker_threads');
const DecompressZip = require("decompress-zip");
const w2v = require("word2vec");

/**
 * We would like to be able to look for similar words given our domain. We can train a word2vec model on the database.json and
 * see what we get back in case the users searches for one item.
 */

var cached_model = null; // not yet loaded

parentPort.on('message', function (a) {
    if (a[0] == "search-similarity") {
        // if we don't have a model yet, load that one first and initialize
        var search_term = a[1].toLowerCase();
        if (cached_model == null) {
            // load model first and afterwards search
            loadModel().then(function () {
                var result = cached_model.mostSimilar(search_term);
                //console.log("start a search for such a word: " + search_term + " got back: " + JSON.stringify(result));
                // send back to main, add to user interface
                parentPort.postMessage(["found-similarity", result]);
            });
        } else {
            var result = cached_model.mostSimilar(search_term);
            console.log("start a search for such a word: " + search_term);
            // send back to main, add to user interface
            parentPort.postMessage(["found-similarity", result]);
        }
    }
})


// should return a Promise
function loadModel() {
    return new Promise((resolve, reject) => {
        const fs = require("fs");
        const https = require("https");
        const temp = require("temp");

        // read the compressed vectors.txt file
        var url = "https://raw.githubusercontent.com/HaukeBartsch/dd/main/vectors.zip";
        temp.open("vectors_zip_download", function (err, info) {
            var fname = info.path;

            const file = fs.createWriteStream(fname);
            console.log("In loadModel (word2vec)... ");
            https.get(url, response => {
                var stream = response.pipe(file);

                file.on("finish", () => {
                    file.close();
                });

                stream.on("finish", function () {
                    var unzipper = new DecompressZip(fname);

                    unzipper.on('error', function (err) {
                        console.log('Caught an error');
                    });

                    unzipper.on('extract', function (log) {
                        console.log('Finished extracting');
                        // we should have the model now in a file uncompressed
                        w2v.loadModel("/tmp/vectors.txt", function (error, model) {
                            cached_model = model;
                            resolve(cached_model);
                        });
                    });

                    unzipper.extract({ path: "/tmp/" });
                });
            });
        });

    });
}