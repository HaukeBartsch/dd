
document.getElementById('close-save-dialog').addEventListener('click', (e) => {
    // window.darkMode.system();
    // window.saveDialog.close();
    console.log("close this dialog now");
    close();
});

document.getElementById('save-dialog-save').addEventListener('click', (e) => {
    var name = document.getElementById('saveName').value;
    var description = document.getElementById('saveDescription').value;
    var pattern = document.getElementById('pattern').value;
    console.log("save the name: " + name + " description: " + description);
    window.save.search([name, description, pattern]);
    close();
});

