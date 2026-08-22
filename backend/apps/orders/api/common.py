"""Serializers and querysets for the orders app that every role shares.

Order capture, line items and status transitions.

Put a field list here when both roles need it and let staff.py / admin.py
subclass it. Duplicating the list in both is how the two quietly drift apart.
"""

from rest_framework import serializers  # noqa: F401

# class Base<Model>Serializer(serializers.ModelSerializer):
#     class Meta:
#         model = <Model>
#         fields = ("id", ...)
