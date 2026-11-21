from django.urls import path
from django.contrib.auth.views import LoginView, LogoutView
from . import views

urlpatterns = [
    path("tables/available/", views.available_tables, name="available_tables"),
    path("orders/<int:pk>/", views.order_detail, name="order_detail"),
    path("", views.home, name = "home"),
    path("orders/<int:pk>/note/", views.save_order_note, name="save_order_note"),
    path("login/", LoginView.as_view(template_name="accounts/login.html", redirect_authenticated_user=True), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
