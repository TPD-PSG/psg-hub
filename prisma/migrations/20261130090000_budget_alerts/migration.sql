-- Overspend alerts: the level each budget line, and each show's whole budget, last alerted at
ALTER TABLE "BudgetLine" ADD COLUMN "alertLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Production" ADD COLUMN "budgetAlertLevel" INTEGER NOT NULL DEFAULT 0;

-- Lines and shows already over (or nearly spent) start at that level, so the first save after this
-- goes live doesn't send alerts for old overspends. Net Cost = committed spend + actual haulage.
UPDATE "BudgetLine" SET "alertLevel" = (
  SELECT CASE WHEN n.net <= 0 THEN 0 WHEN n.net > "BudgetLine"."budgeted" + 0.005 THEN 100
              WHEN "BudgetLine"."budgeted" > 0 AND n.net >= "BudgetLine"."budgeted" * 0.9 THEN 90 ELSE 0 END
  FROM (SELECT COALESCE((SELECT SUM("committed") FROM "Expense" e WHERE e."budgetLineId" = "BudgetLine"."id"), 0)
             + COALESCE((SELECT SUM("actualCost") FROM "HaulageMovement" h WHERE h."budgetLineId" = "BudgetLine"."id"), 0) AS net) n
);
UPDATE "Production" SET "budgetAlertLevel" = (
  SELECT CASE WHEN t.net <= 0 THEN 0 WHEN t.net > t.alloc + 0.005 THEN 100 WHEN t.alloc > 0 AND t.net >= t.alloc * 0.9 THEN 90 ELSE 0 END
  FROM (SELECT
    COALESCE((SELECT SUM("budgeted") FROM "BudgetLine" b WHERE b."productionId" = "Production"."id"), 0) AS alloc,
    COALESCE((SELECT SUM(e."committed") FROM "Expense" e JOIN "BudgetLine" b ON b."id" = e."budgetLineId" WHERE b."productionId" = "Production"."id"), 0)
    + COALESCE((SELECT SUM("actualCost") FROM "HaulageMovement" h WHERE h."productionId" = "Production"."id"), 0)
    + COALESCE((SELECT SUM("contraActual") FROM "TourStop" s WHERE s."productionId" = "Production"."id"), 0) AS net) t
);
