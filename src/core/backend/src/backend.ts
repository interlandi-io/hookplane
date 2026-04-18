import { ProviderSet, Statefile } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'

export type StatefileData = Statefile<ProviderSet>['data']

export interface Backend {
    /** Name of the backend */
    readonly name: string

    statefile: {
        /** Reads the raw statefile data from storage */
        read(): ResultAsync<StatefileData, BackendError>

        /** Writes a validated statefile to storage */
        write<P extends ProviderSet>(
            data: Statefile<P>,
        ): ResultAsync<void, BackendError>

        /** Deletes the statefile from storage */
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

export type StatefileOperation = 'read' | 'write' | 'delete'

export type BackendError =
    | NotFoundError
    | PermissionDeniedError
    | WriteRejectedError
    | ServerError
    | UnknownError

export interface NotFoundError {
    kind: 'BackendError'
    name: 'NotFoundError'
    message: string
    while: StatefileOperation
}

export interface PermissionDeniedError {
    kind: 'BackendError'
    name: 'PermissionDeniedError'
    message: string
    while: StatefileOperation
}

export interface WriteRejectedError {
    kind: 'BackendError'
    name: 'WriteRejectedError'
    message: string
    while: StatefileOperation
}

export interface ServerError {
    kind: 'BackendError'
    name: 'ServerError'
    message: string
    statusCode?: number
    while: StatefileOperation
}

export interface UnknownError {
    kind: 'BackendError'
    name: 'UnknownError'
    message: string
    while: StatefileOperation
    cause?: unknown
}

export interface BackendDescriptor<TConfig, TState> {
    readonly name: string
    init?: (config: TConfig) => Promise<TState>
    statefile: {
        read(params: {
            config: TConfig
            state: TState
        }): ResultAsync<StatefileData, BackendError>
        write<P extends ProviderSet>(params: {
            config: TConfig
            state: TState
            data: Statefile<P>
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
): (config: TConfig) => Promise<Backend> {
    return async (config: TConfig) => {
        let state = {} as TState
        if (desc.init) {
            state = await desc.init(config)
        }
        return {
            name: desc.name,
            statefile: {
                read: () => desc.statefile.read({ config, state }),
                write: (data) => desc.statefile.write({ config, state, data }),
                delete: () => desc.statefile.delete({ config, state }),
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
