// This is its own worker thread
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { parse } = require("csv-parse");


parentPort.on('message', function (a) {
    if (a[0] == "loadDefaults") {
        //parentPort.postMessage(["msg", "start loading defaults in loader"]);
        downloadCollection(a[0], "https://raw.githubusercontent.com/HaukeBartsch/dd/main/dd_collection.json");
        // maybe we can update the interface after loading each group?
        downloadREDCapListFromREDCapLoc(a[0]);
        downloadHUNT(a[0]);
        downloadHUNTVariables(a[0]);
        downloadHelseData(a[0]);
    }
})

// todo: add the left side variables: https://helsedata.no/no/variabler/?page=search
function downloadHelseData(req, page) {
    if (typeof page == "undefined") {
        page = 1;
    }
    var url = "https://helsedata.no/api/1.0/variable/FullSearch?q=gender&page=1&sort=0";
    url = "https://helsedata.no/api/1.0/variable/FullSearch?q=&page=" + page + "&sort=0"; // this will get us 100 entries, we should page more

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("helseData_variables", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        //console.log("In downloadHelseData... ");
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                // what is the string in this stream?
                // read the data from the file again

                const content = fs.readFileSync(fname);
                contentJSON = JSON.parse(content);
                //console.log("hi there");
                var data = contentJSON.payload.result;
                var results = [];
                var projs = {};
                var insts = {};
                for (var i = 0; i < data.length; i++) {
                    var entry = data[i];
                    var description = typeof entry.descriptionEnglish != 'undefined' ? entry.descriptionEnglish : entry.description;
                    if (description == null && (entry.name != null || entry.nameEnglish != null)) {
                        description = entry.nameEnglish != null ? entry.nameEnglish : entry.name;
                    }
                    // the project name (a register for example)
                    var p = entry.parentRegisterName.toLowerCase().replace(/ /g, "_");
                    var uri = "helsedata://" + p + "?instrument=";
                    projs[p] = {
                        "project": {
                            "name": p,
                            "description": "",
                            "version": "",
                            "instruments": uri,
                            "uri": uri
                        }
                    };
                    if (entry.theme != null) {
                        // add as an instrument
                        insts[entry.theme] = {
                            "instrument": {
                                "Instrument Title": entry.theme,
                                "Instrument Version": "",
                                "Description": "",
                                "Instrument Part": "",
                                "uri": uri + encodeURI(entry.theme),
                                "fields": uri + encodeURI(entry.theme)
                            }
                        };
                    }

                    results.push({
                        "field": {
                            "ElementName": entry.code,
                            "DataType": entry.dataType,
                            "Instrument Part": entry.code,
                            "ElementDescription": description,
                            "FormName": uri,
                            "uri": uri,
                            "fields": uri
                        }
                    });
                }
                // if we have projects send those
                var pro = Object.keys(projs);
                for (var i = 0; i < pro.length; i++) {
                    results.push(projs[pro[i]]);
                }
                var ins = Object.keys(insts);
                for (var i = 0; i < ins.length; i++) {
                    results.push(insts[ins[i]]);
                }

                parentPort.postMessage([req, results]);
                if (results.length > 0) {
                    // request another page
                    setTimeout(function () {
                        downloadHelseData(req, ++page);
                    }, 10);
                }
            });
        });
    });

}

