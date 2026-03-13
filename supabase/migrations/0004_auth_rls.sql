-- Allow users to insert their own record upon signup
CREATE POLICY "Users can insert their own record" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own record
CREATE POLICY "Users can update their own record" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Allow users to read their own record
CREATE POLICY "Users can read their own record" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Allow families to insert their own profile
CREATE POLICY "Families can insert their own profile" ON public.families
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow families to update their own profile
CREATE POLICY "Families can update their own profile" ON public.families
    FOR UPDATE USING (auth.uid() = id);

-- Allow families to read their own profile
CREATE POLICY "Families can read their own profile" ON public.families
    FOR SELECT USING (auth.uid() = id);
