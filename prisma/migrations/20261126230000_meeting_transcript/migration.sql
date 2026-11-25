-- Meetings keep their transcript and a link to the recording
ALTER TABLE "Meeting" ADD COLUMN "transcript" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "recordingUrl" TEXT;
