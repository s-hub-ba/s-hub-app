-- 1. Extend Agencies Table
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Agency Recruiters (Seat Management)
CREATE TABLE IF NOT EXISTS public.agency_recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES public.agencies(id) NOT NULL,
    user_id UUID REFERENCES public.users(id) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agency_id, user_id)
);

-- 3. Subscriptions (Billing System)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES public.agencies(id) UNIQUE NOT NULL,
    base_price DECIMAL(10,2) DEFAULT 29.00,
    seat_price DECIMAL(10,2) DEFAULT 5.00,
    recruiter_count INTEGER DEFAULT 1,
    total_price DECIMAL(10,2) DEFAULT 29.00,
    billing_cycle TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Extend Nannies Table (Invite System & Premium)
ALTER TABLE public.nannies ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id);
ALTER TABLE public.nannies ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- 5. Invite Links (Nanny Onboarding)
CREATE TABLE IF NOT EXISTS public.invite_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES public.agencies(id) NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.agency_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- Agency owners and recruiters can view their own agency's recruiters
CREATE POLICY "Agency can view own recruiters" ON public.agency_recruiters
    FOR SELECT USING (
        agency_id IN (
            SELECT id FROM public.agencies WHERE id = auth.uid()
            UNION
            SELECT agency_id FROM public.agency_recruiters WHERE user_id = auth.uid()
        )
    );

-- Agency owners can view their subscription
CREATE POLICY "Agency can view own subscription" ON public.subscriptions
    FOR SELECT USING (agency_id = auth.uid());

-- Anyone can view invite links to resolve them
CREATE POLICY "Anyone can view invite links" ON public.invite_links
    FOR SELECT USING (true);
