-- Migration: Add analytics column to scans table
-- Run this against your Neon database

ALTER TABLE scans ADD COLUMN IF NOT EXISTS analytics JSONB;
