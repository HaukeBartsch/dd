// This is its own worker thread
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { parse } = require("csv-parse");

// TODO: we need a unique ID for each entry that is valid across instances
//       Those ids would be needed for recommendations as well as comments.

parentPort.on('message', function (a) {
    if (a[0] == "loadDefaults") {
        //parentPort.postMessage(["msg", "start loading defaults in loader"]);
        downloadCollection(a[0], "https://raw.githubusercontent.com/HaukeBartsch/dd/main/dd_collection.json");
        // maybe we can update the interface after loading each group?
        downloadREDCapListFromREDCapLoc(a[0]);
        downloadHUNT(a[0]);
        downloadHUNTVariables(a[0]);
        downloadHelseData(a[0]);
        downloadCristinProjects(a[0], 1, 10);
        downloadIdentifiers(a[0], 1, 100); // download the different pages from Identifiers
        downloadCDEs(a[0], "https://raw.githubusercontent.com/HaukeBartsch/dd/main/CDEs.json")
        // the next section requires a key from bioportals (added to .env)
        require("dotenv").config();
        if (typeof process.env.BIOONTOLOGY_API_KEY != "undefined") {
            downloadBioOntologyProjects(a[0]);
            // seeding ontologies, we will download them as projects + we will download the root for each of them
            downloadBioOntologyOntologies(a[0]);
            downloadBioOntologyClasses(a[0], "SNOMEDCT", 1, 100); // load at most 10 pages of these
            //downloadBioOntologyRoots(a[0], "SNOMEDCT");
            //downloadBioOntologyRoots(a[0], "RXNORM");
            //downloadBioOntologyRoots(a[0], "MDDB");
        }
    }
})

function downloadIdentifiers(req, page, max_pages) {

    var uri = "identifiers://identifiers.org/";
    var url = "https://registry.api.identifiers.org/restApi/namespaces?page=" + page + "&size=20&sort=name%2Casc";

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("identifiers_projects", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                try {
                    contentJSON = JSON.parse(content);
                } catch (e) {
                    // if we cannot receive roots we should skip here
                    return;
                }
                contentJSON = contentJSON["_embedded"]["namespaces"];
                var proj = [];
                for (var i = 0; i < contentJSON.length; i++) {
                    var entry = contentJSON[i];
                    // if we would call again using the cristin_project_id we would get the popular science description for each project
                    proj.push({
                        "project": {
                            "name": entry.name,
                            "description": entry.description,
                            "version": entry.prefix + ":" + entry.sampleId,
                            "instruments": uri,
                            "@id": "identifiers-id" + entry.prefix + ":" + entry.sampleId + "-" + entry.mirId,
                            "uri": uri + "?instrument=" + entry.prefix + ":" + entry.sampleId
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
                // for each class we should download the variables as well
                setTimeout(function () {
                    downloadIdentifiers(req, ++page, max_pages);
                }, 10);
            });
        });
    });


}

function downloadCristinProjects(req, page, max_pages, proj) {

    if (typeof proj == "undefined")
        proj = [];
    if (page > max_pages) { // only at the very end do this and only once
        if (proj.length > 0) {
            setTimeout(function () {
                downloadCristinProjectsDescription(req, proj); // download all the descriptions
            }, 200);
        }
        return; // end here
    }

    var uri = "cristin://cristin.no/";
    var url = "https://api.cristin.no/v2/projects?page=" + page;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("cristin_projects", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                try {
                    contentJSON = JSON.parse(content);
                } catch (e) {
                    // if we cannot receive roots we should skip here
                    return;
                }
                for (var i = 0; i < contentJSON.length; i++) {
                    var entry = contentJSON[i];
                    // if we would call again using the cristin_project_id we would get the popular science description for each project
                    proj.push(entry.cristin_project_id);
                }
                // for each class we should download decendences
                setTimeout(function () {
                    downloadCristinProjects(req, ++page, max_pages, proj);
                }, 10);
            });
        });
    });
}

