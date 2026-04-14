export { createLocalFileDriver, type LocalFileDriverConfig } from './local.js'
export type {
    StatefileData,
    Backend,
    BackendDescriptor,
    BackendError,
    StatefileOperation,
} from './backend.js'
export { describeBackend } from './backend.js'
export type {
    NotFoundError,
    PermissionDeniedError,
    WriteRejectedError,
    ServerError,
    UnknownError,
} from './backend.js'
