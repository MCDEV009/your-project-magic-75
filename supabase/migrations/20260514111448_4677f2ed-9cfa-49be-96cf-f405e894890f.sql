
-- 1. Add new roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'analyst';

-- 2. Add 'paid' visibility
ALTER TYPE test_visibility ADD VALUE IF NOT EXISTS 'paid';
