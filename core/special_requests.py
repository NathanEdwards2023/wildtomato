from django.db import connection, transaction


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


def get_menu():
    """Return the available menu items with their category name."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT m.item_id, m.name, c.name, m.customer_price "
            "FROM menu m JOIN category c ON c.category_id = m.category_id "
            "WHERE m.available = 1 ORDER BY c.name, m.name"
        )
        return [
            {"id": item_id, "name": name, "category": category, "cents": int(price * 100)}
            for item_id, name, category, price in cursor.fetchall()
        ]


def add_line_items(order_number, items):
    """Save new line items. items is a list of (menu_item_id, quantity, special_request) tuples.
    All values are passed as parameters, never pasted into the SQL. Either every item saves or none do.
    The database trigger sets the price from the menu and blocks closed orders."""
    with transaction.atomic(), connection.cursor() as cursor:
        for menu_item_id, quantity, special_request in items:
            cursor.execute(
                "INSERT INTO line_item (order_number, menu_item_id, quantity, unit_price, comment) "
                "SELECT %s, item_id, %s, customer_price, %s FROM menu WHERE item_id = %s AND available = 1",
                [order_number, quantity, special_request, menu_item_id],
            )
