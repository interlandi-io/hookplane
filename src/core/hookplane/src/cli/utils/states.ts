import { err, ok, Result } from 'neverthrow'
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

export async function states(
    hookplane: Hookplane,
): Promise<Result<StateOutput, Error>> {
    const backend = hookplane.backend
    const bootstrapContent = bootstrap()
    const writeResult = await backend.statefile.write(bootstrapContent)
    if (writeResult.isErr()) {
        return err(new Error(writeResult.error.message))
    }

    const desiredUnknown = hookplane.state

    const priorResult = await getPrior(backend, desiredUnknown.providers)
    if (priorResult.isErr()) {
        return err(priorResult.error)
    }

    const actualResult = await getActual(desiredUnknown.providers)
    if (actualResult.isErr()) {
        return err(actualResult.error)
    }

    const desired = match(
        endpointUrlHeuristic,
        desiredUnknown,
        actualResult.value,
    )
    if (desired.isErr()) {
        return err(new Error(desired.error.message))
    }

    return ok({
        prior: priorResult.value,
        actual: actualResult.value,
        desired: desired.value,
    })
}
