ALTER TABLE public.medications 
  ADD COLUMN med_type text NOT NULL DEFAULT 'tablet',
  ADD COLUMN schedule text NOT NULL DEFAULT 'morning',
  ADD COLUMN food_timing text NOT NULL DEFAULT 'after',
  ADD COLUMN start_date text NULL,
  ADD COLUMN end_date text NULL;