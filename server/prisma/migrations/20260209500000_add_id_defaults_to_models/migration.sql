-- Add @default(cuid()) to all models with id String @id without defaults
-- This is a schema-only change that affects only new inserts, not existing data

-- Note: No SQL changes needed as this only adds default values for future inserts
-- Existing rows are unaffected