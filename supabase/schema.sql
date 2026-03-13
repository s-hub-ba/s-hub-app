-- Shift Me Up MVP Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE user_role AS ENUM ('nanny', 'agency_admin', 'agency_recruiter', 'admin');
CREATE TYPE job_status AS ENUM ('draft', 'published', 'filled', 'closed');
CREATE TYPE application_status AS ENUM ('applied', 'reviewing', 'interview_invited', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE talent_pool_status AS ENUM ('saved', 'interviewed', 'top_candidate', 'previously_placed', 'do_not_contact', 'invited', 'unclaimed');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'pro');

-- 1. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. NANNY PROFILES
CREATE TABLE nanny_profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    bio TEXT,
    years_experience INTEGER DEFAULT 0,
    expected_pay_min DECIMAL(10, 2),
    expected_pay_max DECIMAL(10, 2),
    profile_photo_url TEXT,
    location_borough VARCHAR(100),
    location_neighborhood VARCHAR(100),
    availability_status VARCHAR(50) DEFAULT 'seeking',
    shift_score INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AGENCY PROFILES
CREATE TABLE agency_profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    city VARCHAR(100),
    country VARCHAR(100),
    website TEXT,
    logo_url TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    subscription_plan subscription_plan DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    paypal_subscription_id VARCHAR(255),
    recruiter_seats INTEGER DEFAULT 1,
    flex_months_remaining INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. JOBS
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agency_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location_borough VARCHAR(100) NOT NULL,
    location_neighborhood VARCHAR(100),
    private_job_address TEXT,
    job_type VARCHAR(50) NOT NULL,
    work_type VARCHAR(50) NOT NULL,
    pay_min DECIMAL(10, 2),
    pay_max DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    schedule_summary TEXT,
    start_date DATE,
    end_date DATE,
    required_experience_years INTEGER DEFAULT 0,
    status job_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. APPLICATIONS
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    nanny_id UUID REFERENCES nanny_profiles(id) ON DELETE CASCADE,
    status application_status DEFAULT 'applied',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(job_id, nanny_id)
);

-- 6. TALENT POOL
CREATE TABLE talent_pool_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agency_profiles(id) ON DELETE CASCADE,
    nanny_id UUID REFERENCES nanny_profiles(id) ON DELETE CASCADE,
    status talent_pool_status DEFAULT 'saved',
    latest_note_snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agency_id, nanny_id)
);

-- 7. INTERVIEW NOTES
CREATE TABLE interview_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agency_profiles(id) ON DELETE CASCADE,
    nanny_id UUID REFERENCES nanny_profiles(id) ON DELETE CASCADE,
    interview_date DATE,
    communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
    professionalism_score INTEGER CHECK (professionalism_score BETWEEN 1 AND 5),
    reliability_score INTEGER CHECK (reliability_score BETWEEN 1 AND 5),
    fit_score INTEGER CHECK (fit_score BETWEEN 1 AND 5),
    recommendation_level VARCHAR(50),
    note_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. COMPLETED SHIFTS & REVIEWS
CREATE TABLE completed_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    nanny_id UUID REFERENCES nanny_profiles(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agency_profiles(id) ON DELETE SET NULL,
    shift_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES completed_shifts(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    punctuality INTEGER CHECK (punctuality BETWEEN 1 AND 5),
    communication INTEGER CHECK (communication BETWEEN 1 AND 5),
    professionalism INTEGER CHECK (professionalism BETWEEN 1 AND 5),
    child_engagement INTEGER CHECK (child_engagement BETWEEN 1 AND 5),
    written_review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PARENT INQUIRIES
CREATE TABLE parent_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agency_profiles(id) ON DELETE CASCADE,
    parent_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location_borough VARCHAR(100),
    childcare_need_summary TEXT,
    start_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Example)
ALTER TABLE nanny_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON nanny_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON nanny_profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public agency profiles are viewable by everyone." ON agency_profiles FOR SELECT USING (true);
CREATE POLICY "Agencies can update own profile." ON agency_profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published jobs are viewable by everyone." ON jobs FOR SELECT USING (status = 'published');
CREATE POLICY "Agencies can manage own jobs." ON jobs FOR ALL USING (auth.uid() = agency_id);

-- Note: In a real Supabase setup, you would link auth.users to public.users via triggers.
