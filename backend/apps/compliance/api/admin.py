"""What an admin may see and do in the compliance app.

Mounted at /api/v1/admin/compliance/.
"""

from django.db.models import Count
from rest_framework import serializers
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin
from apps.common.files import MAX_FILE_BYTES, sniff_content_type

from .. import models
from .common import (
    BaseChecklistItemSerializer,
    BaseChecklistTaskSerializer,
    BaseChecklistTemplateSerializer,
    BaseFridgeUnitSerializer,
)


class AdminFridgeUnitSerializer(BaseFridgeUnitSerializer):
    class Meta(BaseFridgeUnitSerializer.Meta):
        fields = (*BaseFridgeUnitSerializer.Meta.fields, "is_active")


class AdminFridgeUnitViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Registering and editing the restaurant's fridges/freezers - name,
    photo, kind, and the temperature ceiling staff readings are checked
    against."""

    serializer_class = AdminFridgeUnitSerializer
    queryset = models.FridgeUnit.objects.all()
    filterset_fields = ("kind", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistItemSerializer(BaseChecklistItemSerializer):
    class Meta(BaseChecklistItemSerializer.Meta):
        fields = (*BaseChecklistItemSerializer.Meta.fields, "is_active")


class AdminChecklistItemViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Maintaining the opening/closing checklists - add, edit, reorder or
    deactivate a line. Deactivating rather than deleting keeps historical
    completions meaningful (a completion still points at the item that was
    ticked, even if it's since been retired)."""

    serializer_class = AdminChecklistItemSerializer
    queryset = models.ChecklistItem.objects.all()
    filterset_fields = ("routine", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistTemplateSerializer(BaseChecklistTemplateSerializer):
    class Meta(BaseChecklistTemplateSerializer.Meta):
        fields = (*BaseChecklistTemplateSerializer.Meta.fields, "is_active")


class AdminChecklistTemplateViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Registering the restaurant's named daily/weekly/monthly checklists -
    "Toilet Cleaning", "Monthly Deep Clean" - each frequency can have any
    number of these, unlike the single opening/closing checklist."""

    serializer_class = AdminChecklistTemplateSerializer
    queryset = models.ChecklistTemplate.objects.all()
    filterset_fields = ("frequency", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistTaskSerializer(BaseChecklistTaskSerializer):
    class Meta(BaseChecklistTaskSerializer.Meta):
        fields = (*BaseChecklistTaskSerializer.Meta.fields, "is_active")


class AdminChecklistTaskViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Maintaining one checklist template's tasks (?template=<id>) - same
    deactivate-don't-delete reasoning as AdminChecklistItemViewSet."""

    serializer_class = AdminChecklistTaskSerializer
    queryset = models.ChecklistTask.objects.all()
    filterset_fields = ("template", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminDocumentCategorySerializer(serializers.ModelSerializer):
    #: So the screen can say "3 documents" without fetching them, and so an
    #: empty category looks different from one that is simply collapsed.
    document_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = models.DocumentCategory
        fields = ("id", "name", "sort_order", "is_active", "document_count")
        read_only_fields = ("id", "document_count")


class AdminDocumentCategoryViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """The restaurant's own names for its paperwork.

    Retiring beats deleting, and the model enforces it: a category still
    holding documents cannot be removed, because it is their only label.
    """

    serializer_class = AdminDocumentCategorySerializer
    queryset = models.DocumentCategory.objects.all()
    filterset_fields = ("is_active",)

    def get_queryset(self):
        # The order_by is not redundant. Aggregating adds a GROUP BY, and
        # Django drops the model's default ordering when it does - so without
        # restating it the categories come back in whatever order the database
        # finds convenient, which makes `sort_order` a field nobody obeys and
        # pagination unstable between requests.
        return (
            super()
            .get_queryset()
            .annotate(document_count=Count("documents"))
            .order_by("sort_order", "name")
        )

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    def perform_destroy(self, instance):
        if instance.documents.exists():
            raise DRFValidationError(
                "That category still has documents filed under it. Retire it instead, or "
                "move them first."
            )
        instance.delete()


class AdminComplianceDocumentSerializer(serializers.ModelSerializer):
    """One document, as the screen needs it.

    `file` is read as a URL and written as an upload - the same field doing
    both, which is what a FileField already is. The URL is signed and expires,
    so the app has to use one fresh from here rather than remembering it.
    """

    file = serializers.FileField()
    category_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    is_image = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.ComplianceDocument
        fields = (
            "id",
            "category",
            "category_name",
            "title",
            "file",
            "content_type",
            "is_image",
            "notes",
            "expires_on",
            "uploaded_by_name",
            "created_at",
        )
        read_only_fields = (
            "id",
            "category_name",
            "content_type",
            "is_image",
            "uploaded_by_name",
            "created_at",
        )

    def get_category_name(self, obj) -> str | None:
        return obj.category.name if obj.category_id else None

    def get_uploaded_by_name(self, obj) -> str | None:
        if not obj.uploaded_by_id:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.email

    def validate_file(self, upload):
        """Trust the bytes, not the label.

        A phone will happily upload a perfectly good PDF as
        application/octet-stream, and a JPEG named .pdf is still a JPEG. The
        type is worked out here and stored, because the screen later has to
        know whether to draw a picture or hand the file to the phone's own
        viewer, and by then the bytes are in a bucket.
        """
        if upload.size > MAX_FILE_BYTES:
            raise serializers.ValidationError(
                f"That file is too large - upload one under {MAX_FILE_BYTES // (1024 * 1024)}MB."
            )

        head = upload.read(32)
        upload.seek(0)
        content_type = sniff_content_type(head, getattr(upload, "content_type", "") or "")
        if not content_type:
            raise serializers.ValidationError(
                "That file cannot be read - upload a photo (JPEG, PNG or WebP) or a PDF."
            )

        self._content_type = content_type
        return upload

    def validate_category(self, category):
        """A category from another restaurant is not a category.

        The queryset is scoped on read; this is the write side of the same
        rule, and without it one restaurant could file a document under
        another's label by sending its id.
        """
        request = self.context.get("request")
        if (
            category is not None
            and request
            and category.restaurant_id != request.user.restaurant_id
        ):
            raise serializers.ValidationError("That category does not belong to this restaurant.")
        return category


class AdminComplianceDocumentViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Certificates, licences, insurance - whatever has to be produced on
    request. Admin-only in both directions: there is no staff route to these
    at all, by design."""

    serializer_class = AdminComplianceDocumentSerializer
    queryset = models.ComplianceDocument.objects.select_related("category", "uploaded_by")
    filterset_fields = ("category",)

    def perform_create(self, serializer):
        serializer.save(
            restaurant=self.request.user.restaurant,
            uploaded_by=self.request.user,
            content_type=getattr(serializer, "_content_type", ""),
        )
