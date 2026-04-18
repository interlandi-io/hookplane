export { createLocalBackend, type LocalBackendConfig } from './local.js'
export { createTempBackend } from './temp.js'
export type {
    Backend,
    BackendDescriptor,
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
    UnknownError,
} from './backend.js'
