-- Tasks remember the meeting whose minutes they came from (added in place)
ALTER TABLE "Task" ADD COLUMN "meetingId" INTEGER REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_meetingId_idx" ON "Task"("meetingId");
