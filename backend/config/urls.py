"""Root URL configuration.

Everything the mobile app talks to lives under /api/v1/. Version the prefix so
a breaking change can ship as /api/v2/ without stranding older installs.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.common.views import health_check

api_v1 = [
    path("auth/", include("apps.users.api.urls")),
    path("restaurants/", include("apps.restaurants.api.urls")),
    path("orders/", include("apps.orders.api.urls")),
    path("inventory/", include("apps.inventory.api.urls")),
    path("payments/", include("apps.payments.api.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", health_check, name="health-check"),
    path("api/v1/", include((api_v1, "v1"), namespace="v1")),
    # OpenAPI schema + docs. The mobile client generates its types from these.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
