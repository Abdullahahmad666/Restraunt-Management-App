# Invoice scanning

Staff photograph a supplier invoice, or pick a PDF the supplier emailed. A
vision model reads the line items off it. A person reviews and confirms, and
only then does any of it touch stock or appear in a spend figure.

This document is the reasoning behind that, and what it still needs. It was
written as a build plan before the feature existed and has been rewritten
twice against the code since - if it disagrees with `apps/inventory`, the code
is right and this is stale.

## The shape

```
phone ──1── ask for somewhere to upload
      ◄─2── a row, and a pre-signed URL
      ──3── the file, straight to S3 (never through the API)
      ──4── "it landed"
                │
                ▼ the API checks it really did, then queues the read
           background worker
                │
                ▼ vision model -> line items, supplier matched, products matched
           PENDING review
                │
                ▼ a person corrects, matches what is new, confirms
           stock moves, aliases are learned, spend becomes visible
```

Step 4 is not bookkeeping. S3 never tells us an upload finished, so without it
an invoice would sit forever holding a file nobody reads. It verifies rather
than trusts, which is what stops a caller queueing paid reads of files that
were never uploaded.

The multipart endpoint still exists and is the only path in development, where
there is no bucket to sign against.

## Decisions worth knowing

**A scan is a proposal, never a fact.** Nothing reaches stock or a spend figure
until a person confirms it. A misread quantity is an annoyance to fix in
review; the same misread applied silently to stock and cost is a real problem.

**Reading happens on a worker.** It waits on a vision model for seconds at a
time. In the request that occupied one of gunicorn's three workers, so a few
simultaneous uploads stalled the whole API - the same failure already fixed
once for email in `a44f7f7`.

**`scan_state` is separate from `status`.** One is how far the read has got,
the other is the human review lifecycle. An invoice can be waiting to be read
and waiting to be reviewed at once, and one field cannot say that.

**Failures are split by whether retrying helps.** Rate limits and outages go
back on the queue with backoff. An unreadable photo or a rejected request is
recorded on the invoice and the job finishes - burning three attempts on the
same bad photo helps nobody. When the queue does give up, it says so, or the
invoice would read "scanning" forever and the app would poll for an answer
nobody was still trying to produce.

**A scan matches suppliers and products; it never invents them.** One invented
from a misread line - "Fresh Foods Lfd" - is a permanent row in every later
filter, splits that supplier's history in two, and needs a human to notice and
merge it. Anything unrecognised is a question for the reviewer.

**Confirming teaches.** How each line was matched is remembered, so the next
delivery saying the same thing arrives already matched. Learned on
confirmation rather than mid-review, because a half-finished review is full of
matches somebody is still correcting.

**A PDF is sent as a document, not a picture of one.** The API reads PDFs
natively; rasterising one first throws away the crisp text that makes it the
easiest of the three cases.

**Compression has profiles, not a setting.** An avatar is never looked at
closely; an invoice is read digit by digit. 1568px is the invoice cap because
the reader downsamples anything larger - past that we pay to deliver detail
that is discarded before it is read.

## Data model - `apps/inventory`

| Model | Owns |
| --- | --- |
| `InventoryItem` | Name, unit, `quantity_on_hand`, optional par level and cost |
| `StockMovement` | The ledger - delivery, waste, correction, with a link back to the invoice line that caused it |
| `InvoiceScan` | The file, its type, review status, scan state, supplier, warehouse, uploader |
| `InvoiceLineItem` | What was read, what it was matched to, quantity, unit, prices |
| `Supplier` | Who it came from, matched on a normalized name |
| `Warehouse` | Where it went |
| `ItemAlias` | What one supplier calls one of our items |

`apps/jobs` holds the queue this runs on: one table claimed with
`SELECT FOR UPDATE SKIP LOCKED`, drained by `manage.py run_jobs`. No broker and
no Redis - Postgres is already here and already durable.

Warehouse is on the invoice rather than on `InventoryItem`. Putting it there
would mean one item per location and a running count for each, which is a
stock-transfer model and a far larger change than "what did we spend on the
cellar".

## Purchase history

Three admin reads over one filtered set - per product, per week or month, and
in total - sharing a single base queryset so a chart cannot disagree with the
table beneath it.

```
GET /api/v1/admin/purchases/           per product: quantity, spend, last bought
GET /api/v1/admin/purchases/timeline/  ?period=week|month
GET /api/v1/admin/purchases/summary/   cumulative
```

All take `supplier`, `warehouse`, `item`, `date_from`, `date_to`.

Only confirmed invoices count. A line's spend is its stated total when there is
one and quantity x unit price otherwise. Lines where neither is legible, and
lines nobody has matched, are **counted and reported** rather than quietly
dropped - a total missing three lines is worse than one that says so, and the
app shows both counts.

## What it still needs

**No throttle on a paid endpoint.** Uploading is the only endpoint in this
codebase that costs money per call, and any staff account can call it in a
loop. It wants its own `ScopedRateThrottle` scope and probably a per-restaurant
monthly cap.

**Nothing detects the same invoice uploaded twice**, which would double-count
stock. An image hash, or a unique constraint on supplier plus invoice number,
would catch it.

**Nothing reconciles against a stated total.** The extraction does not even ask
for the invoice's own total, so there is no tripwire when a misread quantity
makes the lines add up to the wrong number.

**Edge cases not yet handled:** multi-page invoices beyond what one request
carries, credit notes and negative lines, keg and crate deposits, multiple UK
VAT rates, offline capture queued on the device, concurrent edits to one
invoice.

## Running it

Needs, beyond the usual:

- `ANTHROPIC_API_KEY` - without it uploads still save and scanning fails with a
  friendly error rather than a raw auth failure.
- `AWS_STORAGE_BUCKET_NAME` and credentials. **Production refuses to boot
  without a bucket** - failing at startup is loud, while the alternative
  surfaces weeks later as a gallery of broken images nobody can get back.
- Bucket CORS allowing `POST`, or direct upload fails in the client with no
  server-side trace.
- A lifecycle rule expiring `invoice_scans/` objects abandoned mid-upload.
  `delete_object` is best-effort tidying; the rule is the guarantee.
- The worker service from `render.yaml`. It sets `RUN_MIGRATIONS=0` - only one
  service may migrate, or two containers booting together race to apply the
  same ones.
