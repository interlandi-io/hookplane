import { initTRPC, TRPCError } from '@trpc/server'
import { StatefileSchema } from '@hookplane/core'
import z from 'zod'

interface Context {
    token: string,
}

const t = initTRPC.context<Context>().create()
const proc = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    return next({
        ctx,
    })
})

export const remoteBackendRouter = t.router({
    statefile: {
        read: proc
            .query(async () => {}),
        write: proc
            .input(z.object({ data: StatefileSchema }))
            .mutation(async () => {}),
        delete: proc
            .mutation(async () => {}),
    },

    signingSecret: {
        read: proc
            .input(z.object({ id: z.string() }))
            .query(async () => {}),
        write: proc
            .input(z.object({ id: z.string(), data: z.string() }))
            .mutation(async () => {}),
        delete: proc
            .input(z.object({ id: z.string() }))
            .mutation(async () => {}),
    },
})

export type RemoteBackendRouter = typeof remoteBackendRouter
