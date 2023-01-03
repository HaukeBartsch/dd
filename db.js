const { Worker, isMainThread, parentPort } = require('worker_threads');

// the database thread, all search requests would come here
// all data dictionary information should be collected here

function createSearchStruct() {
    return {
        name: "",
        description: "",
        author: "",
        pattern: ""
    };
}

// internal structure is list of instruments with
function createProjectStruct() {
    return {
        "name": "",
        "description": "",
        "version": "",
        "date": "",
        "instruments": [], // list of instrument ids
    };
}

function createInstrumentStruct() {
    return {
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
}

function createMessageStruct() {
    return {
        "id": "",
        "name": "",
        "description": "",
        "uid": "",
        "link": ""
    };
}


function createFieldStruct() {
    return {
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
}

var projects = [];
var instruments = [];
var fields = [];
var searches = [];
var messages = [];

// we just increment this id if we need one
var lastIDprojects = -1;
var lastIDinstruments = -1;
var lastIDfields = -1;
var lastIDsearches = -1;
var lastIDmessages = -1;

// we need to cache for fields the field_name and the form_name
var cacheInitialized = false;
var cacheFieldFormName = {};

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
        // this is performance critical, so we will try to get the keys without enumerating them or without Object.keys()
        if (!cacheInitialized) {
            // check if the field name with the instrument and project and version is unique
            for (var i = 0; i < fields.length; i++) {
                cacheFieldFormName[fields[i].field_name + fields[i].form_name] = 1;
            }
            cacheInitialized = true;;
        }
        if (typeof cacheFieldFormName[entry.field_name + entry.form_name] != 'undefined') { // its already in there
            return false;
        } else { // if not put it in - we assume here that its actually getting added to db - might not be the case!
            cacheFieldFormName[entry.field_name + entry.form_name] = 1;
        }
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
    } else if (what == "search") {
        for (var i = 0; i < searches.length; i++) {
            if (entry.name == searches[i].name)
                return false;
        }
    } else if (what == "message") {
        for (var i = 0; i < messages.length; i++) {
            if (entry.uid == messages[i].uid)
                return false;
        }
    }

    return true;
}

