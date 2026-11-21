// On an existing order's page the real menu is supplied by the server; elsewhere a sample menu is used.
const menuData = document.querySelector("#menu-data");
const previewMenu = menuData ? JSON.parse(menuData.textContent) : [
    { id: 1, name: "Margherita pizza", category: "Pizza", cents: 1400 },
    { id: 2, name: "Pepperoni pizza", category: "Pizza", cents: 1600 },
    { id: 3, name: "Garden pizza", category: "Pizza", cents: 1550 },
    { id: 4, name: "House salad", category: "Sides", cents: 700 },
    { id: 5, name: "Garlic bread", category: "Sides", cents: 600 },
    { id: 6, name: "Lemonade", category: "Drinks", cents: 350 },
];
const dialog = document.querySelector("#order-builder");
const cart = new Map();
const notes = new Map(); // menu item id -> special request typed for that item
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
            notes.delete(id);
            renderCart();
            document.querySelector("#menu-search").focus();
        });
        controls.append(minus, element("span", String(quantity)), plus, remove);
        const noteLabel = element("label", `Note for ${item.name} `);
        noteLabel.append(element("small", "Optional"));
        noteLabel.htmlFor = `item-note-${id}`;
        const noteInput = element("input");
        noteInput.id = `item-note-${id}`;
        noteInput.type = "text";
        noteInput.maxLength = 255;
        noteInput.placeholder = "e.g. No onions";
        noteInput.value = notes.get(id) || "";
        noteInput.addEventListener("input", () => notes.set(id, noteInput.value));
        const note = element("div");
        note.style.width = "100%";
        note.append(noteLabel, noteInput);
        row.append(element("strong", item.name), controls, element("span", money(item.cents * quantity)), note);
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
        notes.clear();
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
    if (!cart.size) return;
    if (editing) {
        // Send the new items and their notes to the server, which saves them and reloads the order page.
        const form = document.querySelector("#add-items-form");
        for (const [id, quantity] of cart) {
            for (const [name, value] of [["menu_item_id", id], ["quantity", quantity], ["special_request", notes.get(id) || ""]]) {
                const input = element("input");
                input.type = "hidden";
                input.name = name;
                input.value = value;
                form.append(input);
            }
        }
        document.querySelector("#place-order").disabled = true;
        form.submit();
        return;
    }
    feedback.textContent = `Preview complete for ${selectedTable}. No order was saved; the table is still available.`;
});

// Fill the category list from the menu.
for (const category of [...new Set(previewMenu.map(item => item.category))]) {
    const option = element("option", category);
    option.value = category;
    document.querySelector("#menu-category").append(option);
}
