import {
    describeStatefileDriver,
    type StatefileDriverError,
    type StatefileDriverData,
} from './statefile-driver.js'
import { ResultAsync } from 'neverthrow'
import {
    readFile,
    writeFile,
    unlink,
    access,
    constants,
} from 'node:fs/promises'

export type LocalFileDriverConfig = {
    path: string
}

function toStatefileDriverError(
    e: unknown,
    operation: 'read' | 'write' | 'update',
    path: string,
): StatefileDriverError {
    const error = e as NodeJS.ErrnoException
    if (error.code === 'ENOENT') {
        return {
            name: 'NotFoundError',
            message: `file not found: ${path}`,
            while: operation,
        }
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
            name: 'PermissionDeniedError',
            message: `permission denied: ${path}`,
            while: operation,
        }
    }
    if (error.code === 'ENOSPC') {
        return {
            name: 'WriteRejectedError',
            message: 'disk full',
            while: operation,
        }
    }
    return {
        name: 'UnknownError',
        message: String(e),
        while: operation,
        cause: e,
    }
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path, constants.R_OK)
        return true
    } catch {
        return false
    }
}

async function readStatefile(
    config: LocalFileDriverConfig,
): Promise<StatefileDriverData> {
    const exists = await fileExists(config.path)
    if (!exists) {
        throw {
            name: 'NotFoundError',
            message: `file not found: ${config.path}`,
            while: 'read',
        }
    }
    const contents = await readFile(config.path, 'utf-8')
    return JSON.parse(contents)
}

async function writeStatefile(
    config: LocalFileDriverConfig,
    data: StatefileDriverData,
): Promise<void> {
    await writeFile(config.path, JSON.stringify(data, null, 2), 'utf-8')
}

async function deleteStatefile(config: LocalFileDriverConfig): Promise<void> {
    try {
        await unlink(config.path)
    } catch (e) {
        const error = e as NodeJS.ErrnoException
        if (error.code !== 'ENOENT') {
            throw e
        }
    }
}

export const createLocalFileDriver =
    describeStatefileDriver<LocalFileDriverConfig>({
        name: 'local-file',
        read: ({ config }) =>
            ResultAsync.fromPromise(readStatefile(config), (e) =>
                toStatefileDriverError(e, 'read', config.path),
            ),
        write: ({ config, data }) =>
            ResultAsync.fromPromise(writeStatefile(config, data), (e) =>
                toStatefileDriverError(e, 'write', config.path),
            ),
        delete: ({ config }) =>
            ResultAsync.fromPromise(deleteStatefile(config), (e) =>
                toStatefileDriverError(e, 'update', config.path),
            ),
    })