function downloadCristinProjectsDescription(req, entries) {

    var uri = "cristin://cristin.no/";
    var cristin_id = entries.shift();
    var url = "https://api.cristin.no/v2/projects/" + cristin_id;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("cristin_descriptions", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                try {
                    entry = JSON.parse(content);
                } catch (e) {
                    // if we cannot receive roots we should skip here
                    return;
                }
                var title = "";
                if (typeof entry.title != "undefined") {
                    if (typeof entry.title.en != "undefined")
                        title = entry.title.en;
                    if (title == "" && typeof entry.title.no != "undefined")
                        title = entry.title.no;
                }
                var description = "";
                if (typeof entry.academic_summary != "undefined") {
                    if (typeof entry.academic_summary.en != "undefined")
                        description = entry.academic_summary.en;
                    if (description == "" && typeof entry.academic_summary.no != "undefined")
                        description = entry.academic_summary.no;
                }

                if (title.length > 0) {
                    var proj = [];
                    // if we would call again using the cristin_project_id we would get the popular science description for each project
                    proj.push({
                        "project": {
                            "name": title,
                            "description": description,
                            "version": "",
                            "instruments": uri,
                            "@id": "cristin-id" + entry.cristin_project_id,
                            "uri": uri
                        }
                    });
                    parentPort.postMessage([req, proj]);
                }
                // for each class we should download decendences
                setTimeout(function () {
                    downloadCristinProjectsDescription(req, entries);
                }, 100);
            });
        });
    });
}


// /ontologies/:ontology/classes/roots
function downloadBioOntologyRoots(req, ontology) {
    require("dotenv").config();
    // key for BioOntology is now process.env.BIOONTOLOGY_API_KEY
    // we could have a list of ontologies in the second argument as well, use up the first and loop until list is empty
    var ontology_short = "";
    var page = 1;
    var max_pages = 1;
    if (Array.isArray(ontology)) {
        if (ontology.length == 0)
            return; // we are done
        var elem = ontology.shift();
        ontology_short = elem.name;
        page = elem.page;
        max_pages = elem.max_pages;
    } else {
        ontology_short = ontology;
    }

    // get the projects from BioOntology  http://data.bioontology.org/projects
    var uri = "bioontologies://" + ontology_short;
    var url = "https://data.bioontology.org/ontologies/" + ontology_short + "/classes/roots_paged?apikey=" + process.env.BIOONTOLOGY_API_KEY + "&page=" + page;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("bioontology_roots", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                try {
                    contentJSON = JSON.parse(content);
                } catch (e) {
                    // if we cannot receive roots we should skip here
                    return;
                }
                // we might be rejected due to access limitations, lets ignore these requests
                if (typeof contentJSON.errors != "undefined") {
                    contentJSON.collection = [];
                }

                //console.log("got some data :  " + content);
                var proj = [];
                for (var i = 0; i < contentJSON.collection.length; i++) {
                    var entry = contentJSON.collection[i];
                    if (entry.obsolete)
                        continue;
                    var instrument_str = "";
                    if (entry['cui'].length > 0) {
                        instrument_str = "?instrument=" + entry["cui"][0];
                    }
                    proj.push({
                        "field": {
                            "ElementName": entry.prefLabel + " [" + entry['cui'].join(",") + "]",
                            "descendants_link": entry["links"].descendants,
                            "DataType": "class",
                            "Instrument Part": ontology_short,
                            "ElementDescription": entry["@id"] + "</br>" + entry.synonym.join(", ") + "</br>" + entry.definition.join(", "),
                            "FormName": uri,
                            "uri": uri + instrument_str,
                            "@id": entry["@id"], // a unique identifier 
                            "fields": uri
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
                // for each class we should download decendences
                var descendants_links = [];
                for (var c = 0; c < proj.length; c++) {
                    var descendants_link = proj[c].field.descendants_link;
                    if (typeof descendants_link != "undefined" && descendants_link.length > 0) {
                        descendants_links.push([proj[c].field.ElementName, descendants_link]);
                    }
                }
                downloadBioOntologyDecendants(req, ontology_short, descendants_links);

                // if we got something for this ontology and our page is not max_pages yet lets add another page to download
                if (proj.length > 0 && (elem.page + 1) <= elem.max_page) {
                    elem.page = elem.page + 1;
                    ontology.push(elem);
                }

                if (ontology.length > 0) { // still something to do here
                    setTimeout(function () {
                        downloadBioOntologyRoots(req, ontology); // is called with array once smaller
                    }, 200);
                }
            });
        });
    });
}

