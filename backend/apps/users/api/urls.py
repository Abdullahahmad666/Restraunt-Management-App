from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenRefreshView,
)

from .admin import AdminInviteCodeViewSet, AdminStaffViewSet
from .views import (
    ChangePasswordView,
    CustomLoginView,
    InviteCodeLookupView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    VerifyEmailView,
)

app_name = "users"

# Role-agnostic: mounted directly at /api/v1/auth/ by config/urls.py, outside
# the staff/admin namespace split, because you have no role until you log in.
urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path(
        "invite-codes/<str:code>/",
        InviteCodeLookupView.as_view(),
        name="invite-code-lookup",
    ),
    path("login/", CustomLoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", TokenBlacklistView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]

# Role-scoped staff-account management, picked up by config/urls.py's DOMAINS
# loop like every other app - mounted at /api/v1/admin/staff-accounts/.
#
# Every domain's staff_urlpatterns/admin_urlpatterns is included at
# config/urls.py's path("", ...) - there is no per-app URL segment, only
# each router's own resource prefixes. An empty "" prefix here would collide
# with (and lose to) another domain's auto-generated DRF root view at the
# same bare /api/v1/admin/ path, making the endpoint unreachable - hence a
# real, explicit prefix instead of "".
admin_router = DefaultRouter()
admin_router.register("staff-accounts", AdminStaffViewSet, basename="staff-account")
admin_router.register("invite-codes", AdminInviteCodeViewSet, basename="invite-code")

staff_urlpatterns: list = []  # Staff do not manage other accounts.
admin_urlpatterns = admin_router.urls
