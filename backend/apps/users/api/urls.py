from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from .admin import AdminStaffViewSet
from .views import MeView, RegisterView

app_name = "users"

# Role-agnostic: mounted directly at /api/v1/auth/ by config/urls.py, outside
# the staff/admin namespace split, because you have no role until you log in.
urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", TokenBlacklistView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]

# Role-scoped staff-account management, picked up by config/urls.py's DOMAINS
# loop like every other app - mounted at /api/v1/admin/users/.
admin_router = DefaultRouter()
admin_router.register("", AdminStaffViewSet, basename="staff-account")

staff_urlpatterns: list = []  # Staff do not manage other accounts.
admin_urlpatterns = admin_router.urls
