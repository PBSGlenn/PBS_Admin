-- Add missing indexes for fields used in filtering queries

-- Event.processingState is used for workflow filtering
CREATE INDEX "Event_processingState_idx" ON "Event"("processingState");

-- Task.automatedAction is used by the automation engine
CREATE INDEX "Task_automatedAction_idx" ON "Task"("automatedAction");