/**
 * This function returns a new ID for fields, instruments and projects. 
 * The function uses a global object to cache the largest ID. ID's are 
 * immutable but only valid for one run of the program (depend on load order).
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
    } else if (what == "searches") {
        if (lastIDsearches == -1) {
            var id = -1; // optimize this if we have more than one field in the list
            for (var i = 0; i < searches.length; i++) {
                if (searches[i].id > id)
                    id = searches[i].id;
            }
            lastIDsearches = id;
        }
        return ++lastIDsearches;
    } else if (what == "messages") {
        if (lastIDmessages == -1) {
            var id = -1; // optimize this if we have more than one field in the list
            for (var i = 0; i < messages.length; i++) {
                if (messages[i].id > id)
                    id = messages[i].id;
            }
            lastIDmessages = id;
        }
        return ++lastIDmessages;
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

    if (options[0] == "loadDefaults" && options[1].length > 0 && (typeof options[1][0].field != "undefined" || typeof options[1][0].instrument != "undefined" || typeof options[1][0].project != "undefined" || typeof options[1][0].search != "undefined")) {
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
                var newField = createFieldStruct(); // copy of the type
                newField.id = id;
                newField.uri = entry.uri;
                newField.field_name = entry.ElementName;
                newField.field_type = entry.DataType;
                newField.field_label = entry.ElementDescription;
                newField.form_name = entry.FormName;
                newField.uid = entry["@id"];
                if (checkForDuplicates(newField, "field")) {
                    newField.longDesc = Object.values(newField).toString().replace(/,/g, " ");
                    fields.push(newField);
                }
            } else if (typeof options[1][j].instrument != "undefined") {
                // append an entry to the instrument list
                var id = getNewID("instruments");
                var entry = options[1][j].instrument; // add this to the field in the database.. what about the keys?
                if (typeof entry.uri == "undefined" || entry.uri == "undefined") {
                    console.log("Error: found entry to add without a uri");
                }

                var newInstrument = createInstrumentStruct();
                newInstrument.id = id;
                newInstrument.uri = entry.uri;
                newInstrument.uid = entry["@id"];
                newInstrument['Instrument Title'] = entry["Instrument Title"];
                newInstrument['Description'] = typeof entry["Description"] != "undefined" ? entry["Description"] : "";
                newInstrument['fields'] = entry["fields"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newInstrument, "instrument")) {
                    newInstrument.longDesc = Object.values(newInstrument).toString().replace(/,/g, " ")
                    instruments.push(newInstrument);
                }
            } else if (typeof options[1][j].project != "undefined") {
                // append an entry to the project list
                // append an entry to the instrument list
                var id = getNewID("projects");
                var entry = options[1][j].project; // add this to the field in the database.. what about the keys?
                var newProject = createProjectStruct();
                newProject.id = id;
                newProject.description = (typeof entry.description != 'undefined' ? entry.description : ""),
                    newProject.uri = entry.uri;
                newProject.name = entry["name"];
                newProject.uid = entry["@id"];
                newProject['instruments'] = entry["instruments"]; // id of the field with this FormName, actually its the uri
                if (checkForDuplicates(newProject, "project")) {
                    newProject.longDesc = Object.values(newProject).toString().replace(/,/g, " ")
                    projects.push(newProject);
                }
            } else if (typeof options[1][j].search != "undefined") {
                var id = getNewID("searches");
                var entry = options[1][j].search; // add this to the field in the database.. what about the keys?
                var newSearch = createSearchStruct();
                newSearch.id = id;
                newSearch.uri = entry.uri;
                newSearch.uid = entry["@id"];
                newSearch.name = entry["name"];
                newSearch.description = entry["description"]; // id of the field with this FormName, actually its the uri
                newSearch.pattern = entry["pattern"];
                if (checkForDuplicates(newSearch, "search")) {
                    // should we find the long description for a search?? maybe only the title is sufficient?
                    newSearch.longDesc = Object.values(newSearch).toString().replace(/,/g, " ")
                    searches.push(newSearch);
                }
            } else if (typeof options[1][j].message != "undefined") {
                var id = getNewID("messages");
                var entry = options[1][j].message; // add this to the field in the database.. what about the keys?
                var newMessage = createMessageStruct();
                newMessage.id = id;
                newMessage.uri = entry.uri;
                newMessage.uid = entry["@id"];
                newMessage.name = entry["name"];
                newMessage.description = entry["description"]; // id of the field with this FormName, actually its the uri
                newMessage.pattern = entry["pattern"];
                if (checkForDuplicates(newMessage, "message")) {
                    // should we find the long description for a search?? maybe only the title is sufficient?
                    newMessage.longDesc = Object.values(newMessage).toString().replace(/,/g, " ")
                    messages.push(newMessage);
                }
            } else {
                console.log("Error: unknown type of object discovered, should be field, or search, instrument, project.");
            }
        }
        return;
    }

    // this should be removed at some point, we need the mechanism above to add fields, instruments and projects

    // this is an instrument list so we need to fill out the fields variable
    var uri_prefix = "redcap://REDLoc?release=2022&";
    var id_prefix = "https://redcap.vanderbilt.edu/consortium/library/instrument_download.php";

    // what is the last id we can use?
    var id = -1;
    for (var i = 0; i < instruments.length; i++) {
        if (instruments[i].id > id)
            id = instruments[i].id;
    }
    id++;  // make the new ID one larger
    // find the entries in the table that correspond to our keys
    var mapToColumn = createInstrumentStruct();
    var keys = options[1][0];
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] in mapToColumn) {
            mapToColumn[keys[i]] = i;
        }
    }

    for (var i = 1; i < options[1].length; i++) { // ignore the first row, its the header
        // should we sanitize the fields?
        var entry = { ...options[1][i] };
        var inst = createInstrumentStruct();
        var instKeys = Object.keys(mapToColumn);
        for (var j = 0; j < instKeys.length; j++) {
            if (typeof mapToColumn[instKeys[j]] != 'undefined') {
                inst[instKeys[j]] = entry[mapToColumn[instKeys[j]]];
            }
        }
        inst.id = id++;
        if (typeof inst["Instrument Title"] != "undefined") {
            var t = inst["Instrument Title"].replace(/ /g, "_").replace(/[\(\)]+/g, "_").toLowerCase();
            inst.fields = uri_prefix + "instrument=" + t;
            inst.uri = uri_prefix + "instrument=" + t;
            inst["@id"] = id_prefix + "/" + t
        }
        if (checkForDuplicates(inst, "instrument")) {
            inst.longDesc = JSON.stringify(inst);
            instruments.push(inst);
        }
    }
}

/**
 * Full text searches through everything.
 * @param {array} array of previous search results, should be empty the first time
 * @param {options} options 
 * @param {ids} object (can be empty) used as cache the ids of already added structured to speed up duplicate detection
 * @returns list of result structures
 */
