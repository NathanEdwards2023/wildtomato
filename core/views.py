from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404, render
from django.views.decorators.cache import never_cache
from .models import DiningTable, TableOrder


@login_required
@never_cache
def home(request):
    orders = TableOrder.objects.filter(employee__user=request.user, status=TableOrder.Status.OPEN)
    tables = DiningTable.objects.filter(orders__in=orders).distinct().prefetch_related(
        Prefetch("orders", queryset=orders.order_by("order_time", "pk"), to_attr="active_orders")
    )
    return render(request, "home.html", {"active_tables": tables})


@login_required
@never_cache
def order_detail(request, pk):
    order = get_object_or_404(TableOrder.objects.select_related("table", "employee"), pk=pk, employee__user=request.user)
    return render(request, "order_detail.html", {"order": order})
