from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Prefetch
from django.http import HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST
from .models import DiningTable, Employee, TableOrder
from .special_requests import (
    add_line_items, get_menu, get_order_lines, get_order_total, get_removed_items, get_subtotals, insert_order,
    remove_one_item,
)


def visible_orders(user):
    """Superusers can inspect all orders; other accounts see only their own."""
    orders = TableOrder.objects.all()
    if not user.is_superuser:
        orders = orders.filter(employee__user=user)
    return orders


@login_required
@never_cache
def home(request):
    orders = visible_orders(request.user).filter(status=TableOrder.Status.OPEN)
    tables = DiningTable.objects.filter(orders__in=orders).distinct().prefetch_related(
        Prefetch("orders", queryset=orders.order_by("order_time", "pk"), to_attr="active_orders")
    )
    return render(request, "server/active_tables.html", {"active_tables": tables})


@login_required
@never_cache
def available_tables(request):
    occupied_tables = TableOrder.objects.filter(
        status=TableOrder.Status.OPEN
    ).values("table_id")
    tables = DiningTable.objects.exclude(pk__in=occupied_tables)
    return render(request, "server/open_tables.html", {"available_tables": tables, "menu": get_menu()})


@login_required
@never_cache
def order_detail(request, pk):
    order = get_object_or_404(
        visible_orders(request.user).select_related("table", "employee"), pk=pk
    )
    items_total, removed_total = get_subtotals(order.pk)
    return render(request, "server/order_details.html", {
        "order": order,
        "line_items": get_order_lines(order.pk),
        "removed_items": get_removed_items(order.pk),
        "subtotal": items_total + removed_total,
        "removed_total": removed_total,
        "items_total": items_total,
        "order_total": get_order_total(order.pk),
        "menu": get_menu() if order.status == TableOrder.Status.OPEN else [],
    })


@login_required
@require_POST
def remove_item(request, pk, line_item_id):
    """Take one unit of a line item off an open order."""
    order = get_object_or_404(visible_orders(request.user), pk=pk)
    if order.status != TableOrder.Status.OPEN:
        return HttpResponseBadRequest("Items cannot be removed after payment.")
    if not any(line["line_item_id"] == line_item_id for line in get_order_lines(order.pk)):
        return HttpResponseBadRequest("That item is not on this order.")
    employee = Employee.objects.filter(user=request.user).first()
    if employee is None:
        return HttpResponseBadRequest("Your login is not linked to an employee.")
    remove_one_item(line_item_id, employee.pk)
    return redirect("order_detail", pk=order.pk)


def read_items(request):
    """Check the items sent from the order window. Returns (items, error message)."""
    menu_ids = request.POST.getlist("menu_item_id")
    quantities = request.POST.getlist("quantity")
    notes = request.POST.getlist("special_request")
    if not menu_ids or not (len(menu_ids) == len(quantities) == len(notes)):
        return None, "No items to add."
    available_ids = {item["id"] for item in get_menu() if item["available"]}
    items = []
    for menu_id, quantity, note in zip(menu_ids, quantities, notes):
        if not (menu_id.isdigit() and quantity.isdigit()):
            return None, "Invalid item."
        menu_id, quantity, note = int(menu_id), int(quantity), note.strip()
        if menu_id not in available_ids or not 1 <= quantity <= 99:
            return None, "Invalid item."
        if len(note) > 255:
            return None, "Special request must be 255 characters or fewer."
        items.append((menu_id, quantity, note or None))
    return items, None


@login_required
@require_POST
def add_items(request, pk):
    order = get_object_or_404(visible_orders(request.user), pk=pk)
    if order.status != TableOrder.Status.OPEN:
        return HttpResponseBadRequest("Cannot add items to a closed order.")
    items, error = read_items(request)
    if error:
        return HttpResponseBadRequest(error)
    add_line_items(order.pk, items)
    return redirect("order_detail", pk=order.pk)


@login_required
@require_POST
def create_order(request):
    """Open a new order on an available table, for the employee linked to this login, with its first items."""
    table_id = request.POST.get("table_id", "")
    if not table_id.isdigit() or not DiningTable.objects.filter(pk=table_id).exists():
        return HttpResponseBadRequest("Unknown table.")
    if TableOrder.objects.filter(table_id=table_id, status=TableOrder.Status.OPEN).exists():
        return HttpResponseBadRequest("This table already has an open order.")
    employee = Employee.objects.filter(user=request.user).first()
    if employee is None:
        return HttpResponseBadRequest("Your login is not linked to an employee.")
    items, error = read_items(request)
    if error:
        return HttpResponseBadRequest(error)
    with transaction.atomic():
        number = insert_order(int(table_id), employee.pk)
        add_line_items(number, items)
    return redirect("order_detail", pk=number)
