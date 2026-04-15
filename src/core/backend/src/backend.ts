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

export interface BackendDescriptor<TConfig> {
    readonly name: string
    statefile: {
        read(params: {
            config: TConfig
        }): ResultAsync<StatefileData, BackendError>
        write<P extends ProviderSet>(params: {
            config: TConfig
            data: Statefile<P>
        }): ResultAsync<void, BackendError>
        delete(params: { config: TConfig }): ResultAsync<void, BackendError>
    }
}

export function describeBackend<TConfig>(
    desc: BackendDescriptor<TConfig>,
): (config: TConfig) => Backend {
    return (config: TConfig): Backend => ({
        name: desc.name,
        statefile: {
            read: () => desc.statefile.read({ config }),
            write: (data) => desc.statefile.write({ config, data }),
            delete: () => desc.statefile.delete({ config }),
        }
    })
}
