import { create } from 'zustand'
import type { Team, TeamMember } from '@/types'

interface TeamState {
    currentTeam: Team | null
    members: TeamMember[]
    myRole: 'leader' | 'member' | 'viewer' | null
    setTeam: (team: Team | null) => void
    setMembers: (members: TeamMember[]) => void
    setMyRole: (role: 'leader' | 'member' | 'viewer' | null) => void
    clearTeam: () => void
}

export const useTeamStore = create<TeamState>((set) => ({
    currentTeam: null,
    members: [],
    myRole: null,

    setTeam: (team) => set({ currentTeam: team }),
    setMembers: (members) => set({ members }),
    setMyRole: (role) => set({ myRole: role }),
    clearTeam: () => set({ currentTeam: null, members: [], myRole: null }),
}))