function downloadHUNT(req) {

    var uri = "hunt://hunt?release=hunt-db.medisin.ntnu.no";
    // curl 'https://hunt-db.medisin.ntnu.no/hunt-db/graphql' \
    //-X 'POST' \
    //-H 'Accept: application/json, text/plain, */* ' \
    //-H 'Content - Type: application / json' \
    //-H 'Origin: https://hunt-db.medisin.ntnu.no' \
    //    -H 'Content-Length: 4502' \
    //    -H 'Accept-Language: en-US,en;q=0.9' \
    //    -H 'Host: hunt-db.medisin.ntnu.no' \
    //    -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Safari/605.1.15' \
    //    -H 'Referer: https://hunt-db.medisin.ntnu.no/hunt-db/variablelist' \
    //    -H 'Accept-Encoding: gzip, deflate, br' \
    //    -H 'Connection: keep-alive' \
    //    --data - binary '{"query":"query filtercollectionRefetchQuery(\n  $surveyFilter: [String]\n  $surveyCount: Int\n  $studyFilter: [String]\n  $studyCount: Int\n  $studyPartFilter: [String]\n  $studyPartCount: Int\n  $instrumentFilter: [String]\n  $instrumentCount: Int\n  $variableGroupCount: Int\n  $variableGroupFilter: [String]\n  $variableFilter: [ID]\n  $limitSurveys: Boolean\n  $limitStudies: Boolean\n  $limitStudyParts: Boolean\n  $limitInstruments: Boolean\n  $limitVariableGroups: Boolean\n  $limitVariables: Boolean\n) {\n  ...filtercollection_viewer_3U635X\n}\n\nfragment filtercollection_viewer_3U635X on Viewer {\n  ...surveyfilter_viewer_3bYWbf\n  ...studyfilter_viewer_3trzrc\n  ...studypartfilter_viewer_3s0g7G\n  ...instrumentfilter_viewer_xrv1a\n  ...variablegroupfilter_viewer_m9mCM\n}\n\nfragment instrumentfilter_viewer_xrv1a on Viewer {\n  instruments(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $instrumentCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment studyfilter_viewer_3trzrc on Viewer {\n  studies(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $studyCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment studypartfilter_viewer_3s0g7G on Viewer {\n  studyParts(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $studyPartCount) {\n    edges {\n      enabled\n      node {\n        id\n        name\n        title\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment surveyfilter_viewer_3bYWbf on Viewer {\n  surveys(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $surveyCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment variablegroupfilter_viewer_m9mCM on Viewer {\n  variableGroups(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariables: $limitVariables, first: $variableGroupCount) {\n    edges {\n      enabled\n      node {\n        id\n        name\n        title\n      }\n    }\n  }\n}\n","variables":{"surveyFilter":[],"surveyCount":20,"studyFilter":[],"studyCount":20,"studyPartFilter":[],"studyPartCount":20,"instrumentFilter":[],"instrumentCount":500,"variableGroupCount":20,"variableGroupFilter":[],"variableFilter":null,"limitSurveys":false,"limitStudies":false,"limitStudyParts":false,"limitInstruments":false,"limitVariableGroups":false,"limitVariables":false}}'

    // download the list of instruments first
    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("hunt_instruments", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        console.log("In downloadCollection... ");
        var postData = {
            "query": "query filtercollectionRefetchQuery(\n  $surveyFilter: [String]\n  $surveyCount: Int\n  $studyFilter: [String]\n  $studyCount: Int\n  $studyPartFilter: [String]\n  $studyPartCount: Int\n  $instrumentFilter: [String]\n  $instrumentCount: Int\n  $variableGroupCount: Int\n  $variableGroupFilter: [String]\n  $variableFilter: [ID]\n  $limitSurveys: Boolean\n  $limitStudies: Boolean\n  $limitStudyParts: Boolean\n  $limitInstruments: Boolean\n  $limitVariableGroups: Boolean\n  $limitVariables: Boolean\n) {\n  ...filtercollection_viewer_3U635X\n}\n\nfragment filtercollection_viewer_3U635X on Viewer {\n  ...surveyfilter_viewer_3bYWbf\n  ...studyfilter_viewer_3trzrc\n  ...studypartfilter_viewer_3s0g7G\n  ...instrumentfilter_viewer_xrv1a\n  ...variablegroupfilter_viewer_m9mCM\n}\n\nfragment instrumentfilter_viewer_xrv1a on Viewer {\n  instruments(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $instrumentCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment studyfilter_viewer_3trzrc on Viewer {\n  studies(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $studyCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment studypartfilter_viewer_3s0g7G on Viewer {\n  studyParts(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $studyPartCount) {\n    edges {\n      enabled\n      node {\n        id\n        name\n        title\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment surveyfilter_viewer_3bYWbf on Viewer {\n  surveys(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariableGroups: $limitVariableGroups, limitVariables: $limitVariables, first: $surveyCount) {\n    edges {\n      enabled\n      node {\n        id\n        title\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment variablegroupfilter_viewer_m9mCM on Viewer {\n  variableGroups(surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, variableFilter: $variableFilter, limitSurveys: $limitSurveys, limitStudies: $limitStudies, limitStudyParts: $limitStudyParts, limitInstruments: $limitInstruments, limitVariables: $limitVariables, first: $variableGroupCount) {\n    edges {\n      enabled\n      node {\n        id\n        name\n        title\n      }\n    }\n  }\n}\n",
            "variables": {
                "surveyFilter": [],
                "surveyCount": 20,
                "studyFilter": [],
                "studyCount": 200,
                "studyPartFilter": [],
                "studyPartCount": 20,
                "instrumentFilter": [],
                "instrumentCount": 500,
                "variableGroupCount": 200,
                "variableGroupFilter": [],
                "variableFilter": null,
                "limitSurveys": false,
                "limitStudies": false,
                "limitStudyParts": false,
                "limitInstruments": false,
                "limitVariableGroups": false,
                "limitVariables": false
            }
        };
        var postDataJSON = JSON.stringify(postData);
        var options = {
            hostname: "hunt-db.medisin.ntnu.no",
            port: 443,
            path: '/hunt-db/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postDataJSON.length
            }
        };

        var request = https.request(options, (response) => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                var contentParsed = JSON.parse(content.toString());
                if (contentParsed != null && typeof contentParsed.data != 'undefined') {
                    var data = contentParsed.data;
                    var results = [];
                    // start with the instruments
                    for (var i = 0; i < data.instruments.edges.length; i++) {
                        var entry = data.instruments.edges[i].node;
                        // we have a description, id, name, title and __typename
                        results.push({
                            "instrument": {
                                "Instrument Title": entry.title,
                                "Instrument Version": entry.id,
                                "Description": entry.description,
                                "Instrument Part": entry.id,
                                "fields": uri + "&instrument=" + entry.name,
                                "uri": uri + "&instrument=" + entry.name
                            }
                        });
                        // we should have a list of instruments now
                        // console.log("download " + uri + " with resource: " + uri);
                    }
                    // add the studies (make them projects)
                    for (var i = 0; i < data.studies.edges.length; i++) {
                        var entry = data.studies.edges[i].node;
                        results.push({
                            "project": {
                                "name": entry.title + " (" + entry.name + ")",
                                "description": typeof entry.description != "undefined" ? entry.description : "",
                                "version": "",
                                "instruments": "hunt://" + entry.name + "?release=hunt-db.medisin.ntnu.no",
                                "uri": "hunt://" + entry.name + "?release=hunt-db.medisin.ntnu.no"
                            }
                        });
                    }
                    parentPort.postMessage([req, results]);
                }
            });
        });
        request.on('error', (e) => {
            console.log("error");
        });
        request.write(postDataJSON);
        request.end();

    }); // should cleanup the downloaded file
}

