-- Insert mock users into auth.users (Note: In a real Supabase instance, use the GoTrue API to create users so passwords are encrypted properly. This is just for structural demonstration).

-- Mock Agency
INSERT INTO public.users (id, email, role) VALUES 
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', 'admin@manhattanelite.com', 'agency_admin');

INSERT INTO public.profiles (id, first_name, last_name) VALUES 
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', 'Jane', 'Doe');

INSERT INTO public.agencies (id, company_name, website, subscription_tier, status) VALUES 
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', 'Manhattan Elite Nannies', 'https://manhattanelite.com', 'professional', 'active');

-- Mock Nanny
INSERT INTO public.users (id, email, role) VALUES 
('f0e9d8c7-b6a5-4321-0987-654321fedcba', 'sarah@example.com', 'nanny');

INSERT INTO public.profiles (id, first_name, last_name) VALUES 
('f0e9d8c7-b6a5-4321-0987-654321fedcba', 'Sarah', 'Jenkins');

INSERT INTO public.nannies (id, bio, experience_years, min_pay_hourly, max_pay_hourly, primary_borough, shift_score, status, certifications) VALUES 
('f0e9d8c7-b6a5-4321-0987-654321fedcba', 'Experienced newborn care specialist.', 8, 30.00, 45.00, 'Manhattan', 95, 'active', ARRAY['CPR', 'First Aid']);

-- Mock Family
INSERT INTO public.users (id, email, role) VALUES 
('f1111111-2222-3333-4444-555555555555', 'smithfamily@example.com', 'family');

INSERT INTO public.families (id, name, email, borough, neighborhood) VALUES 
('f1111111-2222-3333-4444-555555555555', 'The Smith Family', 'smithfamily@example.com', 'Manhattan', 'Upper East Side');

INSERT INTO public.family_profiles (family_id, children_count, children_ages, schedule, care_type) VALUES 
('f1111111-2222-3333-4444-555555555555', 2, ARRAY['2', '5'], 'Monday - Friday, 9am - 5pm', 'Full-time');

-- Mock Job
INSERT INTO public.jobs (id, agency_id, title, description, job_type, pay_rate_min, pay_rate_max, location_borough, status) VALUES 
('11111111-2222-3333-4444-555555555555', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 'Full-Time Nanny for UES Family', 'Looking for an experienced nanny for a 6-month-old.', 'full_time', 35.00, 40.00, 'Manhattan', 'open');

-- Mock Application
INSERT INTO public.applications (job_id, nanny_id, status) VALUES 
('11111111-2222-3333-4444-555555555555', 'f0e9d8c7-b6a5-4321-0987-654321fedcba', 'reviewing');
