/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
import NannyDevelopment from './pages/nanny/Development';
import NannyProfile from './pages/nanny/Profile';
import NannyCalendar from './pages/nanny/Calendar';
import NannyOnboarding from './pages/nanny/Onboarding';

import AgencyDashboard from './pages/agency/Dashboard';
import AgencyJobs from './pages/agency/Jobs';
import AgencyApplications from './pages/agency/Applications';
import PostJob from './pages/agency/PostJob';
import GlobalSearch from './pages/agency/Search';
import TalentPool from './pages/agency/TalentPool';
import Billing from './pages/agency/Billing';
import Subscription from './pages/agency/Subscription';
import AgencyCalendar from './pages/agency/Calendar';

import AgencyMessages from './pages/agency/Messages';
import NannyMessages from './pages/nanny/Messages';
import AgencyProfilePage from './pages/agency/Profile';

import AdminDashboard from './pages/admin/Dashboard';
import AdminAgencies from './pages/admin/Agencies';
import AdminBgAudit from './pages/admin/BgAudit';
import AdminUsers from './pages/admin/Users';
import AdminVerification from './pages/admin/Verification';

import FamilyDashboard from './pages/family/Dashboard';
import FamilyOnboarding from './pages/family/Onboarding';
import JobDiscovery from './pages/family/JobDiscovery';
import JobDetails from './pages/family/JobDetails';
import SavedJobs from './pages/family/SavedJobs';
import FamilyMessages from './pages/family/Messages';
import FamilyPlacements from './pages/family/Placements';
import FamilyProfile from './pages/family/Profile';
import FamilyRequestForm from './pages/family/RequestForm';
import FamilyRequestResults from './pages/family/RequestResults';
import FamilyCalendar from './pages/family/Calendar';
import Notifications from './pages/Notifications';
import AgencyFamilyRequests from './pages/agency/FamilyRequests';
import AgencyFamilyRequestDetail from './pages/agency/FamilyRequestDetail';
import AgencyRequestSettings from './pages/agency/RequestSettings';

export default function App() {
  const Router = import.meta.env.VITE_USE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
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
            <Route path="/family" element={<DashboardLayout role="family" />}>
              <Route path="dashboard" element={<FamilyDashboard />} />
              <Route path="jobs" element={<JobDiscovery />} />
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="agencies" element={<AgencyDirectory />} />
              <Route path="agencies/:id" element={<AgencyProfile />} />
              <Route path="request-care" element={<FamilyRequestForm />} />
              <Route path="requests/:id" element={<FamilyRequestResults />} />
              <Route path="onboarding" element={<FamilyOnboarding />} />

              <Route path="saved" element={<SavedJobs />} />
              <Route path="placements" element={<FamilyPlacements />} />
              <Route path="calendar" element={<FamilyCalendar />} />
              <Route path="messages" element={<FamilyMessages />} />
              <Route path="notifications" element={<Notifications />} />
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
              <Route path="development" element={<NannyDevelopment />} />
              <Route path="messages" element={<NannyMessages />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="availability" element={<Navigate to="/nanny/calendar" replace />} />
              <Route path="calendar" element={<NannyCalendar />} />
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
              <Route path="messages" element={<AgencyMessages />} />
              <Route path="family-requests" element={<AgencyFamilyRequests />} />
              <Route path="family-requests/:assignmentId" element={<AgencyFamilyRequestDetail />} />
              <Route path="request-settings" element={<AgencyRequestSettings />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="search" element={<GlobalSearch />} />
              <Route path="talent" element={<TalentPool />} />
              <Route path="calendar" element={<AgencyCalendar />} />
              <Route path="billing" element={<Billing />} />
              <Route path="subscription" element={<Subscription />} />
              <Route path="profile" element={<AgencyProfilePage />} />
            </Route>
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="agencies" element={<AdminAgencies />} />
              <Route path="bg-audit" element={<AdminBgAudit />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="verification" element={<AdminVerification />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
