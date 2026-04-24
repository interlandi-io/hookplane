export { createLocalBackend, type LocalBackendConfig } from './local.js'
export { createTempBackend } from './temp.js'
export type {
    Backend,
    BackendDescriptor,
    BackendFactory,
    StateEvent,
    BackendError,
    BackendOperation,
} from './backend.js'
export { describeBackend } from './backend.js'
export type {
    NotFoundError,
    PermissionDeniedError,
    WriteRejectedError,
    ServerError,
    InternalError,
    ProviderNotFoundError,
    UnknownError,
} from './backend.js'
