import { ProviderSet, Statefile } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'

export interface StatefileDriver {
    /** Name of the driver */
    readonly name: string

    /** Reads the raw statefile data from storage */
    read(): ResultAsync<StatefileData, StatefileDriverError>

    /** Writes statefile data to storage */
    write(data: StatefileData): ResultAsync<void, StatefileDriverError>

    /** Deletes the statefile from storage */
    delete(): ResultAsync<void, StatefileDriverError>
}

export type StatefileData = Statefile<ProviderSet>['data']

export type StatefileOperation = 'read' | 'write' | 'update'

export type StatefileDriverError =
    | NotFoundError
    | PermissionDeniedError
    | WriteRejectedError
    | ServerError
    | UnknownError

export interface NotFoundError {
    name: 'NotFoundError'
    message: string
    while: StatefileOperation
}

export interface PermissionDeniedError {
    name: 'PermissionDeniedError'
    message: string
    while: StatefileOperation
}

export interface WriteRejectedError {
    name: 'WriteRejectedError'
    message: string
    while: StatefileOperation
}

export interface ServerError {
    name: 'ServerError'
    message: string
    statusCode?: number
    while: StatefileOperation
}

export interface UnknownError {
    name: 'UnknownError'
    message: string
    while: StatefileOperation
    cause?: unknown
}
