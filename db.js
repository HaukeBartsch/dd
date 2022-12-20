const { Worker, isMainThread, parentPort } = require('worker_threads');

// the database thread, all search requests would come here
// all data dictionary information should be collected here

// internal structure is list of instruments with
var project = {
    "name": "",
    "description": "",
    "version": "",
    "date": "",
    "instruments": [], // list of instrument ids
};

var instrument = {
    "id": "",
    "Instrument Title": "",
    "Date Added": "",
    "Download Count": "",
    "Description": "",
    "Acknowledgement": "",
    "Terms of Use": "",
    "Type": "",
    "Language": "",
    "fields": []
};

var field = {
    "id": "", // use a uuid?
    "field_name": "",
    "form_name": "",
    "section_header": "",
    "field_type": "",
    "field_label": "",
    "select_choices_or_calculations": "",
    "field_note": "",
    "text_validation_type_or_show_slider_number": "",
    "text_validation_min": "",
    "text_validation_max": "",
    "identifier": "",
    "branching_logic": "",
    "required_field": "",
    "custom_alignment": "",
    "question_number": "",
    "matrix_group_name": "",
    "matrix_ranking": "",
    "field_annotation": ""
};

var projects = [];
var instruments = [];
var fields = [];

// we just increment this id if we need one
var lastIDprojects = -1;
var lastIDinstruments = -1;
var lastIDfields = -1;

/**
 * This function checks for duplicates in fields, instruments and projects. What is considered a duplicate depends on the 
 * type of field. This function specifically does not test using the 'id' field. It is safe to create a new id first before
 * calling this test.
 * @param {object} entry to test
 * @param {string} what either "field", "instrument", or "project"
 * @returns {bool} true if the entry does not yet exist in fields, instruments, projects
 */
function checkForDuplicates(entry, what) {
    if (what == "field") {
        // check if the field name with the instrument and project and version is unique
    } else if (what == "instrument") {
        for (var i = 0; i < instruments.length; i++) {
            if (entry["Instrument Title"] == instruments[i]["Instrument Title"]) {
                return false;
            }
        }
    } else if (what == "project") {
        for (var i = 0; i < projects.length; i++) {
            if (entry.name == projects[i].name)
                return false;
        }
    }

    return true;
}

/**
 * This function returns a new ID for fields, instruments and projects. 
 * The function uses a global object to cache the largest ID.
 * @param {string} what either "fields", "instruments", or "projects"
 * @returns {number} next free id (one larger than previous ids)
 */
function getNewID(what) {
    if (what == "fields") {
        if (lastIDfields == -1) {
            var id = -1; // optimize this if we have more than one field in the list
            for (var i = 0; i < fields.length; i++) {
                if (fields[i].id > id)
                    id = fields[i].id;
            }
            lastIDfields = id;
        }
        return ++lastIDfields;
    } else if (what == "projects") {
        if (lastIDprojects == -1) {
            var id = -1; // optimize this if we have more than one field in the list
            for (var i = 0; i < projects.length; i++) {
                if (projects[i].id > id)
                    id = projects[i].id;
            }
            lastIDprojects = id;
        }
        return ++lastIDprojects;
    } else if (what == "instruments") {
        if (lastIDinstruments == -1) {
            var id = -1; // optimize this if we have more than one field in the list
            for (var i = 0; i < instruments.length; i++) {
                if (instruments[i].id > id)
                    id = instruments[i].id;
            }
            lastIDinstruments = id;
        }
        return ++lastIDinstruments;
    } else {
        console.log("Error: unknown ID type requested (fields, projects, instruments): " + what);
    }
    return -1;
}

var haveSomethingDone = false;

function addToDatabase(options) {
    //console.log("got an announce to add to database! with key: " + JSON.stringify(options[0]));

    if (!haveSomethingDone && (fields.length > 0 && instruments.length > 0 && projects.length > 0)) {
        haveSomethingDone = true;
        parentPort.postMessage(["haveSomething", {}]);
    }

    if (options[0] == "loadDefaults" && options[1].length > 0 && (typeof options[1][0].field != "undefined" || typeof options[1][0].instrument != "undefined" || typeof options[1][0].project != "undefined")) {
        // read this as a field or instrument or project
        // go through each entry
        for (var j = 0; j < options[1].length; j++) {
            if (typeof options[1][j].field != "undefined") {
                // assign to new field id
                // what is the last id we can use? (should do this only once)
                var id = getNewID("fields");
                // the field values are in:
                var entry = options[1][j].field; // add this to the field in the database.. what about the keys?
                //console.log(entry);
                var newField = { ...field }; // copy of the type
                newField.id = id;
                newField.field_name = entry.ElementName;
                newField.field_type = entry.DataType;
                newField.field_label = entry.ElementDescription;
                newField.form_name = entry.FormName;
                if (checkForDuplicates(newField, "field")) {
                    newField.longDesc = JSON.stringify(newField);
                    fields.push(newField);
                }
            } else if (typeof options[1][j].instrument != "undefined") {
                // append an entry to the instrument list
                var id = getNewID("instruments");
                var entry = options[1][j].instrument; // add this to the field in the database.. what about the keys?
                var newInstrument = { ...instrument };
                newInstrument.id = id;
                newInstrument['Instrument Title'] = entry["Instrument Title"];
                newInstrument['Description'] = typeof entry["Description"] != "undefined" ? entry["Description"] : "";
                newInstrument['fields'] = entry["fields"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newInstrument, "instrument")) {
                    newInstrument.longDesc = JSON.stringify(newInstrument);
                    instruments.push(newInstrument);
                }
            } else if (typeof options[1][j].project != "undefined") {
                // append an entry to the project list
                // append an entry to the instrument list
                var id = getNewID("projects");
                var entry = options[1][j].project; // add this to the field in the database.. what about the keys?
                var newProject = { ...project };
                newProject.id = id;
                newProject.name = entry["name"];
                newProject['instruments'] = entry["instruments"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newProject, "project")) {
                    newProject.longDesc = JSON.stringify(newProject);
                    projects.push(newProject);
                }
            }
        }
        return;
    }

    // this should be removed at some point, we need the mechanism above to add fields, instruments and projects

    // this is an instrument list so we need to fill out the fields variable
    var uri_prefix = "redcap://REDLoc?release=2022&";

    // what is the last id we can use?
    var id = -1;
    for (var i = 0; i < instruments.length; i++) {
        if (instruments[i].id > id)
            id = instruments[i].id;
    }
    id++;  // make the new ID one larger
    // find the entries in the table that correspond to our keys
    var mapToColumn = instrument;
    var keys = options[1][0];
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] in mapToColumn) {
            mapToColumn[keys[i]] = i;
        }
    }

    for (var i = 1; i < options[1].length; i++) { // ignore the first row, its the header
        // should we sanitize the fields?
        var entry = { ...options[1][i] };
        var inst = { ...instrument };
        var instKeys = Object.keys(mapToColumn);
        for (var j = 0; j < instKeys.length; j++) {
            if (typeof mapToColumn[instKeys[j]] != 'undefined') {
                inst[instKeys[j]] = entry[mapToColumn[instKeys[j]]];
            }
        }
        inst.id = id++;
        if (typeof inst["Instrument Title"] != "undefined") {
            var t = inst["Instrument Title"].replace(/ /g, "_").toLowerCase();
            inst.fields = uri_prefix + t;
        }
        if (checkForDuplicates(inst, "instrument")) {
            inst.longDesc = JSON.stringify(inst);
            instruments.push(inst);
        }
    }
}

