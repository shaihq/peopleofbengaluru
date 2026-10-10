import type { City } from './city'
import type { Room } from './room'

export interface Env {
  ROOM: DurableObjectNamespace<Room>
  CITY: DurableObjectNamespace<City>
  /** new sockets per IP per minute (generous: an office shares one IP) */
  CONNECT_LIMIT: RateLimit
  /** /assign + /city calls per member per minute */
  API_LIMIT: RateLimit
  ENV_NAME: 'dev' | 'staging' | 'production'
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  ALLOWED_ORIGINS: string
  /** staging only: lets load-test bots join as members */
  LOADTEST_SECRET?: string
}

export const cityOf = (env: Env) => env.CITY.get(env.CITY.idFromName('city'))
export const roomOf = (env: Env, name: string) => env.ROOM.get(env.ROOM.idFromName(name))
