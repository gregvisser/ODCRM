-- Add suppressed status for compliance enforcement
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'suppressed';
