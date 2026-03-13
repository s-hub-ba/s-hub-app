/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

import Home from './pages/Home';
import AgencyDirectory from './pages/AgencyDirectory';
import AgencyProfile from './pages/AgencyProfile';
import Login from './pages/Login';
import Join from './pages/Join';
import JoinNanny from './pages/JoinNanny';
import JoinAgency from './pages/JoinAgency';
import JoinFamily from './pages/JoinFamily';
import ForNannies from './pages/ForNannies';
import ForAgencies from './pages/ForAgencies';

import NannyDashboard from './pages/nanny/Dashboard';
import NannyJobs from './pages/nanny/Jobs';
import NannyApplications from './pages/nanny/Applications';
import NannyProfile from './pages/nanny/Profile';
import NannyAvailability from './pages/nanny/Availability';
import NannyOnboarding from './pages/nanny/Onboarding';

import AgencyDashboard from './pages/agency/Dashboard';
import AgencyJobs from './pages/agency/Jobs';
import AgencyApplications from './pages/agency/Applications';
import PostJob from './pages/agency/PostJob';
import GlobalSearch from './pages/agency/Search';
import TalentPool from './pages/agency/TalentPool';
import Billing from './pages/agency/Billing';

import AdminDashboard from './pages/admin/Dashboard';
import AdminAgencies from './pages/admin/Agencies';
import AdminUsers from './pages/admin/Users';

import FamilyOnboarding from './pages/family/Onboarding';
import FamilyDashboard from './pages/family/Dashboard';
import JobDiscovery from './pages/family/JobDiscovery';
import JobDetails from './pages/family/JobDetails';
import FamilyApplications from './pages/family/Applications';
import SavedJobs from './pages/family/SavedJobs';
import FamilyMessages from './pages/family/Messages';
import FamilyProfile from './pages/family/Profile';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/agencies" element={<AgencyDirectory />} />
            <Route path="/agencies/:id" element={<AgencyProfile />} />
            <Route path="/for-nannies" element={<ForNannies />} />
            <Route path="/for-agencies" element={<ForAgencies />} />
          </Route>

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/nanny" element={<JoinNanny />} />
          <Route path="/join/agency" element={<JoinAgency />} />
          <Route path="/join/family" element={<JoinFamily />} />
          
          {/* Protected Family Routes */}
          <Route element={<ProtectedRoute allowedRoles={['family']} />}>
            <Route path="/family/onboarding" element={<FamilyOnboarding />} />
            <Route path="/family" element={<DashboardLayout role="family" />}>
              <Route path="dashboard" element={<FamilyDashboard />} />
              <Route path="jobs" element={<JobDiscovery />} />
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="applications" element={<FamilyApplications />} />
              <Route path="saved" element={<SavedJobs />} />
              <Route path="messages" element={<FamilyMessages />} />
              <Route path="profile" element={<FamilyProfile />} />
            </Route>
          </Route>

          {/* Protected Nanny Routes */}
          <Route element={<ProtectedRoute allowedRoles={['nanny']} />}>
            <Route path="/nanny/onboarding" element={<NannyOnboarding />} />
            <Route path="/nanny" element={<DashboardLayout role="nanny" />}>
              <Route path="dashboard" element={<NannyDashboard />} />
              <Route path="jobs" element={<NannyJobs />} />
              <Route path="applications" element={<NannyApplications />} />
              <Route path="availability" element={<NannyAvailability />} />
              <Route path="profile" element={<NannyProfile />} />
            </Route>
          </Route>

          {/* Protected Agency Routes */}
          <Route element={<ProtectedRoute allowedRoles={['agency_admin', 'agency_recruiter']} />}>
            <Route path="/agency" element={<DashboardLayout role="agency" />}>
              <Route path="dashboard" element={<AgencyDashboard />} />
              <Route path="jobs" element={<AgencyJobs />} />
              <Route path="jobs/new" element={<PostJob />} />
              <Route path="applications" element={<AgencyApplications />} />
              <Route path="search" element={<GlobalSearch />} />
              <Route path="talent" element={<TalentPool />} />
              <Route path="billing" element={<Billing />} />
            </Route>
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="agencies" element={<AdminAgencies />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
