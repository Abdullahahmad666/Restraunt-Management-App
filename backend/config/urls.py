"""Root URL configuration.

Two things are versioned and namespaced here, and nowhere else:

    /api/v1/auth/     role-agnostic - you have no role until you log in
    /api/v1/staff/    floor screens; scoped to the caller's own restaurant
    /api/v1/admin/    management screens

Each domain app exports `staff_urlpatterns` and `admin_urlpatterns` from its
api/urls.py. Adding a third role means adding one list per app and one entry
below - no app has to know what prefix it is mounted under.

Reverse names read: v1:staff:restaurants:restaurant-list
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
from apps.restaurants.api import urls as restaurants_urls

DOMAINS = (("restaurants", restaurants_urls),)

staff_api = [
    path("", include((module.staff_urlpatterns, name), namespace=name)) for name, module in DOMAINS
]

admin_api = [
    path("", include((module.admin_urlpatterns, name), namespace=name)) for name, module in DOMAINS
]

api_v1 = [
    # Login happens before a role exists, so auth sits outside both namespaces.
    path("auth/", include("apps.users.api.urls")),
    path("staff/", include((staff_api, "staff"), namespace="staff")),
    path("admin/", include((admin_api, "admin"), namespace="admin")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", health_check, name="health-check"),
    path("api/v1/", include((api_v1, "v1"), namespace="v1")),
    # OpenAPI schema + docs. The mobile client mirrors these in src/api/.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
