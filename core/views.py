from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404, render
from django.views.decorators.cache import never_cache
from .models import DiningTable, TableOrder


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
    return render(request, "server/order_details.html", {"order": order})