function search(options) {
    // full text search support
    //console.log("Search found: " + JSON.stringify(options));
    // we should mark our search results by type and by search

    // unqualified search
    if (typeof options == "string") {
        // we assume that string is a regular expression
        var regexp = new RegExp(options, 'i');
        var resultsF = [];
        for (var i = 0; i < fields.length; i++) {
            if (resultsF.length > 100)
                break;
            var m = fields[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                // push a copy
                var ne = Object.assign({}, fields[i]);
                resultsF.push([options, { field: ne }]);
            }
        }
        var resultsI = [];
        for (var i = 0; i < instruments.length; i++) {
            if (resultsI.length > 100)
                break;
            var m = instruments[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                // push a copy
                var ne = Object.assign({}, instruments[i]);
                resultsI.push([options, { instrument: ne }]);
            }
        }
        var resultsP = [];
        for (var i = 0; i < projects.length; i++) {
            if (resultsP.length > 100)
                break;
            var m = projects[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                // push a copy
                var ne = Object.assign({}, projects[i]);
                resultsP.push([options, { project: ne }]);
            }
        }
        return [...resultsF, ...resultsI, ...resultsP]
    }

    // here we need to respond with some JSON as a result
    var result = [instruments[0]];
    postMessage([options, result]); // send the result back to main
}

parentPort.on('message', function (a) {
    var func = a[0];
    var options = a[1];

    //console.log("Worker db got a message: " + JSON.stringify(func));

    if (func == "announce") {
        if (options[0] == "loadDefaults" && options[1].length > 0) {
            addToDatabase(options); // the first field in here will be "loadDatabase" the second the list of found rows
            parentPort.postMessage(["update", {}]);
        }
    } else if (func == "search") {
        results = search(options);
        parentPort.postMessage(["search", results]);
    } else if (func == "searchRandom") {
        results = searchRandom();
        parentPort.postMessage(["search", results]);
    } else if (func == "stats") {
        // send back some basic stats 
        parentPort.postMessage(["stats", { "instruments": instruments.length, "projects": projects.length, "fields": fields.length }]);
    } else {
        parentPort.postMessage(["Error", "option is neither announce nor search"]);
    }

    //console.log('Message received from main script');
    //const workerResult = `Result: ${e.data[0] * e.data[1]}`;
    //console.log('Posting message back to main script');
    //postMessage(workerResult);
});

function searchRandom() {
    var results = [];

    var resultsF = [];
    // randomize order
    var order = [...Array(fields.length).keys()];
    var shuffled = order.sort((a, b) => 0.5 - Math.random());
    for (var i = 0; i < shuffled.length; i++) {
        if (resultsF.length > 100)
            break;
        // push a copy
        var ne = Object.assign({}, fields[shuffled[i]]);
        resultsF.push(["search", { field: ne }]);
    }

    var resultsI = [];
    // randomize order
    var order = [...Array(instruments.length).keys()];
    var shuffled = order.sort((a, b) => 0.5 - Math.random());
    for (var i = 0; i < shuffled.length; i++) {
        if (resultsI.length > 100)
            break;
        // push a copy
        var ne = Object.assign({}, instruments[shuffled[i]]);
        resultsI.push(["search", { instrument: ne }]);
    }

    var resultsP = [];
    // randomize order
    var order = [...Array(projects.length).keys()];
    var shuffled = order.sort((a, b) => 0.5 - Math.random());
    for (var i = 0; i < shuffled.length; i++) {
        if (resultsP.length > 100)
            break;
        // push a copy
        var ne = Object.assign({}, projects[shuffled[i]]);
        resultsP.push(["search", { project: ne }]);
    }

    return [...resultsF, ...resultsI, ...resultsP];
}