function search(erg, options, ids) {
    // full text search support
    if (typeof ids.fields == 'undefined')
        ids.fields = {};
    if (typeof ids.instruments == 'undefined')
        ids.instruments = {};
    if (typeof ids.projects == 'undefined')
        ids.projects = {};
    if (typeof ids.searches == 'undefined')
        ids.searches = {};
    if (typeof ids.messages == 'undefined')
        ids.messages = {};

    // unqualified search
    if (typeof options == "string") {
        // we assume that string is a regular expression
        var regexp = null;
        try {
            regexp = new RegExp(options, 'i');
        } catch (e) {
            // we should do something here
            return [];
        }
        var resultsFCounter = 0;
        for (var i = 0; i < fields.length; i++) {
            if (resultsFCounter > 200)
                break;
            var m = fields[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                if (typeof ids.fields[fields[i].id] == 'undefined') {
                    // push a copy
                    var ne = Object.assign({}, fields[i]);
                    erg.push([options, { field: ne }]);
                    ids.fields[fields[i].id] = true; // remember that we added that id to results already
                    resultsFCounter++;
                }
            }
        }
        var resultsICounter = 0;
        for (var i = 0; i < instruments.length; i++) {
            if (resultsICounter > 200)
                break;
            var m = instruments[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                if (typeof ids.instruments[instruments[i].id] == 'undefined') {
                    // push a copy
                    var ne = Object.assign({}, instruments[i]);
                    //resultsI.push([options, { instrument: ne }]);
                    erg.push([options, { instrument: ne }]);
                    ids.instruments[instruments[i].id] = true;
                    resultsICounter++;
                }
            }
        }

        var resultsPCounter = 0;
        for (var i = 0; i < projects.length; i++) {
            if (resultsPCounter > 200)
                break;
            var m = projects[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                if (typeof ids.projects[projects[i].id] == 'undefined') {
                    // push a copy
                    var ne = Object.assign({}, projects[i]);
                    //resultsP.push([options, { project: ne }]);
                    erg.push([options, { project: ne }]);
                    ids.projects[projects[i].id] = true;
                    resultsPCounter++;
                }
            }
        }
        // any search that results in a search will include that searches results as well (track duplicates to not do this forever)
        var resultsSCounter = 0;
        for (var i = 0; i < searches.length; i++) {
            if (resultsSCounter > 200)
                break;
            var m = searches[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                if (typeof ids.searches[searches[i].id] == 'undefined') {
                    // push a copy
                    var ne = Object.assign({}, searches[i]);
                    //resultsS.push([options, { search: ne }]);
                    erg.push([options, { search: ne }]);
                    ids.searches[searches[i].id] = true;
                    resultsSCounter++;
                }
            }
        }

        // any search that results in a search will include that searches results as well (track duplicates to not do this forever)
        var resultsMCounter = 0;
        var messagePointers = [];
        for (var i = 0; i < messages.length; i++) {
            if (resultsMCounter > 200)
                break;
            var m = messages[i].longDesc.match(regexp);
            if (m != null && m.length > 0) {
                if (typeof ids.messages[messages[i].id] == 'undefined') {
                    // push a copy
                    var ne = Object.assign({}, messages[i]);
                    //resultsS.push([options, { search: ne }]);
                    erg.push([options, { message: ne }]);
                    ids.messages[messages[i].id] = true;
                    messagePointers.push(ne.uid);
                    resultsMCounter++;
                }
            }
        }
        // if we have any messages we should get the objects they point to as well
        for (var i = 0; i < messagePointers.length; i++) {
            // we should add the objects the messages point to
            var uid = messagePointers[i];
            for (var i = 0; i < projects.length; i++) {
                if (projects[i].uid == uid) {
                    var ne = Object.assign({}, projects[i]);
                    //resultsS.push([options, { search: ne }]);
                    erg.push([options, { project: ne }]); // we might get a copy here!!
                }
            }
            for (var i = 0; i < instruments.length; i++) {
                if (instruments[i].uid == uid) {
                    var ne = Object.assign({}, instruments[i]);
                    //resultsS.push([options, { search: ne }]);
                    erg.push([options, { instrument: ne }]); // we might get a copy here!!
                }
            }

        }

        // if we still have space we can try to resolve searches
        if (erg.length < 4 * 200) {
            // add some more resolved searches
            // we need to mark searches as resolved do we don't always do the same one (the first)
            for (var i = 0; i < erg.length; i++) {
                if (typeof erg[i][1].search == 'undefined')
                    continue; // skip this, not a search
                // recurse
                var pattern = erg[i][1].search.pattern;
                if (typeof erg[i][1].search.resolved == 'undefined') {
                    erg[i][1].search.resolved = true; // mark this as already resolved for the next iteration
                    search(erg, pattern, ids);
                }
            }
        }

        return;
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
        var results = [];
        search(results, options, {});
        parentPort.postMessage(["search", results]);
    } else if (func == "searchRandom") {
        results = searchRandom();
        parentPort.postMessage(["search", results]);
    } else if (func == "getMessage") { // if we receive the request to lookup some message, lets do that
        results = getMessages(func, options);
        parentPort.postMessage(["searchMessage", results]);
    } else if (func == "stats") {
        // send back some basic stats 
        parentPort.postMessage(["stats", { "instruments": instruments.length, "projects": projects.length, "fields": fields.length, "searches": searches.length }]);
    } else if (func == "saveSearch") {
        // create a search entry and add it to the database in memory
        var s = createSearchStruct();
        s.name = options.name;
        s.description = options.description;
        s.pattern = options.pattern;
        var username = require("os").userInfo().username;
        s.uri = "search://" + username + "?instrument=JustASearch"; // create an uri for this novel search
        s["@id"] = options["@id"];

        addToDatabase(["loadDefaults", [{ "search": s }]]);
        // we should cache searches across the lifetime of the project so we should write them to disk every time we get a new one
        writeAllSearches();
    } else if (func == "loadSearchesFromDisk") {
        importAllSearchesFromDisk();
    } else {
        parentPort.postMessage(["Error", "option is neither announce nor search"]);
    }
});

