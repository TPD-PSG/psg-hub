---
title: TWS quotes
summary: Quoting builds in the TWS space, drafting a quote from a build's plan, and the Sales Quote PDF
section: The Workshop Stoke
order: 3
paths: /spaces/*/quotes
---
## Who can quote

**Quotes** lists the space's quotes with status, price ex VAT and margin. Filter with **Open**, **Accepted**, **Declined** or **All**. Quoting needs Business Dev access, which an admin sets in Admin → Users.

## Starting a quote

1. Click **+ New quote**.
2. Fill in **What's it for?** and the **Client**.
3. Under **For build**, pick the build, or leave **Not yet a build**.
4. Under **Start from**, choose a blank quote or a template, then click **Start quote**.

For the editor itself, see [Quotes](/help/quotes).

## Quote this build

If you can see money, the **Quote vs actual** card on a build's page drafts a quote from the build's own plan.

1. Choose **Lines**: **By part** (a section per part) or **Labour / Materials**.
2. Set **Markup %**.
3. Click **Quote this build**, or **New quote from plan** if the build already has a quote.

Labour is costed from each part's hours or days, at the person's day rate, else the labour type's rate, else the standard workshop day rate. Materials come from the parts' estimates at cost, or, if there are none, the build's purchase orders and booked-out stock. Prices are cost plus your markup. If anything was costed at £0, a message says what to check. Admins set the standard day rate with **Change** on the Quotes page.

## A quote's items are the build's parts

On a quote linked to a build, each section is one of the build's parts. When you save the quote:

- a new section adds a part, and renaming a section renames its part
- labour lines set the part's hours, and lines naming a discipline set its stages on the [Workshop calendar](/help/workshop-calendar)
- material lines become the part's estimated materials

Until the quote is accepted, these parts are pencilled in. When it is accepted, the build moves from Quote to Confirmation, the pencilled dates become firm and the quote is locked. Removing a section only removes its part if nobody has dated, staffed, finished or ordered for it.

## The Sales Quote PDF

TWS quotes print in TWS branding as a Sales Quote:

- a letterhead with the TWS logo, address and phone, and the number and title on the right
- **Client** and **Ship To** boxes, then boxes for Sales Person, Customer PO, Terms, Sales Tax, Date, Due Date, Shipping Method and Valid Until
- lines grouped by section, with a total under each
- subtotal, VAT and total, then terms, with page numbers at the foot

In the editor you can choose **One price per item** or **Full breakdown** for the PDF. Our costs and margin never appear on it.
