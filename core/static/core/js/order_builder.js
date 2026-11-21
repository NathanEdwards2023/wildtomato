// Frontend-only sample menu. No requests or database writes are made here.
const previewMenu = [
    { id: 1, name: "Margherita pizza", category: "Pizza", cents: 1400 },
    { id: 2, name: "Pepperoni pizza", category: "Pizza", cents: 1600 },
    { id: 3, name: "Garden pizza", category: "Pizza", cents: 1550 },
    { id: 4, name: "House salad", category: "Sides", cents: 700 },
    { id: 5, name: "Garlic bread", category: "Sides", cents: 600 },
    { id: 6, name: "Lemonade", category: "Drinks", cents: 350 },
];
const dialog = document.querySelector("#order-builder");
const cart = new Map();
const editing = dialog.dataset.mode === "edit";
// Sample existing order for UI demonstration only. Backend will supply real items.
let savedCart = new Map(editing ? [[1, 1], [6, 2]] : []);
let savedNote = "";

function renderSavedPreview() {
    const container = document.querySelector("#saved-preview-items");
    if (!container) return;
    container.replaceChildren();
    let total = 0;
    for (const [id, quantity] of savedCart) {
        const item = previewMenu.find(entry => entry.id === id);
        total += item.cents * quantity;
        container.append(element("p", `${quantity} x ${item.name} - ${money(item.cents * quantity)}`));
    }
    if (!savedCart.size) container.append(element("p", "No items in this preview."));
    document.querySelector("#saved-preview-total").textContent = money(total);
    document.querySelector("#saved-preview-note").textContent = savedNote ? `Note: ${savedNote}` : "";
}
const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const feedback = document.querySelector("#order-feedback");
let selectedTable = "";

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function renderMenu() {
    const query = document.querySelector("#menu-search").value.trim().toLowerCase();
    const category = document.querySelector("#menu-category").value;
    const container = document.querySelector("#preview-menu");
    container.replaceChildren();
    const matches = previewMenu.filter(item => item.name.toLowerCase().includes(query) && (category === "all" || item.category === category));
    for (const item of matches) {
        const row = element("div", undefined, "menu-item");
        const description = element("div");
        description.append(element("strong", item.name), element("small", `${item.category} · ${money(item.cents)}`));
        const add = element("button", "Add");
        add.type = "button";
        add.setAttribute("aria-label", `Add ${item.name}`);
        add.addEventListener("click", () => {
            cart.set(item.id, Math.min(99, (cart.get(item.id) || 0) + 1));
            renderCart();
            feedback.textContent = `${item.name} added.`;
        });
        row.append(description, add);
        container.append(row);
    }
    if (!matches.length) container.append(element("p", "No menu items match your search."));
}

function renderCart() {
    const container = document.querySelector("#cart-items");
    container.replaceChildren();
    let total = 0;
    for (const [id, quantity] of cart) {
        const item = previewMenu.find(entry => entry.id === id);
        total += item.cents * quantity;
        const row = element("div", undefined, "cart-item");
        const controls = element("div", undefined, "quantity-controls");
        const minus = element("button", "−");
        const plus = element("button", "+");
        minus.type = plus.type = "button";
        minus.setAttribute("aria-label", `Decrease ${item.name} quantity`);
        plus.setAttribute("aria-label", `Increase ${item.name} quantity`);
        plus.disabled = quantity >= 99;
        minus.addEventListener("click", () => {
            if (quantity === 1) cart.delete(id); else cart.set(id, quantity - 1);
            renderCart();
            document.querySelector("#menu-search").focus();
        });
        plus.addEventListener("click", () => {
            cart.set(id, quantity + 1);
            renderCart();
            document.querySelector("#menu-search").focus();
        });
        const remove = element("button", "Remove");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${item.name}`);
        remove.addEventListener("click", () => {
            cart.delete(id);
            renderCart();
            document.querySelector("#menu-search").focus();
        });
        controls.append(minus, element("span", String(quantity)), plus, remove);
        row.append(element("strong", item.name), controls, element("span", money(item.cents * quantity)));
        container.append(row);
    }
    if (!cart.size) container.append(element("p", "No items yet. Add something from the menu."));
    document.querySelector("#cart-total").textContent = money(total);
    document.querySelector("#place-order").disabled = !cart.size;
    feedback.textContent = "";
}

document.querySelectorAll(".select-table").forEach(button => {
    button.addEventListener("click", () => {
        selectedTable = button.dataset.tableName;
        dialog.dataset.tableId = button.dataset.tableId;
        document.querySelector("#builder-title").textContent = `Create order · ${selectedTable}`;
        cart.clear();
        if (editing) savedCart.forEach((quantity, id) => cart.set(id, quantity));
        if (!editing) document.querySelector("#order-note").value = "";
        document.querySelector("#menu-search").value = "";
        document.querySelector("#menu-category").value = "all";
        renderMenu();
        renderCart();
        dialog.showModal();
    });
});
document.querySelector("#close-builder").addEventListener("click", () => dialog.close());
document.querySelector("#menu-search").addEventListener("input", renderMenu);
document.querySelector("#menu-category").addEventListener("change", renderMenu);
document.querySelector("#place-order").addEventListener("click", () => {
    if (!cart.size) return;
    if (editing) {
        savedCart = new Map(cart);
        savedNote = document.querySelector("#order-note").value;
        renderSavedPreview();
        dialog.close();
        document.querySelector("#saved-preview-feedback").textContent = "Preview updated on this page only. No database changes were made.";
        return;
    }
    feedback.textContent = `Preview complete for ${selectedTable}. No order was saved; the table is still available.`;
});

if (editing) renderSavedPreview();

// Save the order note without closing the window. The button is off until the note is edited.
const saveNote = document.querySelector("#save-note");
let noteSaved = false;
if (saveNote) {
    document.querySelector("#order-note").addEventListener("input", () => saveNote.disabled = false);
    saveNote.addEventListener("click", async () => {
        saveNote.disabled = true;
        const form = document.querySelector("#order-note-form");
        const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
        saveNote.disabled = response.ok;
        noteSaved = noteSaved || response.ok;
        feedback.textContent = response.ok ? "Note saved." : "Could not save the note.";
    });
    // Reload when the window closes so the order page shows the new note.
    dialog.addEventListener("close", () => { if (noteSaved) location.reload(); });
}
