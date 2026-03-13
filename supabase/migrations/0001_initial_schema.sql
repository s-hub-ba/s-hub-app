-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Extends Supabase Auth)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('nanny', 'agency_admin', 'agency_recruiter', 'superadmin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table (Shared info)
CREATE TABLE public.profiles (
    id UUID REFERENCES public.users(id) PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Nannies Table
CREATE TABLE public.nannies (
    id UUID REFERENCES public.users(id) PRIMARY KEY,
    bio TEXT,
    experience_years INTEGER DEFAULT 0,
    min_pay_hourly DECIMAL(10,2),
    max_pay_hourly DECIMAL(10,2),
    primary_borough TEXT,
    shift_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'suspended')),
    certifications TEXT[] DEFAULT '{}'
);

-- 4. Agencies Table
CREATE TABLE public.agencies (
    id UUID REFERENCES public.users(id) PRIMARY KEY,
    company_name TEXT NOT NULL,
    website TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
    paypal_subscription_id TEXT,
    status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'suspended'))
);

-- 5. Jobs Table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES public.agencies(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('full_time', 'part_time', 'temporary', 'live_in')),
    pay_rate_min DECIMAL(10,2),
    pay_rate_max DECIMAL(10,2),
    location_borough TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Applications Table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) NOT NULL,
    nanny_id UUID REFERENCES public.nannies(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'interviewing', 'hired', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, nanny_id)
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nannies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Example Policy: Nannies can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Example Policy: Anyone can view open jobs
CREATE POLICY "Anyone can view open jobs" ON public.jobs
    FOR SELECT USING (status = 'open');
