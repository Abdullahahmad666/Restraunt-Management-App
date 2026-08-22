"""Business logic for the inventory app.

Views stay thin: they validate input and call into here. Anything that touches
more than one model, or that a management command / celery task would also
need, belongs in a service function.
"""
