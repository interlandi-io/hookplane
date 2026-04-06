import { ProviderSet, Statefile } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'

export type StatefileDriverData = Statefile<ProviderSet>['data']

export interface StatefileDriver<P extends ProviderSet> {
    /** Name of the driver */
    readonly name: string

    /** Reads the raw statefile data from storage */
    read(): ResultAsync<StatefileDriverData, StatefileDriverError>

    /** Writes a validated statefile to storage */
    write(data: Statefile<P>): ResultAsync<void, StatefileDriverError>

    /** Deletes the statefile from storage */
    delete(): ResultAsync<void, StatefileDriverError>
}

export type StatefileOperation = 'read' | 'write' | 'delete'

export type StatefileDriverError =
    | NotFoundError
    | PermissionDeniedError
    | WriteRejectedError
    | ServerError
    | UnknownError

export interface NotFoundError {
    kind: 'StatefileDriverError'
    name: 'NotFoundError'
    message: string
    while: StatefileOperation
}

export interface PermissionDeniedError {
    kind: 'StatefileDriverError'
    name: 'PermissionDeniedError'
    message: string
    while: StatefileOperation
}

export interface WriteRejectedError {
    kind: 'StatefileDriverError'
    name: 'WriteRejectedError'
    message: string
    while: StatefileOperation
}

export interface ServerError {
    kind: 'StatefileDriverError'
    name: 'ServerError'
    message: string
    statusCode?: number
    while: StatefileOperation
}

export interface UnknownError {
    kind: 'StatefileDriverError'
    name: 'UnknownError'
    message: string
    while: StatefileOperation
    cause?: unknown
}

export interface StatefileDriverDescriptor<TConfig, P extends ProviderSet> {
    readonly name: string
    read(params: {
        config: TConfig
    }): ResultAsync<StatefileDriverData, StatefileDriverError>
    write(params: {
        config: TConfig
        data: Statefile<P>
    }): ResultAsync<void, StatefileDriverError>
    delete(params: { config: TConfig }): ResultAsync<void, StatefileDriverError>
}

export function describeStatefileDriver<TConfig, P extends ProviderSet>(
    desc: StatefileDriverDescriptor<TConfig, P>,
): (config: TConfig) => StatefileDriver<P> {
    return (config: TConfig): StatefileDriver<P> => ({
        name: desc.name,
        read: () => desc.read({ config }),
        write: (data) => desc.write({ config, data }),
        delete: () => desc.delete({ config }),
    })
}
