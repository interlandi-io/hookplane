import { ProviderSet, Statefile } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'

export type StatefileDriverData = Statefile<ProviderSet>['data']

export interface StatefileDriver {
    /** Name of the driver */
    readonly name: string

    /** Reads the raw statefile data from storage */
    read(): ResultAsync<StatefileDriverData, StatefileDriverError>

    /** Writes statefile data to storage */
    write(data: StatefileDriverData): ResultAsync<void, StatefileDriverError>

    /** Deletes the statefile from storage */
    delete(): ResultAsync<void, StatefileDriverError>
}

export type StatefileOperation = 'read' | 'write' | 'update'

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

export interface StatefileDriverDescriptor<TConfig> {
    readonly name: string
    read(params: {
        config: TConfig
    }): ResultAsync<StatefileDriverData, StatefileDriverError>
    write(params: {
        config: TConfig
        data: StatefileDriverData
    }): ResultAsync<void, StatefileDriverError>
    delete(params: { config: TConfig }): ResultAsync<void, StatefileDriverError>
}

export function describeStatefileDriver<TConfig>(
    desc: StatefileDriverDescriptor<TConfig>,
): (config: TConfig) => StatefileDriver {
    return (config: TConfig): StatefileDriver => ({
        name: desc.name,
        read: () => desc.read({ config }),
        write: (data) => desc.write({ config, data }),
        delete: () => desc.delete({ config }),
    })
}
