from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.http import HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST
from .models import DiningTable, TableOrder
from .special_requests import add_line_items, get_menu, get_order_lines


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
    return render(request, "server/open_tables.html", {"available_tables": tables})


@login_required
@never_cache
def order_detail(request, pk):
    order = get_object_or_404(
        visible_orders(request.user).select_related("table", "employee"), pk=pk
    )
    return render(request, "server/order_details.html", {
        "order": order,
        "line_items": get_order_lines(order.pk),
        "menu": get_menu() if order.status == TableOrder.Status.OPEN else [],
    })


@login_required
@require_POST
def add_items(request, pk):
    order = get_object_or_404(visible_orders(request.user), pk=pk)
    if order.status != TableOrder.Status.OPEN:
        return HttpResponseBadRequest("Cannot add items to a closed order.")
    menu_ids = request.POST.getlist("menu_item_id")
    quantities = request.POST.getlist("quantity")
    notes = request.POST.getlist("special_request")
    if not menu_ids or not (len(menu_ids) == len(quantities) == len(notes)):
        return HttpResponseBadRequest("No items to add.")
    available_ids = {item["id"] for item in get_menu()}
    items = []
    for menu_id, quantity, note in zip(menu_ids, quantities, notes):
        if not (menu_id.isdigit() and quantity.isdigit()):
            return HttpResponseBadRequest("Invalid item.")
        menu_id, quantity, note = int(menu_id), int(quantity), note.strip()
        if menu_id not in available_ids or not 1 <= quantity <= 99:
            return HttpResponseBadRequest("Invalid item.")
        if len(note) > 255:
            return HttpResponseBadRequest("Special request must be 255 characters or fewer.")
        items.append((menu_id, quantity, note or None))
    add_line_items(order.pk, items)
    return redirect("order_detail", pk=order.pk)
