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
        for (var i = 0; i < projects.length; i++) {
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

function addToDatabase(options) {
    //console.log("got an announce to add to database! with key: " + JSON.stringify(options[0]));

    if (options[0] == "loadDefaults" && options[1].length > 0 && (typeof options[1][0].field != "undefined" || typeof options[1][0].instrument != "undefined" || typeof options[1][0].project != "undefined")) {
        // read this as a field or instrument or project
        // go through each entry
        for (var j = 0; j < options[1].length; j++) {
            if (typeof options[1][j].field != "undefined") {
                // assign to new field id
                // what is the last id we can use?
                var id = -1; // optimize this if we have more than one field in the list
                for (var i = 0; i < fields.length; i++) {
                    if (fields[i].id > id)
                        id = fields[i].id;
                }
                id++;  // make the new ID one larger
                // the field values are in:
                var entry = options[1][j].field; // add this to the field in the database.. what about the keys?
                //console.log(entry);
                var newField = { ...field }; // copy of the type
                newField.id = id;
                newField.field_name = entry.ElementName;
                newField.field_type = entry.DataType;
                newField.field_label = entry.ElementDescription;
                newField.form_name = entry.FormName;
                if (checkForDuplicates(newField, "field"))
                    fields.push(newField);
            } else if (typeof options[1][j].instrument != "undefined") {
                // append an entry to the instrument list
                var id = -1;
                for (var i = 0; i < instruments.length; i++) {
                    if (instruments[i].id > id)
                        id = instruments[i].id;
                }
                id++;  // make the new ID one larger
                var entry = options[1][j].instrument; // add this to the field in the database.. what about the keys?
                var newInstrument = { ...instrument };
                newInstrument.id = id;
                newInstrument['Instrument Title'] = entry["Instrument Title"];
                newInstrument['fields'] = entry["fields"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newInstrument, "instrument"))
                    instruments.push(newInstrument);
            } else if (typeof options[1][j].project != "undefined") {
                // append an entry to the project list
                // append an entry to the instrument list
                var id = -1;
                for (var i = 0; i < projects.length; i++) {
                    if (projects[i].id > id)
                        id = projects[i].id;
                }
                id++;  // make the new ID one larger
                var entry = options[1][j].project; // add this to the field in the database.. what about the keys?
                var newProject = { ...project };
                newProject.id = id;
                newProject.name = entry["name"];
                newProject['instruments'] = entry["instruments"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newProject, "project"))
                    projects.push(newProject);
            }
        }
        return;
    }

    // this should be removed at some point, we need the mechanism above to add fields, instruments and projects

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
        instruments.push(inst);
    }
}

function search(options) {
    // full text search support
    console.log("Search found: " + JSON.stringify(options));

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
        search(options);
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