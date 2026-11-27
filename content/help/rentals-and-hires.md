---
title: Rentals & Crew: kit, hires and availability
summary: Rental kit with a barcode on every unit, packages, hires and their prices, quote PDFs, invoicing and availability
section: Rentals & Crew
order: 1
paths: /spaces/*/kit, /spaces/*/hires, /spaces/*/availability, /spaces/*/packages, /spaces/*/warehouse
---
## What this space is for

The **Rentals & Crew** space is where PSG's rental kit and hires live, as the Hub takes over from Flex. It is for PSG staff. Freelancers don't see the kit, hires or prices.

The space's menu has:

- **Home**: what goes out this week, what's out now, open quotes and kit in repair.
- **Hires**: every quote and hire.
- **Availability**: how many of each product are free, day by day.
- **Warehouse**: prep hires by scanning their kit out, and check it back in.
- **Kit**: every product and every unit.
- **Packages**: ready-made groups of kit.

An admin makes a company's space a rentals space in **Admin → Settings**, under **Entities and revenue targets**: click **Space** on the company's row and choose **Rentals & Crew** under **Kind of space** (see [Hub settings](/help/hub-settings)).

## Kit: products and units

A **product** is a kind of thing you hire out, such as a Robe MegaPointe or a 16A 10m cable. A **unit** is one physical item. **Every unit has its own barcode, cables included**, so the Hub always knows exactly which item went where.

Click **+ Add product** and fill in:

- **Name**, **category** (Lighting, Sound, Cable and so on, or your own), make and model.
- **Day rate** and **week rate** (ex VAT), **replacement cost**, **weight** and **power**.
- **Units**: either say **how many**, and each one gets a new barcode (for example RC000001), or type or scan in **the barcodes already on the stickers**, one per line. Use the second way for kit that already has Flex barcodes.

Click a product to see its units. For each unit you can set:

- **Status**: Available, In repair, Lost or Retired. Only available units count towards what can go out.
- **Serial** number and **shelf**.
- **Case**: the barcode of the case it's packed in.

To add more units later, use **Add units** at the bottom of the product. Delete a unit only if it was added by mistake. For real kit that's gone, mark it **Lost** or **Retired** so its history stays.

## Cases

Tick **This is a case or rack** on a product (for example "MegaPointe 2-way case"). Its units can then hold other units: type the case's barcode into a unit's **Case** box. A case lists what's packed in it. A case can't be packed inside itself, or inside something packed in it.

## Finding a unit by its barcode

The search box on **Kit** finds products by name. It also takes a barcode: scan it with a handheld scanner (which types the code and presses Enter), or type it and press **Find**. The unit's product opens with that unit highlighted. If a unit is out on a hire, Kit says which one.

## Packages

A package is a group of products you often send out together, such as "Small PA": 4 tops, a desk and 10 cables. Make one on **Packages** with **+ New package**. On a hire, **+ Add a package…** adds all its products as lines, which you can then change for that hire. Changing or deleting a package never changes hires it was already added to.

## Hires

Click **+ New hire** and fill in its name, the client, when the kit **goes out** and when it **comes back**, and (if it's for one of our shows) the production. Add kit with **+ Add a product…** or **+ Add a package…**.

A hire moves through these steps:

1. **Quote (pencilled).** A new hire starts here. It shows on Availability with a dot but **holds no kit**.
2. **Confirmed.** Click **Confirm hire**. The kit is now held for every day from going out to coming back, including both of those days.
3. **Out**, then **Returned**.

You can **cancel** a confirmed hire, which frees its kit. Only quotes and cancelled hires can be deleted; anything that went out stays on record. A returned or cancelled hire can be reopened as a quote.

While you edit a hire, each line shows **how many are free** over its dates, counting every other confirmed hire. If there aren't enough, the line shows **Short**. Confirming a hire that's short stops and tells you what's free; you can **Confirm anyway** if you'll sub-hire the rest. Changing the dates or kit of a confirmed hire is checked the same way.

## Sub-hires

When we're short, hire the rest in from another company. On a saved hire, click **Sub-hire what's short** in the warning (this adds one sub-hire for each short product), or **+ Add a sub-hire** and choose the product, how many, who from and what it costs us.

- A sub-hire covers that much of the hire, so the hire stops being short and confirms normally. It also stops holding that much of our own kit on Availability.
- Move each sub-hire along as it happens: **Needed**, **Ordered**, **Received**, **Sent back**. The Warehouse list shows hires whose sub-hires haven't arrived yet.
- Sub-hired kit isn't on the warehouse pick list: only what comes from our shelves is scanned.

## Prices

Each kit line costs its **day rate** for every **day charged**. If the product has a **week rate**, each full week costs the week rate, and the days left over cost their day rates but never more than another week. For example, at £85 a day and £255 a week, 9 days cost £255 + £170 = £425.

- **Days charged** starts as every day the kit is away. Type a smaller number to charge fewer days, for example 1 day for a weekend hire.
- **£ each** on a line: type your own price per unit for the whole hire, instead of the rates.
- **% off** on a line takes a discount off that line.
- **Hire discount %** comes off all the kit (not other charges).
- **Other charges**: anything that isn't kit, such as delivery and collection, a technician's day or damage. Charges can still be added after a hire comes back.
- **VAT %** is 20 unless you change it.

The totals under the lines update as you type: kit, discounts, other charges, subtotal, VAT and total. Each hire's value (before VAT) also shows in the hire list.

## The quote and confirmation PDF

Open **On the quote** to fill in the payment terms, the client's PO number, whether they collect or we deliver (and where to), and the terms printed on the PDF. **Notes** are just for us and never go on the PDF.

Once a hire is saved:

- **Preview PDF** shows it on screen. **Download quote PDF** saves it. Each one saves the hire first.
- While it's a quote, the PDF is a **Hire Quote** with its **Valid until** date. Once confirmed it's a **Hire Confirmation**.
- It's in the company's letterhead, like the workshop's sales quotes. The kit is grouped by category with a total for each, then transport and other charges. The dates out and back and the days charged are under the totals.
- **Mark quote as sent** records when it went to the client.

## Invoicing

On a confirmed, out or returned hire, click **Raise invoice**. This puts a **draft sales invoice** in **Finance** for the hire's total, with the hire number as its reference. It's due on the payment terms: "30 days" (or any number of days) after today, "In advance" by the day the kit goes out, otherwise 30 days.

If the hire changes while the invoice is still a draft, click **Update the draft invoice** to bring it into line. Once the invoice has been sent or paid, the hire leaves it alone; change it in Finance if you need to. A hire with an invoice can't be deleted.

## Warehouse: prepping and scanning out

**Warehouse** lists the hires **to prep** (confirmed, going out in the next two weeks) and the hires **out now**. Click one to open it.

Scan with any of these:

- **A handheld scanner**: it types the barcode into the box and presses Enter. The box stays ready for the next scan.
- **The phone's camera**: click **Scan with the camera** and hold the barcode inside the box. The first time, your phone asks to let the Hub use the camera.
- **Typing** the barcode and pressing **Out**.

In **Prep: scan out**:

- The **pick list** shows each product, how many are needed from our kit, how many are scanned, and which **shelves** to find the rest on.
- Each scan is checked. A unit that isn't on the hire, is in repair or lost, is still out on another hire, or is one more than needed is refused, with a red message saying why.
- **Scanning a case scans everything packed in it.** Cases ride along without being on the hire.
- The first scan marks the hire **Out**.
- **Take off** removes a unit scanned by mistake.

## Checking kit back in

Open a hire from **Out now** and choose **Check in**, then scan each unit as it comes off the truck. Scanning a case checks in what's packed in it. If a unit was out on a different hire, it's checked in on that one and the message says so. To check something in without finding its hire first, use **Check something in** at the top of Warehouse.

- **Damaged…**: say what's wrong. The unit goes **into repair** on Kit, so it can't go out until it's fixed. Add a charge if the client is paying for it; it's added to the hire's other charges. Damage found later can be reported from **Back in** with **Found damage…**.
- **Missing…**: the unit is marked **lost**, with a charge if you like (it starts at the replacement cost). If it turns up, click **Turned up OK** to put it back in service.
- **Mark the rest missing** marks everything still out as missing in one go.

When every unit is back (or marked missing), the hire is marked **Returned** automatically. A hire can't be marked returned or cancelled while units are still out.

## Availability

**Availability** shows each product against the next two weeks (or four): the number in each box is **how many are free that day**.

- Pale shading: some are on hire.
- Amber: none left.
- Red: short, because more is booked than you have.
- A dot (•): some are also pencilled on a quote.

Use **Earlier**, **Today** and **Later** to move through the dates, or pick a start date. Tick **Only kit that's booked** to hide everything that's sitting on the shelf. Click a product to open it on Kit; the list underneath links to each hire in the dates.
