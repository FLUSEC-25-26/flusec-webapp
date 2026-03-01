import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import {
    ShieldCheck, LayoutDashboard, Users, LogOut, ChevronRight, Bell
} from 'lucide-react'

const navItems = [
    { to: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/team', label: 'Team Hub', icon: Users },
]

export default function AppLayout() {
    const { user, signOut } = useAuthStore()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="flex min-h-screen bg-surface">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 bg-surface-secondary border-r border-surface-border flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-surface-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-brand">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white tracking-tight">FluSec</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Security Hub</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }: { isActive: boolean }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                 ${isActive
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                                }`
                            }
                        >
                            {({ isActive }: { isActive: boolean }) => (
                                <>
                                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                                    <span className="flex-1">{label}</span>
                                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-500" />}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User */}
                <div className="p-4 border-t border-surface-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{user?.full_name ?? 'User'}</p>
                            <p className="text-[10px] text-gray-500 truncate">Member</p>
                        </div>
                        <button onClick={handleSignOut} className="btn-ghost p-1.5 text-gray-500 hover:text-red-400" title="Sign out">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <header className="h-14 border-b border-surface-border bg-surface-secondary/50 backdrop-blur flex items-center justify-end px-6 gap-3">
                    <button className="btn-ghost p-2 relative">
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                    </button>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto p-6 animate-fade-in">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