// /ontologies/:ontology/classes/:cls/descendants
function downloadBioOntologyDecendants(req, ontology, descendants_links) {
    require("dotenv").config();
    // key for BioOntology is now process.env.BIOONTOLOGY_API_KEY
    var descendants_link = "";
    var parent = "";
    if (descendants_links.length > 0) {
        var a = descendants_links.shift();
        descendants_link = a[1];
        parent = a[0];
    } else {
        return; // nothing else to do
    }

    // get the projects from BioOntology  http://data.bioontology.org/projects
    var uri = "bioontologies://" + ontology + "?instrument=" + encodeURIComponent(parent);
    var url = descendants_link + "?apikey=" + process.env.BIOONTOLOGY_API_KEY;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("bioontology_decendants_classes", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                try {
                    contentJSON = JSON.parse(content);
                } catch (e) {
                    return; // if we don't get good JSON do nothing
                }
                //console.log("got some data :  " + content);
                var proj = [];
                if (typeof contentJSON.collection == 'undefined') {
                    return;
                }
                for (var i = 0; i < contentJSON.collection.length; i++) {
                    var entry = contentJSON.collection[i];
                    if (entry.obsolete)
                        continue;
                    var id_str = (entry["@id"].length > 0) ? " [" + entry["@id"].split("/").slice(-1)[0] + "]" : "";
                    proj.push({
                        "field": {
                            "ElementName": entry.prefLabel + id_str,
                            "DataType": "class",
                            "Instrument Part": ontology,
                            "ElementDescription": entry["@id"] + "</br>" + entry.synonym.join(", "),
                            "FormName": uri,
                            "uri": uri,
                            "@id": entry["@id"],
                            "fields": uri
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
                if (proj.length > 0) {
                    // request another page
                    setTimeout(function () { // try to get the next one in the list
                        downloadBioOntologyDecendants(req, ontology, descendants_links);
                    }, 100);
                }
            });
        });
    });
}



// this has many pages (potentially)
function downloadBioOntologyClasses(req, ontology, page, max_pages) {
    require("dotenv").config();
    // key for BioOntology is now process.env.BIOONTOLOGY_API_KEY

    if (page > max_pages)
        return; // do nothing

    // get the projects from BioOntology  http://data.bioontology.org/projects
    var uri = "bioontologies://" + ontology;
    var url = "https://data.bioontology.org/ontologies/" + ontology + "/classes?apikey=" + process.env.BIOONTOLOGY_API_KEY + "&page=" + page;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("bioontology_classes", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                contentJSON = JSON.parse(content);
                //console.log("got some data :  " + content);
                var proj = [];
                for (var i = 0; i < contentJSON.collection.length; i++) {
                    var entry = contentJSON.collection[i];
                    if (entry.obsolete)
                        continue;
                    proj.push({
                        "field": {
                            "ElementName": entry.prefLabel,
                            "DataType": "class",
                            "Instrument Part": ontology,
                            "ElementDescription": entry["@id"] + "</br>" + entry.synonym.join(", "),
                            "FormName": uri,
                            "uri": uri + "?instrument=" + entry["cui"][0],
                            "@id": entry["@id"],
                            "fields": uri
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
                if (proj.length > 0) {
                    // request another page
                    setTimeout(function () {
                        downloadBioOntologyClasses(req, ontology, ++page, max_pages);
                    }, 10);
                }
            });
        });
    });
}

