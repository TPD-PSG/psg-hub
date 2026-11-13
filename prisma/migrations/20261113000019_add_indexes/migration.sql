-- Task indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Task_productionId_idx" ON "Task"("productionId");
CREATE INDEX IF NOT EXISTS "Task_assigneeUserId_idx" ON "Task"("assigneeUserId");
CREATE INDEX IF NOT EXISTS "Task_createdByUserId_idx" ON "Task"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");

-- ProductionContact index
CREATE INDEX IF NOT EXISTS "ProductionContact_productionId_idx" ON "ProductionContact"("productionId");

-- StaffAssignment indexes
CREATE INDEX IF NOT EXISTS "StaffAssignment_productionId_idx" ON "StaffAssignment"("productionId");
CREATE INDEX IF NOT EXISTS "StaffAssignment_userId_idx" ON "StaffAssignment"("userId");
