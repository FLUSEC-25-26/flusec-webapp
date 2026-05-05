import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import TeamDashboardPage from '@/pages/dashboard/TeamDashboardPage'
import MemberDashboardPage from '@/pages/dashboard/MemberDashboardPage'
import TeamOverviewPage from '@/pages/team/TeamOverviewPage'
import TeamDetailPage from '@/pages/team/TeamDetailPage'
import TeamSettingsPage from '@/pages/settings/TeamSettingsPage'
import TeamPoliciesPage from '@/pages/team/TeamPoliciesPage'
import TeamFindingsPage from '@/pages/team/TeamFindingsPage'
import TeamComponentDashboardPage from '@/pages/team/TeamComponentDashboardPage'
import TeamCommunicationPage from '@/pages/team/TeamCommunicationPage'
import AppLayout from '@/components/layout/AppLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthStore()
    if (loading) return <FullPageLoader />
    if (!user) return <Navigate to="/login" replace />
    return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthStore()
    if (loading) return <FullPageLoader />
    if (user) return <Navigate to="/dashboard" replace />
    return <>{children}</>
}

function FullPageLoader() {
    return (
        <div className="min-h-screen bg-surface flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <p className="text-sm text-gray-400">Loading FluSec...</p>
            </div>
        </div>
    )
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

                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<TeamDashboardPage />} />
                    <Route path="/team" element={<TeamOverviewPage />} />
                    <Route path="/team/:teamId" element={<TeamDetailPage />} />
                    <Route path="/team/:teamId/findings" element={<TeamFindingsPage />} />
                    <Route path="/team/:teamId/components/:component" element={<TeamComponentDashboardPage />} />
                    <Route path="/team/:teamId/communication" element={<TeamCommunicationPage />} />
                    <Route path="/team/:teamId/settings" element={<TeamSettingsPage />} />
                    <Route path="/team/:teamId/policies" element={<TeamPoliciesPage />} />
                    <Route path="/team/:teamId/member/:userId" element={<MemberDashboardPage isLeaderView />} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    )
}