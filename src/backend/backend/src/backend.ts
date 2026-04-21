import type {
    EndpointHandle,
    EndpointState,
    Provider,
    ProviderSet,
    State,
} from '@hookplane/core'
import { okAsync, type ResultAsync } from 'neverthrow'

export interface Backend {
    /** Name of the backend */
    readonly name: string

    features: {
        applyEvents: boolean
    }

    state: {
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

        events: {
            /**
             * Optional: not supported by every provider
             *
             * Applies the events provided to the state currently present in the backend.
             */
            apply(
                events: StateEvent<Provider>[],
            ): ResultAsync<void, BackendError>
        }
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
        events?: {
            apply?(params: {
                config: TConfig
                state: TState
                events: StateEvent<Provider>[]
            }): ResultAsync<void, BackendError>
        }
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
            features: {
                applyEvents: desc.state.events?.apply !== undefined,
            },
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
                events: {
                    apply(events) {
                        if (!desc.state.events?.apply) {
                            return okAsync()
                        }
                        return desc.state.events!.apply({
                            config,
                            state,
                            events,
                        })
                    },
                },
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
