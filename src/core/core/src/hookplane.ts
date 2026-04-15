import { ProviderSet } from './provider-set.js'
import { StateUnknown } from './state.js'
import z from 'zod'

export type Hookplane = {
    state: StateUnknown<ProviderSet>
}

const HookplaneSchemaApprox = z.object({
    state: z.object({
        providers: z.object(),
        providerStates: z.object(),
    }),
})

/**
 * @returns a Zod error if the schema doesn't match
 */
export function validateHookplaneInstance(hookplane: Hookplane) {
    const result = HookplaneSchemaApprox.safeParse(hookplane)
    return result.error
}
