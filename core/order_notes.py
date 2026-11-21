from django.contrib.auth.decorators import login_required
from django.db import connection
from django.http import HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST
from .models import TableOrder
from .views import visible_orders


@login_required
@require_POST
def save_order_note(request, pk):
    order = get_object_or_404(visible_orders(request.user), pk=pk)
    if order.status != TableOrder.Status.OPEN:
        return HttpResponseBadRequest("Cannot change the note on a closed order.")
    note = request.POST.get("order_note", "").strip()
    if len(note) > 255:
        return HttpResponseBadRequest("Order note must be 255 characters or fewer.")
    # The database's set_order_note procedure saves the note. Blank text clears it.
    with connection.cursor() as cursor:
        cursor.execute("CALL set_order_note(%s, %s)", [order.pk, note])
    return redirect("order_detail", pk=order.pk)
