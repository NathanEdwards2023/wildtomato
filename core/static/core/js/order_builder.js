// The real menu, supplied by the server on both the new-order and the edit-order pages.
const previewMenu = JSON.parse(document.querySelector("#menu-data").textContent);
const dialog = document.querySelector("#order-builder");
// Each cart entry is one line item with its own note: { key, item, note, quantity, saved }.
// "saved" entries are already on the order: they are shown but can't be changed or removed here.
const existingData = document.querySelector("#existing-items");
const existingItems = existingData ? JSON.parse(existingData.textContent) : [];
let cart = [];
let nextKey = 1;
const countOf = (id, savedOnly) => cart
    .filter(entry => entry.item.id === id && (!savedOnly || entry.saved))
    .reduce((sum, entry) => sum + entry.quantity, 0);
const editing = dialog.dataset.mode === "edit";
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
        const unavailable = !item.available;
        description.append(element("strong", item.name), element("small", `${item.category} · ${money(item.cents)}${unavailable ? " · Unavailable" : ""}`));
        // − and + remove or add one line item of this dish. The number shows how many are in the order,
        // and − can't go below what was already ordered.
        const count = countOf(item.id, false);
        const controls = element("div", undefined, "quantity-controls");
        const minus = element("button", "−");
        const plus = element("button", "+");
        minus.type = plus.type = "button";
        minus.id = `menu-minus-${item.id}`;
        plus.id = `menu-plus-${item.id}`;
        minus.setAttribute("aria-label", `Remove one ${item.name}`);
        plus.setAttribute("aria-label", `Add one ${item.name}`);
        minus.disabled = count <= countOf(item.id, true);
        plus.disabled = count >= 99 || unavailable;
        minus.addEventListener("click", () => {
            const last = cart.map(entry => entry.item.id).lastIndexOf(item.id);
            cart.splice(last, 1);
            update(minus.id, `${item.name} removed.`);
        });
        plus.addEventListener("click", () => {
            cart.push({ key: nextKey++, item, note: "", quantity: 1, saved: false });
            update(plus.id, `${item.name} added.`);
        });
        controls.style.marginRight = "0"; // keep the buttons on the right, where "Add" was
        controls.append(minus, element("span", String(count)), plus);
        row.append(description, controls);
        container.append(row);
    }
    if (!matches.length) container.append(element("p", "No menu items match your search."));
}

// Redraw the menu and the cart, then put keyboard focus back where it was.
function update(focusId, message) {
    renderMenu();
    renderCart();
    document.getElementById(focusId)?.focus();
    feedback.textContent = message;
}

function renderCart() {
    const container = document.querySelector("#cart-items");
    container.replaceChildren();
    let total = 0;
    for (const entry of cart) {
        const item = entry.item;
        total += item.cents * entry.quantity;
        const row = element("div", undefined, "cart-item");
        // Name on the left, price on the right, sharing the same text baseline.
        const heading = element("div");
        heading.style.cssText = "display: flex; justify-content: space-between; align-items: baseline; gap: 16px; width: 100%;";
        const name = entry.quantity > 1 ? `${item.name} × ${entry.quantity}` : item.name;
        heading.append(element("strong", name), element("span", money(item.cents * entry.quantity)));
        const note = element("div");
        note.style.width = "100%";
        if (entry.saved) {
            // Already ordered: show its note as text.
            if (entry.note) note.append(element("span", `Note: ${entry.note}`));
        } else {
            const noteInput = element("input");
            noteInput.type = "text";
            noteInput.maxLength = 255;
            noteInput.placeholder = "Add Note (Optional)";
            noteInput.setAttribute("aria-label", `Note for ${item.name}`); // read out by screen readers in place of the removed heading
            noteInput.value = entry.note;
            noteInput.addEventListener("input", () => entry.note = noteInput.value);
            note.append(noteInput);
        }
        row.append(heading, note);
        container.append(row);
    }
    if (!cart.length) container.append(element("p", "No items yet. Add something from the menu."));
    document.querySelector("#cart-total").textContent = money(total);
    document.querySelector("#place-order").disabled = !cart.some(entry => !entry.saved);
    feedback.textContent = "";
}

document.querySelectorAll(".select-table").forEach(button => {
    button.addEventListener("click", () => {
        selectedTable = button.dataset.tableName;
        dialog.dataset.tableId = button.dataset.tableId;
        document.querySelector("#builder-title").textContent = `${editing ? "Edit" : "Create"} order · ${selectedTable}`;
        // Start with the items already on the order (none for a new order).
        cart = existingItems.map(line => ({
            key: nextKey++,
            item: { id: line.menu_item_id, name: line.name, cents: Math.round(Number(line.unit_price) * 100) },
            note: line.comment || "",
            quantity: line.quantity,
            saved: true,
        }));
        document.querySelector("#order-note").value = "";
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
    if (!cart.some(entry => !entry.saved)) return;
    // Send each new line item and its note to the server, which saves them and opens the order page.
    // A new order also sends which table it is for.
    const form = document.querySelector("#add-items-form");
    const fields = cart.filter(entry => !entry.saved).flatMap(entry =>
        [["menu_item_id", entry.item.id], ["quantity", 1], ["special_request", entry.note]]);
    if (!editing) fields.push(["table_id", dialog.dataset.tableId]);
    for (const [name, value] of fields) {
        const input = element("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
    }
    document.querySelector("#place-order").disabled = true;
    form.submit();
});

// Fill the category list from the menu.
for (const category of [...new Set(previewMenu.map(item => item.category))]) {
    const option = element("option", category);
    option.value = category;
    document.querySelector("#menu-category").append(option);
}
