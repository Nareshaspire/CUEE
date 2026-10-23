import 'server-only'

import { cookies } from 'next/headers'
import { JWTAuthentication, type Payload } from 'payload'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'

const COOKIE_NAME = 'app-session'

function ensureAppJWTStrategy(payload: Payload) {
  if (!payload.authStrategies.some((strategy) => strategy.name === 'users-jwt')) {
    payload.authStrategies.push({
      name: 'users-jwt',
      authenticate: JWTAuthentication,
    })
  }
}

export function createAppAuth(appUserCollection: 'users') {
  return {
    async currentUser(): Promise<User | null> {
      const token = (await cookies()).get(COOKIE_NAME)?.value
      if (!token) return null

      const payload = await getPayloadClient()
      ensureAppJWTStrategy(payload)
      const authHeaders = new Headers({ Authorization: `JWT ${token}` })
      const { user } = await payload.auth({ headers: authHeaders })
      if (!user || user.collection !== appUserCollection) return null
      return user as User
    },

    async login(email: string, password: string): Promise<User> {
      const payload = await getPayloadClient()
      ensureAppJWTStrategy(payload)
      const result = await payload.login({
        collection: appUserCollection,
        data: { email, password },
      })
      if (!result.token || !result.user) throw new Error('Sign in failed.')
      const authHeaders = new Headers({ Authorization: `JWT ${result.token}` })
      const verified = await payload.auth({ headers: authHeaders })
      if (!verified.user || verified.user.collection !== appUserCollection) {
        throw new Error('Payload issued a token that could not be verified.')
      }

      ;(await cookies()).set(COOKIE_NAME, result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      return result.user as User
    },

    async logout() {
      ;(await cookies()).delete(COOKIE_NAME)
    },
  }
}

export const appAuth = createAppAuth('users')
