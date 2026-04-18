import type { ProviderSet, State } from '@hookplane/core'
import type { ResultAsync } from 'neverthrow'

export interface Backend {
    /** Name of the backend */
    readonly name: string

    state: {
        /** Reads state data */
        read<P extends ProviderSet>(providers: P): ResultAsync<State<P>, BackendError>

        /** Writes a state to storage */
        write<P extends ProviderSet>(
            data: State<P>,
        ): ResultAsync<void, BackendError>

        /** Deletes the state from storage */
        delete(): ResultAsync<void, BackendError>
    }

    signingSecret: {
        /** Reads a signing secret from storage */
        read(id: string): ResultAsync<string, BackendError>

        /** Writes a signing secret from storage */
        write(id: string, data: string): ResultAsync<void, BackendError>

        /** Deletes a signing secret from storage */
        delete(id: string): ResultAsync<void, BackendError>
    }
}

export type BackendOperation = 'read' | 'write' | 'delete'

export type BackendError =
    | NotFoundError
    | PermissionDeniedError
    | WriteRejectedError
    | ServerError
    | InternalError
    | UnknownError

export interface NotFoundError {
    kind: 'BackendError'
    name: 'NotFoundError'
    message: string
    while: BackendOperation
}

export interface PermissionDeniedError {
    kind: 'BackendError'
    name: 'PermissionDeniedError'
    message: string
    while: BackendOperation
}

export interface WriteRejectedError {
    kind: 'BackendError'
    name: 'WriteRejectedError'
    message: string
    while: BackendOperation
}

export interface ServerError {
    kind: 'BackendError'
    name: 'ServerError'
    message: string
    statusCode?: number
    while: BackendOperation
}

export interface InternalError {
    kind: 'BackendError'
    name: 'InternalError'
    message: string
    while: BackendOperation
    cause?: unknown
}

export interface UnknownError {
    kind: 'BackendError'
    name: 'UnknownError'
    message: string
    while: BackendOperation
    cause?: unknown
}

export interface BackendDescriptor<TConfig, TState> {
    readonly name: string
    init?: (config: TConfig) => Promise<TState>
    state: {
        read<P extends ProviderSet>(params: {
            config: TConfig
            state: TState
            providers: P
        }): ResultAsync<State<P>, BackendError>
        write<P extends ProviderSet>(params: {
            config: TConfig
            state: TState
            data: State<P>
        }): ResultAsync<void, BackendError>
        delete(params: {
            config: TConfig
            state: TState
        }): ResultAsync<void, BackendError>
    }
    signingSecret: {
        read(params: {
            config: TConfig
            state: TState
            id: string
        }): ResultAsync<string, BackendError>
        write(params: {
            config: TConfig
            state: TState
            id: string
            data: string
        }): ResultAsync<void, BackendError>
        delete(params: {
            config: TConfig
            state: TState
            id: string
        }): ResultAsync<void, BackendError>
    }
}

export function describeBackend<TConfig, TState>(
    desc: BackendDescriptor<TConfig, TState>,
): (config: TConfig) => () => Promise<Backend> {
    return (config: TConfig) => async () => {
        let state = {} as TState
        if (desc.init) {
            state = await desc.init(config)
        }
        return {
            name: desc.name,
            state: {
                read: <P extends ProviderSet>(providers: P) =>
                    desc.state.read<P>({
                        config,
                        state,
                        providers: providers,
                    }),
                write: <P extends ProviderSet>(data: State<P>) =>
                    desc.state.write<P>({
                        config,
                        state,
                        data,
                    }),
                delete: () => desc.state.delete({ config, state }),
            },
            signingSecret: {
                read: (id) => desc.signingSecret.read({ config, state, id }),
                write: (id, data) =>
                    desc.signingSecret.write({ config, state, id, data }),
                delete: (id) =>
                    desc.signingSecret.delete({ config, state, id }),
            },
        }
    }
}
