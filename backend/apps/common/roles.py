"""The single definition of who can do what.

`Role` is an access level, not a job title. Permissions, API route namespaces
and the mobile app's navigator all branch on this one field, so it must stay
small - adding a value here means adding a matching `api/<role>.py` in each
domain app and a `roles/<role>/` tree in the mobile client.

If the business later needs "chef" or "cashier" for rotas or reporting, that is
a separate `job_title` field. Do not overload this one.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    ADMIN = "ADMIN", _("Admin")
    STAFF = "STAFF", _("Staff")
    # A third role slots in here, e.g.:
    # KITCHEN = "KITCHEN", _("Kitchen")


#: Roles allowed to reach the /api/v1/admin/ namespace.
ADMIN_ROLES = frozenset({Role.ADMIN})

#: Roles allowed to reach the /api/v1/staff/ namespace. Admins are included so
#: an owner can use the floor screens without a second account.
STAFF_ROLES = frozenset({Role.STAFF, Role.ADMIN})