function downloadBioOntologyOntologies(req) {
    require("dotenv").config();
    // key for BioOntology is now process.env.BIOONTOLOGY_API_KEY

    // get the projects from BioOntology  http://data.bioontology.org/projects
    var uri = "bioontologies://ontology";
    var url = "https://data.bioontology.org/ontologies_full?apikey=" + process.env.BIOONTOLOGY_API_KEY;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("bioontology_ontologies", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                contentJSON = JSON.parse(content);
                //console.log("got some data :  " + content);
                var proj = [];
                for (var i = 0; i < contentJSON.length; i++) {
                    var entry = contentJSON[i].ontology;
                    proj.push({
                        "project": {
                            "name": entry.acronym,
                            "description": entry.name + ".</br></br>" + entry["@id"],
                            "version": entry["@type"],
                            "instruments": uri,
                            "@id": entry["@id"],
                            "links": {
                                "antecedents": [],
                                "descendants": []
                            },
                            "uri": uri + "?instrument=" + entry.acronym
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
                // for each ontology we can download the root list by
                var projList = proj.map(function (a) { return a.project.name; });
                // reorder to get some standard ontologies downloaded first
                var putUpFront = ["SNOMEDCT", "RXNORM", "MDDB", "DCM", "SEDI", "LOINC"];
                for (var i = 0; i < putUpFront.length; i++) {
                    var idx = projList.indexOf(putUpFront[i]);
                    if (idx != null) {
                        projList.splice(idx, 1); // delete that element
                        projList.unshift(putUpFront[i]);
                    }
                }
                // lets download a number of pages for each of the projects
                projList = projList.map(function (a) { return { name: a, page: 1, max_page: 10 }; });
                setTimeout(function () {
                    downloadBioOntologyRoots(req, projList);
                }, 10);
            });
        });
    });
}


