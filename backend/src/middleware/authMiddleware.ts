import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'

export interface AuthRequest extends Request {
    userId?: string
    userEmail?: string
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' })
        return
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
        res.status(401).json({ error: 'Invalid or expired token' })
        return
    }

    req.userId = user.id
    req.userEmail = user.email ?? ''
    next()
}
