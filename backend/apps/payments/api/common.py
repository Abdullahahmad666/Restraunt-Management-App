"""Serializers and querysets for the payments app that every role shares.

Bills, payments and refunds.

Put a field list here when both roles need it and let staff.py / admin.py
subclass it. Duplicating the list in both is how the two quietly drift apart.
"""

from rest_framework import serializers  # noqa: F401

# class Base<Model>Serializer(serializers.ModelSerializer):
#     class Meta:
#         model = <Model>
#         fields = ("id", ...)
