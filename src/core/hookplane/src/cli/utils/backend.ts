import { Backend } from '@hookplane/backend'
import { parseStatefile, ProviderSet, State, sync } from '@hookplane/core'

export async function getPrior<P extends ProviderSet>(
    backend: Backend,
    providers: P,
): Promise<State<P>> {
    const data = await backend.statefile.read()
    if (data.isErr()) {
        console.error(
            'failed to read state file from backend: ',
            data.error.message,
        )
        process.exit(1)
    }
    const statefile = parseStatefile(data.value, providers)
    if (statefile.isErr()) {
        console.error(
            'failed to parse statefile from backend: ',
            statefile.error.message,
        )
        process.exit(1)
    }
    const prior = statefile.value.toState()
    if (prior.isErr()) {
        console.error(
            'failed to deserialize statefile from backend: ',
            prior.error.message,
        )
        process.exit(1)
    }

    return prior.value
}

export async function getActual<P extends ProviderSet>(
    providers: P,
): Promise<State<P>> {
    const actual = await sync(providers)
    if (actual.isErr()) {
        console.error(actual.error.message)
        process.exit(1)
    }
    return actual.value
}
