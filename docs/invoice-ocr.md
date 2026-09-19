# Invoice scanning

Status: **built and merged** in `apps.inventory` (PR #22), with known gaps
before it is production-ready. This document describes what exists, the
decisions behind it, and what it still needs.

Originally written as a build plan before PR #22 landed. Rewritten against the
merged code so it describes reality rather than an intention.

## What it does

Staff photograph a supplier invoice. A vision model reads the line items off
it. The result is a **proposal** - nothing touches stock until a human reviews
each line, matches it to an inventory item, and confirms. Confirming writes a
`DELIVERY` stock movement per line and refreshes that item's cost per unit.

```
photo ──► InvoiceScan (PENDING)
            │
            ▼
      vision model reads line items ──► InvoiceLineItem rows (unmatched)
            │
            ▼
      human reviews, corrects, matches each line to an InventoryItem
            │
            ▼
      confirm ──► StockMovement (DELIVERY) per line, cost_per_unit refreshed
                  InvoiceScan (CONFIRMED)
```

The reviewed-before-applied rule is the important one. A misread quantity is an
annoyance to fix in review; the same misread applied silently to stock and cost
figures is a real problem. `confirm_invoice` refuses to run while any line is
still unmatched, because a line nobody matched is stock that would never be
counted.

## Data model - `apps/inventory`

| Model | Owns |
| --- | --- |
| `InventoryItem` | Name, unit, `quantity_on_hand`, optional `par_level` and `cost_per_unit`, `is_active`. Unique per restaurant by name |
| `StockMovement` | The ledger - `DELIVERY` / `WASTE` / `CORRECTION`, signed `quantity_delta`, optional link back to the invoice line that caused it |
| `InvoiceScan` | Photo, `PENDING` / `CONFIRMED` / `DISCARDED`, supplier name, invoice date, `scan_error`, uploader |
| `InvoiceLineItem` | `raw_name` as read, `matched_item` (starts null), quantity, unit, unit price, line total, sort order |

Two design choices worth keeping in mind:

- `quantity_on_hand` is a running total corrected only by `StockMovement` rows,
  never edited directly, so there is always a trail explaining how it reached
  its current value.
- `StockMovement.invoice_line_item` gives traceability from a stock figure back
  to the source document - which is what makes the numbers defensible.

A failed scan still creates the `InvoiceScan` with zero line items and a
populated `scan_error`, so staff can retry or enter lines by hand rather than
losing the upload.

## API surface

Staff, mounted at `/api/v1/staff/inventory/`:

```
GET  POST   inventory-items/          list, plus add one inline while matching
GET  POST   stock-movements/          the ledger, plus manual adjustments
GET  POST   invoice-scans/            list/retrieve, and upload (multipart)
POST        invoice-scans/{id}/rescan/    re-run on the same photo
POST        invoice-scans/{id}/confirm/   apply to stock
CRUD        invoice-line-items/       reviewer corrections and matching
```

Admin, mounted at `/api/v1/admin/inventory/`:

```
CRUD        inventory-items/          par level, cost, retire an item
```

Editing an existing item's par level or retiring it is deliberately admin-only;
staff can only add a new item inline while matching an unrecognised invoice
line.

## Mobile

| Screen | Where |
| --- | --- |
| `InventoryHubScreen` | Both stacks - stock list and invoice list |
| `InvoiceReviewScreen` | Both stacks - review, correct and match line items |
| `ManageInventoryItemsScreen` | Admin stack only - par level, cost, retire |

Feature code lives in `mobile/src/features/inventory/` as `api.ts`, `hooks.ts`
and `types.ts`, following the existing per-feature convention.

## Extraction

`apps/inventory/services/scanning.py` posts the photo to the Anthropic Messages
API as base64 with a prompt describing the exact JSON shape to return, then
parses the response. It raises `ValidationError` with a user-safe message on a
missing key, a network error, or a response that is not valid JSON in the
expected shape - the caller records that in `scan_error` and leaves the scan
with zero line items.

`ANTHROPIC_API_KEY` is read in `config/settings/base.py` and defaults to blank.
An environment without one still accepts uploads; scanning fails with a
friendly error rather than a raw auth failure.

## What it still needs

Roughly in priority order. None of these are design mistakes - they are the
production-readiness layer that a first working version reasonably deferred.

### 1. Extraction blocks a request thread

`StaffInvoiceScanViewSet.create` calls the model synchronously, with a 45s
timeout, and `rescan` does the same. Gunicorn runs `--workers 3`, so three
concurrent uploads saturate the entire API for every other caller. This is the
same failure already fixed once for email in `a44f7f7`.

Fix: return `202` immediately and move extraction to a background worker. The
cheapest correct option is a database-backed queue using Postgres
`SELECT FOR UPDATE SKIP LOCKED`, drained by a management command running as a
second Render service (`type: worker`) - no broker, no new datastore.

### 2. Uploaded photos do not survive a deploy

`photo = models.ImageField(upload_to="invoice_scans/")` writes to
`MEDIA_ROOT`, which is inside the container. Render's filesystem is ephemeral
and `render.yaml` declares no disk, so **every invoice photo is destroyed on
redeploy**. Separately, `config/urls.py` only serves `MEDIA_URL` when `DEBUG`
is true, so in production the photos are already unreachable.

Postgres stores only the path - `ImageField` is a `varchar(100)` - so Neon
keeps a perfectly healthy row pointing at a file that no longer exists.

This affects fridge photos and profile pictures too, but it matters most here:
the invoice photo is the evidence behind a stock and cost figure.

Fix: `django-storages` against S3-compatible object storage (Cloudflare R2 or
AWS S3), served by signed URL.

### 3. Model choice and token ceiling

`scanning.py` pins `claude-sonnet-4-5` and caps `max_tokens` at 2000.

The model is two generations behind current (`claude-opus-5`,
`claude-sonnet-5`, `claude-haiku-4-5`). Extraction accuracy directly determines
how much correction a human does per invoice, which makes this the highest
-leverage line in the file. The comment above it describes the string as an
alias that Anthropic rolls forward - these are distinct model IDs, not rolling
pointers.

2000 output tokens is roughly 40-60 line items. A longer delivery note
truncates, producing invalid JSON, which surfaces as "try a clearer photo" - an
error the photo cannot fix.

### 4. No throttle on a paid endpoint

Invoice upload is the first endpoint in this codebase that costs money per
call, and any staff account can call it in a loop. It needs its own
`ScopedRateThrottle` scope, and probably a per-restaurant monthly cap.

### 5. Who is allowed to scan

Invoice scanning sits in the staff namespace under `IsStaff`, which includes
admins by design. The original request was admin-only. Worth confirming which
is intended - it is a product decision, not a bug.

### 6. Accuracy and duplicate handling

- Supplier is a free-text `CharField`, so the same supplier spelled two ways is
  two suppliers and no per-supplier price history exists.
- Nothing detects the same invoice uploaded twice, which would double-count
  stock. An image hash, or a unique constraint on supplier plus invoice number,
  would catch it.
- Nothing reconciles line totals against a stated invoice total, so a misread
  quantity has no automatic tripwire.
- `raw_name` is matched to an `InventoryItem` by hand every time. An alias
  table would let past matches apply themselves, so accuracy compounds with
  use.

### 7. Edge cases not yet covered

**Image** - blur, glare, skew, HEIC from iOS, multi-page invoices, faded
thermal receipts.

**Document** - credit notes and negative lines, keg and crate deposits,
discounts, multiple UK VAT rates, missing invoice number, unit mismatches
(case vs kg vs each), non-GBP currency.

**System** - retry with backoff on a transient API failure, offline capture
queued on the device, concurrent edits to the same scan.

## Open decisions

1. **Object storage provider** - Cloudflare R2 (no egress fees) or AWS S3.
   Needed for gap 2, and it fixes fridge photos and profile pictures at the
   same time.
2. **Worker service** - roughly $7/month on Render for gap 1. The alternative
   is leaving extraction synchronous and accepting that concurrent uploads
   degrade the whole API.
3. **Admin-only or staff-wide** - gap 5.
