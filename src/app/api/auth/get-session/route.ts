import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

const { GET } = toNextJsHandler(auth)

export { GET }