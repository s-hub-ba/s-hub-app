-- 1. Update Users Role Check Constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('nanny', 'agency_admin', 'agency_recruiter', 'superadmin', 'family'));

-- 2. Families Table
CREATE TABLE public.families (
    id UUID REFERENCES public.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    location_borough TEXT NOT NULL,
    location_neighborhood TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FamilyProfiles Table
CREATE TABLE public.family_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES public.families(id) NOT NULL UNIQUE,
    children_count INTEGER NOT NULL,
    children_ages TEXT[] NOT NULL,
    schedule TEXT NOT NULL,
    care_type TEXT NOT NULL,
    live_in BOOLEAN DEFAULT FALSE,
    start_date DATE,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- 4. SavedJobs Table
CREATE TABLE public.saved_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES public.families(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, job_id)
);

-- 5. FamilyApplications Table
CREATE TABLE public.family_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES public.families(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id) NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'interviewing', 'hired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, job_id)
);

-- 6. Conversations Table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES public.families(id) NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, agency_id)
);

-- 7. Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('family', 'agency')),
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
