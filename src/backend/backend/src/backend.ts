import type {
    EndpointHandle,
    EndpointState,
    Provider,
    ProviderSet,
    State,
} from '@hookplane/core'
import { type ResultAsync } from 'neverthrow'

export interface Backend<
    TStateWriteMode extends BackendStateWriteMode = BackendStateWriteMode,
> {
    /** Name of the backend */
    readonly name: string

    state: TStateWriteMode extends 'snapshot'
        ? {
              writeMode: 'snapshot'

              /** Reads state data */
              read<P extends ProviderSet>(
                  providers: P,
              ): ResultAsync<State<P>, BackendError>

              /** Writes a state to storage */
              write<P extends ProviderSet>(
                  data: State<P>,
              ): ResultAsync<void, BackendError>

              /** Deletes the state from storage */
              delete(): ResultAsync<void, BackendError>
          }
        : {
              writeMode: 'event' 
              /**
               * Commits the events provided to the state currently present in the backend.
               */
              commit(
                  events: StateEvent<Provider>[],
              ): ResultAsync<void, BackendError>
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

export type BackendStateWriteMode = 'snapshot' | 'event'

export type StateEvent<P extends Provider> =
    | {
          tag: 'endpoint.created'
          provider: P
          handle: EndpointHandle
          state: EndpointState<P>
      }
    | {
          tag: 'endpoint.updated'
          provider: P
          handle: EndpointHandle
          before: EndpointState<P>
          after: EndpointState<P>
      }
    | { tag: 'endpoint.deleted'; provider: P; handle: EndpointHandle }

export type BackendOperation = 'read' | 'write' | 'delete'

export type BackendError =
    | NotFoundError
    | PermissionDeniedError
    | WriteRejectedError
    | ServerError
    | InternalError
    | ProviderNotFoundError
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

export interface ProviderNotFoundError {
    kind: 'BackendError'
    name: 'ProviderNotFoundError'
    message: string
    while: BackendOperation
    provider: string
}

export interface UnknownError {
    kind: 'BackendError'
    name: 'UnknownError'
    message: string
    while: BackendOperation
    cause?: unknown
}

export interface BackendDescriptor<TConfig, TState, TStateWriteMode> {
    readonly name: string
    init?: (config: TConfig) => Promise<TState>
    state: TStateWriteMode extends 'snapshot' ? { 
        writeMode: TStateWriteMode,
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
    } :  {
        writeMode: TStateWriteMode,
            commit(params: {
                config: TConfig
                state: TState
                events: StateEvent<Provider>[]
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


export function describeBackend<TConfig, TState, TStateWriteMode extends 'snapshot'>(
    desc: BackendDescriptor<TConfig, TState, 'snapshot'>,
): (config: TConfig) => () => Promise<Backend<'snapshot'>>
export function describeBackend<TConfig, TState, TStateWriteMode extends 'event'>(
    desc: BackendDescriptor<TConfig, TState, 'event'>,
): (config: TConfig) => () => Promise<Backend<'event'>>

export function describeBackend<TConfig, TState, TStateWriteMode extends BackendStateWriteMode>(
    desc: BackendDescriptor<TConfig, TState, TStateWriteMode>,
): (config: TConfig) => () => Promise<Backend<TStateWriteMode>> {
    return (config: TConfig) => async () => {
        let state = {} as TState
        if (desc.init) {
            state = await desc.init(config)
        }

        const stateProp: Backend['state'] = desc.state.writeMode === 'snapshot'
            ? (() => {
                const s = (desc as BackendDescriptor<TConfig, TState, 'snapshot'>).state
                return {
                    writeMode: 'snapshot',
                    read: <P extends ProviderSet>(providers: P) =>
                        s.read<P>({
                            config,
                            state,
                            providers: providers,
                        }),
                    write: <P extends ProviderSet>(data: State<P>) =>
                        s.write<P>({
                            config,
                            state,
                            data,
                        }),
                    delete: () => s.delete({ config, state }),
                } as const
            })()
            : (() => {
                const s = (desc as BackendDescriptor<TConfig, TState, 'event'>).state
                return {
                    writeMode: 'event',
                    commit: (events: StateEvent<Provider>[]) =>
                        s.commit({
                            config,
                            state,
                            events
                        })
                } as const
            })()

        return {
            name: desc.name,
            state: stateProp as Backend<TStateWriteMode>['state'],
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
