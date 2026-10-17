"""The paperwork a restaurant has to be able to produce on request.

A food hygiene certificate, public liability insurance, a premises licence, a
pest control contract, allergen training records. Today they live in a folder
behind the counter, and the moment they are needed is the moment somebody is
standing there waiting.

So this is not a filing system. It is one screen a manager opens in front of an
inspector, which means the ordering is by what gets asked for, the preview has
to open in one tap, and a document nobody can open is worse than no feature at
all.
"""

from django.db import models

from apps.common.models import BaseModel


class DocumentCategory(BaseModel):
    """What kind of paperwork this is - the restaurant's own words for it.

    Named by the manager rather than chosen from a list we wrote. Every
    restaurant keeps a different set, an inspector asks for things in their own
    terms, and a fixed list would mean the one certificate that matters landing
    under "Other".
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="document_categories"
    )
    name = models.CharField(max_length=80)
    #: Where it sits on the screen. An inspector asks for the hygiene
    #: certificate first and the pest contract last, and that order is the
    #: restaurant's to set.
    sort_order = models.PositiveIntegerField(default=0)
    #: Retired rather than deleted: a category that held documents still
    #: describes them, and removing it would orphan their only label.
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("sort_order", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "name"), name="unique_document_category_per_restaurant"
            )
        ]
        indexes = [models.Index(fields=("restaurant", "is_active"))]

    def __str__(self):
        return self.name


class ComplianceDocument(BaseModel):
    """One document: a photograph of a certificate, or the PDF it arrived as."""

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="documents"
    )
    #: Optional, and PROTECT rather than CASCADE: deleting a category must
    #: never take the certificates filed under it with it. Retiring one is the
    #: supported way to stop using it, and a document with no category is
    #: filed rather than lost.
    category = models.ForeignKey(
        DocumentCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="documents",
    )
    title = models.CharField(max_length=150)
    file = models.FileField(upload_to="compliance_documents/")
    #: Recorded at upload because a stored name is weaker evidence than what
    #: the client sent, and the screen needs to know whether to render a
    #: picture or offer to open a PDF.
    content_type = models.CharField(max_length=64, blank=True, default="")
    #: What it is for, in the manager's words - "renewed after the November
    #: inspection", "covers the upstairs kitchen too".
    notes = models.TextField(blank=True, default="")
    #: Certificates expire, and the one thing worse than not finding a
    #: document is producing one that ran out in March. Optional because
    #: plenty of paperwork never expires.
    expires_on = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        #: Newest first within a category: the current certificate is the one
        #: that was uploaded last, and it is the one being asked for.
        ordering = ("category__sort_order", "-created_at")
        indexes = [
            models.Index(fields=("restaurant", "category")),
            models.Index(fields=("restaurant", "expires_on")),
        ]

    def __str__(self):
        return self.title

    @property
    def is_image(self) -> bool:
        return self.content_type.startswith("image/")
