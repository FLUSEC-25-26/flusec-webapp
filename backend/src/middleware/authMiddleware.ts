import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import type { TeamMembership } from './accessControl'

export interface AuthRequest extends Request {
  userId?: string
  userEmail?: string
  teamMembership?: TeamMembership
  findingTeamId?: string
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' })
      return
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' })
      return
    }

    // Works for ordinary Supabase sessions and OAuth 2.1 access tokens.
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    req.userId = user.id
    req.userEmail = user.email ?? undefined
    next()
  } catch (error) {
    next(error)
  }
}
