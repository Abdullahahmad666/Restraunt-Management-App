"""Building what the extractor returns, in the shape it actually returns it.

Every scanning test mocks the model call, which means every one of them
encodes the response shape. Spelling that out in each file is how a schema
change passes its own tests while breaking in production - so it is spelled
out once, here.

Mirrors apps.inventory.services.extraction.RESPONSE_SCHEMA.
"""


def line(
    description="Chicken Breast",
    *,
    quantity=1,
    unit_price=None,
    line_total=None,
    size=None,
    product_code=None,
):
    return {
        "product_code": product_code,
        "description": description,
        "size": size,
        "quantity": quantity,
        "unit_price": unit_price,
        "tax_rate": None,
        "tax_amount": None,
        "discount": None,
        "line_total": line_total,
    }


def party(name=None):
    return {"name": name, "address": None, "email": None, "phone": None, "tax_id": None}


def scan_result(
    *,
    items=None,
    supplier_name="Fresh Foods Ltd",
    document_type="invoice",
    invoice_date=None,
    invoice_number=None,
    shipping_address=None,
    subtotal=None,
    tax_total=None,
    total=None,
    is_invoice=True,
):
    """One extraction result, with every field the schema requires."""
    return {
        "is_invoice": is_invoice,
        "document_type": document_type,
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "due_date": None,
        "currency": "GBP",
        "supplier": party(supplier_name),
        "customer": party("The Test Kitchen"),
        "shipping_address": shipping_address,
        "items": items if items is not None else [line()],
        "subtotal": subtotal,
        "tax_total": tax_total,
        "discount_total": None,
        "delivery_charge": None,
        "total": total,
        "amount_due": total,
    }
