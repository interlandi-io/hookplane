import { initTRPC, TRPCError } from '@trpc/server'
import { ProviderSet, Statefile, StatefileSchema } from '@hookplane/core'
import z from 'zod'
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone'

type StatefileData = Statefile<ProviderSet>['data']

export type RouterDescriptor<TContext extends object> = {
    createContext: (
        opts: CreateHTTPContextOptions,
        extraHeaders: RemoteBackendHeaders,
    ) => Promise<TContext>
    middleware: (ctx: TContext) => Promise<void>
    statefile: {
        read: (ctx: TContext) => Promise<StatefileData>
        write: (ctx: TContext, data: StatefileData) => Promise<void>
        delete: (ctx: TContext) => Promise<void>
    }
    signingSecret: {
        read: (ctx: TContext, id: string) => Promise<string>
        write: (ctx: TContext, id: string, data: string) => Promise<void>
        delete: (ctx: TContext, id: string) => Promise<void>
    }
}

export type RemoteBackendHeaders = {
    'x-token': string
}

export function createRemoteBackendTRPC<TContext extends object>({
    createContext: createContextInner,
    middleware,
    statefile,
    signingSecret,
}: RouterDescriptor<TContext>) {
    const t = initTRPC.context<TContext>().create()
    const proc = t.procedure.use(async ({ ctx, next }) => {
        await middleware(ctx as unknown as TContext)
        return next()
    })

    const router = t.router({
        statefile: {
            read: proc.query(async ({ ctx }) =>
                statefile.read(ctx as unknown as TContext),
            ),
            write: proc
                .input(z.object({ data: StatefileSchema }))
                .mutation(async ({ ctx, input: { data } }) =>
                    statefile.write(ctx as unknown as TContext, data),
                ),
            delete: proc.mutation(async ({ ctx }) =>
                statefile.delete(ctx as unknown as TContext),
            ),
        },

        signingSecret: {
            read: proc
                .input(z.object({ id: z.string() }))
                .query(async ({ ctx, input: { id } }) =>
                    signingSecret.read(ctx as unknown as TContext, id),
                ),
            write: proc
                .input(z.object({ id: z.string(), data: z.string() }))
                .mutation(async ({ ctx, input: { id, data } }) =>
                    signingSecret.write(ctx as unknown as TContext, id, data),
                ),
            delete: proc
                .input(z.object({ id: z.string() }))
                .mutation(async ({ ctx, input: { id } }) =>
                    signingSecret.delete(ctx as unknown as TContext, id),
                ),
        },
    })
    const createContext = async (opts: CreateHTTPContextOptions) => {
        const token = opts.req.headers['x-token']
        if (!token || typeof token !== 'string') {
            throw new TRPCError({
                message: 'unauthenticated: header "x-token" must be set',
                code: 'UNAUTHORIZED',
            })
        }
        return await createContextInner(opts, { 'x-token': token as string })
    }

    return { router, createContext }
}

export function createAuthorizedHeaders(token: string): RemoteBackendHeaders {
    return { 'x-token': token }
}

export type RemoteBackendRouter = ReturnType<
    typeof createRemoteBackendTRPC
>['router']
