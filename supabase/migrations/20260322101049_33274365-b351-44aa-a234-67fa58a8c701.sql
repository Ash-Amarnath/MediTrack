
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS date_of_birth text DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS aadhaar_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS organ_donor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS jehovah_witness boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergies jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chronic_conditions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS past_surgeries jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vaccinations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS family_history jsonb DEFAULT '[]'::jsonb;
