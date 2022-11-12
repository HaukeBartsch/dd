// This is its own worker thread
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { parse } = require("csv-parse");


parentPort.on('message', function (a) {
    if (a[0] == "loadDefaults") {
        parentPort.postMessage(["msg", "start loading defaults in loader"]);
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

            console.log("done");
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
                // where are the records going?
                console.log("got a record! : %s\n", JSON.stringify(record));
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
