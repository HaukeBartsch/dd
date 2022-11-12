const { Worker, isMainThread, parentPort } = require('worker_threads');

// the database thread, all search requests would come here
// all data dictionary information should be collected here

// internal structure is list of instruments with
var projects = [{
    "name": "",
    "description": "",
    "version": "",
    "date": "",
    "instruments": [], // list of instrument ids
}];

var instruments = [{
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
}];



var fields = [{
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
}];

function addToDatabase(options) {
    console.log("got an announce to add to database! with key: " + JSON.stringify(options[0]));

    // what is the last id we can use?
    var id = -1;
    for (var i = 0; i < instruments.length; i++) {
        if (instruments[i].id > id)
            id = instruments[i].id;
    }
    id++;  // make the new ID one larger
    for (var i = 0; i < options.length; i++) {
        // should we sanitize the fields?
        var entry = { ...options[i] };
        entry.id = id++;
        instruments.push(entry);
    }
}

function search(options) {
    // full text search support

    // here we need to respond with some JSON as a result
    var result = [fields[0]];
    postMessage([options, result]); // send the result back to main
}

parentPort.on('message', function (a) {
    var func = a[0];
    var options = a[1];

    if (func == "announce") {
        addToDatabase(options); // the first field in here will be "loadDatabase" the second the list of found rows
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