import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { safeInternalPath } from '@/lib/authNavigation'

import AppLayout from '@/components/layout/AppLayout'

import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import AuthCallbackPage from '@/pages/auth/AuthCallbackPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import OAuthConsentPage from '@/pages/auth/OAuthConsentPage'
import OAuthVsCodeCallbackPage from '@/pages/auth/OAuthVsCodeCallbackPage'

import TeamDashboardPage from '@/pages/dashboard/TeamDashboardPage'
import MemberDashboardPage from '@/pages/dashboard/MemberDashboardPage'

import CreateTeamPage from '@/pages/onboarding/CreateTeamPage'
import JoinTeamPage from '@/pages/onboarding/JoinTeamPage'

import TeamOverviewPage from '@/pages/team/TeamOverviewPage'
import TeamDetailPage from '@/pages/team/TeamDetailPage'
import TeamFindingsPage from '@/pages/team/TeamFindingsPage'
import TeamComponentDashboardPage from '@/pages/team/TeamComponentDashboardPage'
import TeamPoliciesPage from '@/pages/team/TeamPoliciesPage'
import TeamCommunicationPage from '@/pages/team/TeamCommunicationPage'

import TeamSettingsPage from '@/pages/settings/TeamSettingsPage'

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-400">Loading FLUSEC...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (user) {
    const params = new URLSearchParams(location.search)
    return <Navigate to={safeInternalPath(params.get('returnTo'))} replace />
  }

  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

        {/* Supabase Auth callbacks must be reachable whether or not a session already exists. */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/oauth/vscode/callback" element={<OAuthVsCodeCallbackPage />} />

        <Route
          path="/reset-password"
          element={<ProtectedRoute><ResetPasswordPage /></ProtectedRoute>}
        />
        <Route
          path="/oauth/consent"
          element={<ProtectedRoute><OAuthConsentPage /></ProtectedRoute>}
        />

        {/* Onboarding deliberately stays outside the main app shell. */}
        <Route
          path="/create-team"
          element={<ProtectedRoute><CreateTeamPage /></ProtectedRoute>}
        />
        <Route
          path="/join-team"
          element={<ProtectedRoute><JoinTeamPage /></ProtectedRoute>}
        />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<TeamDashboardPage />} />
          <Route path="/team" element={<TeamOverviewPage />} />
          <Route path="/team/:teamId" element={<TeamDetailPage />} />
          <Route path="/team/:teamId/findings" element={<TeamFindingsPage />} />
          <Route path="/team/:teamId/components/:component" element={<TeamComponentDashboardPage />} />
          <Route path="/team/:teamId/communication" element={<TeamCommunicationPage />} />
          <Route path="/team/:teamId/policies" element={<TeamPoliciesPage />} />
          <Route path="/team/:teamId/settings" element={<TeamSettingsPage />} />
          <Route path="/team/:teamId/member/:userId" element={<MemberDashboardPage isLeaderView />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
