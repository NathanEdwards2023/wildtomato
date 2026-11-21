from django.urls import path
from django.contrib.auth.views import LoginView, LogoutView
from . import views

urlpatterns = [
    path("tables/available/", views.available_tables, name="available_tables"),
    path("orders/<int:pk>/", views.order_detail, name="order_detail"),
    path("orders/<int:pk>/items/add/", views.add_items, name="add_items"),
    path("orders/new/", views.create_order, name="create_order"),
    path("", views.home, name = "home"),
    path("login/", LoginView.as_view(template_name="accounts/login.html", redirect_authenticated_user=True), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
