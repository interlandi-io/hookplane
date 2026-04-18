import { styleText } from 'util'
import ora from 'ora'
import { Result } from 'neverthrow'

let logState = {
    debug: false,
    info: false,
    warn: false,
    error: false,
}

export type LogLevel = keyof typeof logState

export function enableLogLevel(level: LogLevel) {
    logState[level] = true
}

export function disableLogLevel(level: LogLevel) {
    logState[level] = false
}

export function setLogState(next: typeof logState) {
    logState = next
}

export function initLogger(state: Partial<typeof logState>) {
    logState = {
        debug: false,
        info: true,
        warn: true,
        error: true,
        ...state,
    }
    logger.debug(`Log Config:
    debug: ${logState.debug ? 'on' : 'off'}
    info: ${logState.info ? 'on' : 'off'}
    warn: ${logState.warn ? 'on' : 'off'}
    error: ${logState.error ? 'on' : 'off'}
`)
}

function shouldLog(level: LogLevel): boolean {
    return logState[level]
}

const debugPrefix = styleText('green', 'debug')
const infoPrefix = styleText('blue', 'info')
const warnPrefix = styleText('yellow', 'warn')
const errorPrefix = styleText('red', 'error')

export const logger = {
    dir: (name: string, obj: object) => {
        if (shouldLog('debug')) {
            console.log(debugPrefix, `${name}: `) 
            console.dir(obj)
        }
    },
    debug: (...msg: unknown[]) => {
        if (shouldLog('debug')) console.log(debugPrefix, ...msg)
    },
    info: (...msg: unknown[]) => {
        if (shouldLog('info')) console.log(infoPrefix, ...msg)
    },
    warn: (...msg: unknown[]) => {
        if (shouldLog('warn')) console.warn(warnPrefix, ...msg)
    },
    error: (...msg: unknown[]) => {
        if (shouldLog('error')) console.error(errorPrefix, ...msg)
    },
}

export async function withSpinner<T, E = Error>(
    msg: string,
    fn: () => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
    const s = ora(msg).start()
    const result = await fn()

    if (result.isOk()) {
        s.succeed()
    } else {
        s.fail()
    }

    return result
}