function getMessage(req, options) {
    // we should look for a message attached to this guid
    var results = [];
    console.log("find message for this guid and return");
    for (var i = 0; i < messages.length; i++) {
        if (messages[i].message.uid == options) {
            var ne = Object.assign({}, messages[i]);
            results.push([req, ne]);
        }
    }
    return results;
}

/**
 * Export all searches to disk so we can load them again when we start the program.
 */
function writeAllSearches() {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, 'searches_cache.json');
    fs.writeFileSync(p, JSON.stringify(searches));
}

/**
 * Import all searches back from disk. This will overwrite existing searches in memory.
 */
function importAllSearchesFromDisk() {
    // merges with all searches already in searches?
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, 'searches_cache.json');
    if (fs.existsSync(p)) {
        let rawdata = fs.readFileSync(p);
        try {
            searches = JSON.parse(rawdata);
        } catch (e) {
            // got an error reading the searches_cache file as json
        }
    }
}

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

    var resultsS = [];
    // randomize order
    var order = [...Array(searches.length).keys()];
    var shuffled = order.sort((a, b) => 0.5 - Math.random());
    for (var i = 0; i < shuffled.length; i++) {
        if (resultsS.length > 100)
            break;
        // push a copy
        var ne = Object.assign({}, searches[shuffled[i]]);
        resultsP.push(["search", { search: ne }]);
    }

    return [...resultsF, ...resultsI, ...resultsP, ...resultsS];
}