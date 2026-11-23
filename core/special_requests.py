from django.db import connection, transaction


def insert_order(table_id, employee_id):
    """Open a new order for a table and return its order number."""
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO orders (employee_id, table_id) VALUES (%s, %s)", [employee_id, table_id])
        return cursor.lastrowid


def get_order_lines(order_number):
    """Return the line items for one order (with the menu item's name) as a list of dictionaries."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT li.line_item_id, li.menu_item_id, m.name, li.quantity, li.unit_price, li.comment "
            "FROM line_item li JOIN menu m ON m.item_id = li.menu_item_id "
            "WHERE li.order_number = %s ORDER BY li.line_item_id",
            [order_number],
        )
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


def get_order_total(order_number):
    """Return the order's total from the database's v_order_totals view."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT total FROM v_order_totals WHERE number = %s", [order_number])
        return cursor.fetchone()[0]


def get_menu():
    """Return every menu item with its category name and whether it can be ordered right now."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT m.item_id, m.name, c.name, m.customer_price, m.available "
            "FROM menu m JOIN category c ON c.category_id = m.category_id "
            "ORDER BY c.name, m.name"
        )
        return [
            {"id": item_id, "name": name, "category": category, "cents": int(price * 100), "available": bool(available)}
            for item_id, name, category, price, available in cursor.fetchall()
        ]


def add_line_items(order_number, items):
    """Save new line items. items is a list of (menu_item_id, quantity, special_request) tuples.
    An item with no note is added to the order's no-note row for that dish (its quantity goes up).
    An item with a note always gets its own new row.
    All values are passed as parameters, never pasted into the SQL. Either every item saves or none do.
    The database trigger sets the price from the menu and blocks closed orders."""
    with transaction.atomic(), connection.cursor() as cursor:
        for menu_item_id, quantity, special_request in items:
            if special_request is None:
                cursor.execute(
                    "SELECT line_item_id FROM line_item "
                    "WHERE order_number = %s AND menu_item_id = %s AND comment IS NULL "
                    "ORDER BY line_item_id LIMIT 1",
                    [order_number, menu_item_id],
                )
                row = cursor.fetchone()
                if row:
                    cursor.execute(
                        "UPDATE line_item SET quantity = quantity + %s WHERE line_item_id = %s",
                        [quantity, row[0]],
                    )
                    continue
            cursor.execute(
                "INSERT INTO line_item (order_number, menu_item_id, quantity, unit_price, comment) "
                "SELECT %s, item_id, %s, customer_price, %s FROM menu WHERE item_id = %s AND available = 1",
                [order_number, quantity, special_request, menu_item_id],
            )


def get_removed_items(order_number):
    """Return the items removed from one order, one row per unit, oldest first."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT m.name, r.unit_price, r.comment "
            "FROM removed_item r JOIN menu m ON m.item_id = r.menu_item_id "
            "WHERE r.order_number = %s ORDER BY r.removed_id",
            [order_number],
        )
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


def get_subtotals(order_number):
    """Return (subtotal of what's left, total of removed items) from v_order_totals."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT subtotal, removed_total FROM v_order_totals WHERE number = %s", [order_number])
        return cursor.fetchone()


def remove_one_item(line_item_id, employee_id):
    """Take one unit off a line item and log it in removed_item.
    The procedure runs its own transaction, so don't call this inside transaction.atomic()."""
    with connection.cursor() as cursor:
        cursor.execute("CALL remove_one_item(%s, %s)", [line_item_id, employee_id])
