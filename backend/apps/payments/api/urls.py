"""Routes for the payments app, mounted at /api/v1/payments/."""

from rest_framework.routers import DefaultRouter

app_name = "payments"

router = DefaultRouter()
# router.register("", SomeViewSet, basename="some")

urlpatterns = router.urls
