from django.contrib import admin
from .models import DiningTable, Employee, TableOrder


class SharedReadOnlyAdmin(admin.ModelAdmin):
    """Shared order writes belong to the SQL-backed order workflow."""
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DiningTable)
class DiningTableAdmin(SharedReadOnlyAdmin):
    list_display = ["table_id", "name", "seats"]


@admin.register(Employee)
class EmployeeAdmin(SharedReadOnlyAdmin):
    list_display = ["id", "first_name", "last_name", "user", "role"]


@admin.register(TableOrder)
class TableOrderAdmin(SharedReadOnlyAdmin):
    list_display = ["number", "table", "employee", "status", "order_time"]
    list_filter = ["status", "employee"]
