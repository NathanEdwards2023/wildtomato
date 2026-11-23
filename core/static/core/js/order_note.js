// Save the order note without closing the window. The button is off until the note is edited.
const note = document.querySelector("#order-note");
const saveNote = document.querySelector("#save-note");
const noteFeedback = document.querySelector("#order-feedback");
let noteSaved = false;

// The order window clears the note box when it opens, so put the saved note back.
document.querySelectorAll(".select-table").forEach(button => {
    button.addEventListener("click", () => note.value = note.defaultValue);
});
note.addEventListener("input", () => saveNote.disabled = false);
saveNote.addEventListener("click", async () => {
    saveNote.disabled = true;
    const form = document.querySelector("#order-note-form");
    const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
    saveNote.disabled = response.ok;
    if (response.ok) {
        note.defaultValue = note.value;
        noteSaved = true;
    }
    noteFeedback.textContent = response.ok ? "Note saved." : "Could not save the note.";
});
// Reload when the window closes so the order page shows the new note.
document.querySelector("#order-builder").addEventListener("close", () => { if (noteSaved) location.reload(); });
