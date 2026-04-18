import { err, ok, Result } from 'neverthrow'
import { Backend } from '@hookplane/backend'
import { ProviderSet, State, sync } from '@hookplane/core'
import { logger } from '../logger.js'

export async function getPrior<P extends ProviderSet>(
    backend: Backend,
    providers: P,
): Promise<Result<State<P>, Error>> {
    logger.debug('getting prior state')
    const prior = await backend.state.read(providers)
    if (prior.isErr()) {
        return err(new Error(prior.error.message))
    }
    logger.dir('prior state', prior.value)
    return ok(prior.value)
}

export async function getActual<P extends ProviderSet>(
    providers: P,
): Promise<Result<State<P>, Error>> {
    logger.debug('getting actual state')
    const actual = await sync(providers)
    if (actual.isErr()) {
        return err(new Error(actual.error.message))
    }
    logger.dir('actual state', actual.value)
    return ok(actual.value)
}