function downloadBioOntologyProjects(req) {
    require("dotenv").config();
    // key for BioOntology is now process.env.BIOONTOLOGY_API_KEY

    // get the projects from BioOntology  http://data.bioontology.org/projects
    var uri = "bioontologies://projects";
    var url = "https://data.bioontology.org/projects?apikey=" + process.env.BIOONTOLOGY_API_KEY;

    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("bioontology_projects", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                contentJSON = JSON.parse(content);
                //console.log("got some data :  " + content);
                var proj = [];
                for (var i = 0; i < contentJSON.length; i++) {
                    var entry = contentJSON[i];
                    proj.push({
                        "project": {
                            "name": entry.name,
                            "description": entry.description,
                            "version": entry["@type"],
                            "instruments": uri,
                            "@id": entry["@id"],
                            "uri": uri
                        }
                    });
                }
                parentPort.postMessage([req, proj]);
            });
        });
    });
}


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
                try {
                    contentJSON = JSON.parse(content);
                } catch (e) {
                    return;
                }
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
                    var p = entry.parentRegisterName.toLowerCase().replace(/ /g, "_").replace(/[\(\)]/g, "");
                    var uri = "helsedata://" + p + "?instrument=";
                    projs[p] = {
                        "project": {
                            "name": p,
                            "description": "",
                            "version": "",
                            "instruments": uri,
                            "@id": "project:" + entry["internalLink"],
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
                                "@id": "instrument:" + entry["internalLink"],
                                "fields": uri + encodeURI(entry.theme)
                            }
                        };
                    }

                    results.push({
                        "field": {
                            "ElementName": entry.code,
                            "DataType": entry.dataType,
                            "Instrument Part": (typeof entry.dataCollection != 'undefined' ? entry.dataCollection : entry.code),
                            "ElementDescription": description,
                            "FormName": uri + (typeof entry.dataCollection != 'undefined' ? entry.dataCollection : ""),
                            "uri": uri + (typeof entry.parentRegisterName != 'undefined' ? entry.parentRegisterName : entry.code),
                            "@id": "field:" + entry["internalLink"],
                            "fields": uri + (typeof entry.parentRegisterName != 'undefined' ? entry.parentRegisterName : entry.code)
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
        var id_piece = options.hostname + options.path;

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
                                "@id": id_piece + "/" + entry.id,
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
                                "@id": "project:" + id_piece + "/" + entry.id,
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
        var id_piece = options.hostname + options.path;

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
                                "uri": "hunt://hunt?instrument=" + entry.instrument.name + "&release=hunt-db.medisin.ntnu.no",
                                "@id": id_piece + "/" + entry.id
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
                        records.push(record); // real entries are created in db.js
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

function downloadCDEs(req, url) {
    const fs = require("fs");
    const https = require("https");
    const temp = require("temp");

    temp.open("cdes_download", function (err, info) {
        var fname = info.path;

        const file = fs.createWriteStream(fname);
        console.log("In downloadCDEs... ");
        https.get(url, response => {
            var stream = response.pipe(file);

            file.on("finish", () => {
                file.close();
            });

            stream.on("finish", function () {
                const content = fs.readFileSync(fname);
                // content.toString());
                contentParsed = JSON.parse(content.toString());
                results = [];
                for (var i = 0; i < contentParsed.length; i++) {
                    // lets download this resource's URL (use the parser from the uri)
                    var entry = contentParsed[i];
                    var title = "";
                    var title2 = "";
                    if (typeof entry.designations != "undefined" && entry.designations.length > 0) {
                        title = entry.designations[0].designation;
                        for (var j = 1; j < entry.designations.length; j++) {
                            title2 += entry.designations[j].designation;
                            if (j < entry.designations.length - 1)
                                title2 += " / ";
                        }
                    }
                    var description = "";
                    if (typeof entry.definitions != "undefined") {
                        for (var j = 0; j < entry.definitions.length; j++) {
                            description += entry.definitions[j].definition;
                            if (j < entry.definitions.length - 1)
                                description += " / ";
                        }
                    }
                    var instrument = entry.steward;
                    results.push({
                        "field": {
                            "ElementName": title,
                            "DataType": entry.elementType,
                            "Instrument Part": instrument,
                            "ElementDescription": description + "</br></br>" + title2,
                            "FormName": "cde://cde?instrument=" + instrument,
                            "fields": "cde://cde?instrument=" + instrument + "&release=cde",
                            "uri": "cde://cde?instrument=" + instrument + "&release=cde",
                            "@id": "cde:" + entry.tinyId
                        }
                    });
                }
                if (results.length > 0)
                    parentPort.postMessage([req, results]);
            });
        });
    }); // should cleanup the downloaded file
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
                    // we could analyze the uri here to extract the info we need
                    s = parseURI(uri);
                    // add to each entry the FormName
                    for (var i = 0; i < ergs.length; i++) {
                        ergs[i].field.FormName = uri;
                        ergs[i].field.uri = uri;
                        // generate a unique ID for this variable
                        ergs[i].field["@id"] = "field:" + ergs[i].field["ElementName"] + ":" + uri
                    }

                    parentPort.postMessage([req, ergs]);
                    // we should add a message for the instrument here as well
                    parentPort.postMessage([req, [{
                        "instrument": {
                            "Instrument Title": s.instrument,
                            "Instrument Version": s.instrument_version,
                            "Instrument Part": s.instrument_part,
                            "fields": uri,
                            "uri": uri,
                            "@id": "instrument:" + url
                        }
                    }]]);
                    parentPort.postMessage([req, [{
                        "project": {
                            "name": s.project,
                            "version": s.project_version,
                            "instruments": uri,
                            "uri": uri,
                            "@id": "project:" + uri
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