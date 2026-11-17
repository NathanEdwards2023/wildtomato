"""Story acceptance checks. Run: python manage.py test core.

Keep each story in its own labeled TestCase section. Within each section,
group setup/helpers, numbered acceptance criteria, and supporting checks.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from .models import DiningTable, Employee, TableOrder


# ============================================================================
# GP557-22 / S2: Unique server login
# As a server, I want a unique login so I only see my own data.
# Verification subtask: GP557-53
# ============================================================================
class ServerLoginTests(TestCase):
    # --- Setup and helpers: isolated tables, two servers, and their orders ---
    password = "Test-only-Login-578!"

    @classmethod
    def setUpClass(cls):
        # SQL owns these unmanaged models in production. Create only the
        # mappings required by these tests in Django's separate test database.
        with connection.schema_editor() as editor:
            for model in (Employee, DiningTable, TableOrder):
                editor.create_model(model)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with connection.schema_editor() as editor:
            for model in (TableOrder, DiningTable, Employee):
                editor.delete_model(model)

    @classmethod
    def setUpTestData(cls):
        cls.server = get_user_model().objects.create_user(username="server_a", password=cls.password)
        cls.other = get_user_model().objects.create_user(username="server_b", password=cls.password)
        cls.orders = []
        for i, user in enumerate((cls.server, cls.other)):
            employee = Employee.objects.create(id=101+i, user=user, first_name=user.username,
                last_name="Example", hourly_rate=15, role="server")
            table = DiningTable.objects.create(name=f"Private table {i}", seats=4)
            cls.orders.append(TableOrder.objects.create(employee=employee, table=table,
                order_time=timezone.now()))

    def login(self, username="server_a", password=None, **extra):
        return self.client.post(reverse("login"), {"username": username,
            "password": self.password if password is None else password, **extra})

    # --- Acceptance criterion 1: servers see only their assigned orders ---
    # Check both dashboard results and direct access to another server's URL.
    def test_valid_login_and_order_isolation_for_both_servers(self):
        for i, user in enumerate((self.server, self.other)):
            self.client.logout()
            self.assertRedirects(self.login(username=user.username), reverse("home"))
            response = self.client.get(reverse("home"))
            self.assertContains(response, f"Private table {i}")
            self.assertNotContains(response, f"Private table {1-i}")
            self.assertEqual(self.client.get(reverse("order_detail", args=[self.orders[i].pk])).status_code, 200)
            self.assertEqual(self.client.get(reverse("order_detail", args=[self.orders[1-i].pk])).status_code, 404)

    # --- Acceptance criterion 2: wrong credentials show an error and no data ---
    def test_wrong_or_missing_credentials_show_error_without_data(self):
        for username, password in [("server_a", "wrong"), ("unknown", self.password), ("", ""), ("server_a", "")]:
            response = self.login(username=username, password=password)
            self.assertContains(response, "Your username or password is incorrect")
            self.assertNotContains(response, "Private table")
            self.assertNotIn("_auth_user_id", self.client.session)
            self.assertEqual(self.client.get(reverse("home")).status_code, 302)

    # --- Acceptance criterion 3: SQL-like input cannot expose or change data ---
    # Try each visible login field and compare application records afterward.
    def test_sql_injection_is_plain_input_and_changes_no_application_data(self):
        models = (get_user_model(), Employee, DiningTable, TableOrder)
        before = [list(model.objects.order_by("pk").values()) for model in models]
        for payload in ["' OR '1'='1", "'; DROP TABLE orders; --", "'; DROP TABLE orders; ?"]:
            for field in ("username", "password"):
                credentials = {"username": "server_a", "password": self.password}
                credentials[field] = payload
                response = self.client.post(reverse("login"), credentials)
                self.assertContains(response, "Your username or password is incorrect")
                self.assertNotContains(response, "Private table")
                self.assertNotContains(response, "Traceback")
                self.assertNotContains(response, "ProgrammingError")
                self.assertNotIn("_auth_user_id", self.client.session)
        self.assertEqual(before, [list(model.objects.order_by("pk").values()) for model in models])

    # --- Supporting security checks for GP557-22 ---

    # Redirects must stay local and cannot grant access to another server's order.
    def test_next_parameter_is_safe_and_cannot_bypass_ownership(self):
        self.assertRedirects(self.login(next="https://example.org/"), reverse("home"))
        self.client.logout()
        target = reverse("order_detail", args=[self.orders[1].pk])
        response = self.login(next=target)
        self.assertEqual(response.url, target)
        self.assertEqual(self.client.get(target).status_code, 404)

    # A login without an employee mapping must not inherit anyone else's orders.
    def test_unlinked_user_has_no_orders(self):
        user = get_user_model().objects.create_user(username="unlinked")
        self.client.force_login(user)
        self.assertContains(self.client.get(reverse("home")), "No active tables")
        self.assertEqual(self.client.get(reverse("order_detail", args=[self.orders[0].pk])).status_code, 404)

    # Login submissions require the CSRF token supplied by the form.
    def test_login_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.post(reverse("login"), {"username": "server_a", "password": self.password}).status_code, 403)
        client.get(reverse("login"))
        response = client.post(reverse("login"), {"username": "server_a", "password": self.password,
            "csrfmiddlewaretoken": client.cookies["csrftoken"].value})
        self.assertEqual(response.status_code, 302)

    # Disabled accounts cannot log in; logging out removes protected access.
    def test_inactive_login_and_logout(self):
        self.server.is_active = False
        self.server.save()
        self.assertContains(self.login(), "Your username or password is incorrect")
        self.server.is_active = True
        self.server.save()
        self.login()
        self.assertRedirects(self.client.get(reverse("login")), reverse("home"))
        self.assertEqual(self.client.get(reverse("logout")).status_code, 405)
        self.assertRedirects(self.client.post(reverse("logout")), reverse("login"))
        for target in (reverse("home"), reverse("order_detail", args=[self.orders[0].pk])):
            self.assertEqual(self.client.get(target).status_code, 302)
