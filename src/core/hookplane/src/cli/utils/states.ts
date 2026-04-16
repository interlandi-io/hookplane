import { Backend } from '@hookplane/backend'
import {
    bootstrap,
    endpointUrlHeuristic,
    match,
    ProviderSet,
    State,
} from '@hookplane/core'
import { getActual } from './backend.js'
import { getPrior } from './backend.js'
import type { Hookplane } from '../../index.js'

export interface StateOutput {
    prior: State<ProviderSet>
    actual: State<ProviderSet>
    desired: State<ProviderSet>
}

export async function states(hookplane: Hookplane): Promise<StateOutput> {
    const backend = hookplane.backend
    const bootstrapContent = bootstrap()
    await backend.statefile
        .write(bootstrapContent)
        .then((r: { _unsafeUnwrap(): unknown }) => r._unsafeUnwrap())

    const desiredUnknown = hookplane.state

    const prior = await getPrior(backend, desiredUnknown.providers)
    const actual = await getActual(desiredUnknown.providers)
    const desired = match(
        endpointUrlHeuristic,
        desiredUnknown,
        actual,
    )._unsafeUnwrap()

    return { prior, actual, desired }
}