function downloadHUNTVariables(req) {
    var uri = "hunt://hunt?release=hunt-db.medisin.ntnu.no";

    // download the list of instruments first
    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("hunt_variables", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        console.log("In downloadCollection... ");
        var postData = {
            "query": "query variablepaginationQuery(\n  $variableCount: Int!\n  $after: String!\n  $surveyFilter: [String]\n  $studyFilter: [String]\n  $studyPartFilter: [String]\n  $instrumentFilter: [String]\n  $variableGroupFilter: [String]\n  $search: String\n  $orderBy: OrderBy\n  $orderDirection: OrderDirection\n) {\n  ...variablepagination_viewer\n}\n\nfragment variablepagination_viewer on Viewer {\n  variables(first: $variableCount, after: $after, surveyFilter: $surveyFilter, studyFilter: $studyFilter, studyPartFilter: $studyPartFilter, instrumentFilter: $instrumentFilter, variableGroupFilter: $variableGroupFilter, search: $search, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        __typename\n        id\n        ...variablerow_variable\n      }\n      cursor\n    }\n    variableCount\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment variablerow_variable on Variable {\n  __isVariable: __typename\n  id\n  questionId\n  title\n  questionName\n  variableName\n  text\n  textEnglish\n  clusterVariable {\n    __typename\n    id\n    questionName\n    questionId\n    variableName\n    title\n  }\n  n\n  type\n  instrument {\n    name\n    title\n    id\n  }\n  variableGroup {\n    name\n    title\n    id\n  }\n  groupDefault\n  groupDefaultVariables {\n    edges {\n      node {\n        __typename\n        id\n        variableName\n        title\n        textEnglish\n        n\n      }\n    }\n  }\n  studyPart {\n    id\n    name\n    title\n    description\n    study {\n      id\n      name\n      title\n      description\n      survey {\n        id\n        name\n        title\n        description\n      }\n    }\n  }\n  variableAffiliation {\n    id\n    exclusivityTo\n    variableAffiliate {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n}\n",
            "variables": {
                "variableCount": 100000,
                "after": "YXJyYXljb25uZWN0aW9uOjE5",
                "surveyFilter": [],
                "studyFilter": [],
                "studyPartFilter": [],
                "instrumentFilter": [],
                "variableGroupFilter": [],
                "search": null,
                "orderBy": "STUDYPART",
                "orderDirection": "ASC"
            }
        };
        var postDataJSON = JSON.stringify(postData);
        var options = {
            hostname: "hunt-db.medisin.ntnu.no",
            port: 443,
            path: '/hunt-db/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postDataJSON.length
            }
        };

        var request = https.request(options, (response) => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                var contentParsed = JSON.parse(content.toString());
                if (contentParsed != null && typeof contentParsed.data != 'undefined') {
                    var data = contentParsed.data;
                    var results = [];
                    for (var i = 0; i < data.variables.edges.length; i++) {
                        var entry = data.variables.edges[i].node;
                        // we have information about the text, textEnglish, title, type, instrument.name, instrument.title, questionName
                        results.push({
                            "field": {
                                "ElementName": entry.variableName,
                                "DataType": entry.type,
                                "Instrument Part": entry.instrument.title,
                                "ElementDescription": entry.textEnglish.length > 0 ? entry.textEnglish : entry.text,
                                "FormName": "hunt://hunt?instrument=" + entry.instrument.name,
                                "fields": "hunt://hunt?instrument=" + entry.instrument.name + "&release=hunt-db.medisin.ntnu.no",
                                "uri": "hunt://hunt?instrument=" + entry.instrument.name + "&release=hunt-db.medisin.ntnu.no"
                            }
                        });
                    }
                    parentPort.postMessage([req, results]);
                }
            });
        });
        request.on('error', (e) => {
            console.log("error");
        });
        request.write(postDataJSON);
        request.end();

    }); // should cleanup the downloaded file

}

// provide a request and send it back so we know what this responds to
function downloadREDCapListFromREDCapLoc(req) {
    url = "https://redcap.vanderbilt.edu/consortium/library/instrument_download.php";

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("redcap_library_instruments", function (err, info) {
        var fname = info.path;

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
        //console.log("In downloadAndParse for a single instrument... " + uri);
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
                        ergs[i].field.uri = uri;
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
                            "fields": uri,
                            "uri": uri
                        }
                    }]]);
                    parentPort.postMessage([req, [{
                        "project": {
                            "name": s.project,
                            "version": s.project_version,
                            "instruments": uri,
                            "uri": uri
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