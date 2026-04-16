import { err, ok, Result } from 'neverthrow'
import { Backend } from '@hookplane/backend'
import { parseStatefile, ProviderSet, State, sync } from '@hookplane/core'

export async function getPrior<P extends ProviderSet>(
    backend: Backend,
    providers: P,
): Promise<Result<State<P>, Error>> {
    const data = await backend.statefile.read()
    if (data.isErr()) {
        return err(new Error(data.error.message))
    }
    const statefile = parseStatefile(data.value, providers)
    if (statefile.isErr()) {
        return err(new Error(statefile.error.message))
    }
    const prior = statefile.value.toState()
    if (prior.isErr()) {
        return err(new Error(prior.error.message))
    }

    return ok(prior.value)
}

export async function getActual<P extends ProviderSet>(
    providers: P,
): Promise<Result<State<P>, Error>> {
    const actual = await sync(providers)
    if (actual.isErr()) {
        return err(new Error(actual.error.message))
    }
    return ok(actual.value)
}
