from django.db import connection


def get_order_note(order_number):
    with connection.cursor() as cursor:
        cursor.execute("SELECT note FROM orders WHERE number = %s", [order_number])
        return cursor.fetchone()[0]


def set_order_note(order_number, note):
    """Uses the database's set_order_note procedure. Blank text clears the note."""
    with connection.cursor() as cursor:
        cursor.execute("CALL set_order_note(%s, %s)", [order_number, note])
