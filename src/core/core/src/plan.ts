import { isDeepStrictEqual } from 'util'
import { State } from './state'
import {
    Provider,
    EndpointState,
    EndpointHandle,
    EndpointIndex,
    BaseUrl,
} from './provider'
import { IndexedState } from './pull'
import { err, ok, Result } from 'neverthrow'

/**
 * A plan for moving from the `left` `IndexedState` to the `right` `State`.
 *
 * @example
 * ```typescript
 * const left: IndexedState<...> = { ...  }
 * const right: State<...> = { ... }
 *
 * const plan = createPlan(left, right)
 * ```
 */
type Plan<P extends Record<string, Provider>> = {
    baseUrl: BaseUrl
    providers: P
    providerPlans: {
        [K in keyof P]: Map<StepId, Step<P[K]>>
    }
    getStepById(id: StepId): Result<Step<P[keyof P]>, Error>
    /**
     * @returns `StepId`s in this `Plan`
     */
    getStepIds(): StepId[]
}

/**
 * A number branded to prevent accidental mixing with plain numbers.
 */
type StepId = number & { readonly __brand: 'StepId' }

/**
 * Create a branded `StepId` handle from a plain number.
 * @param id - The raw identifier.
 */
function createStepId(id: number): StepId {
    return id as StepId
}

/**
 * A planned action.
 */
type Step<P extends Provider> = CreateStep<P> | DeleteStep<P> | UpdateStep<P>

/**
 * A planned action to subscribe to an event.
 */
type CreateStep<P extends Provider> = {
    kind: 'create'
    state: EndpointState<P>
}

/**
 * A planned action to unsubscribe from an event.
 */
type DeleteStep<P> = {
    kind: 'delete'
    handle: EndpointHandle
    __phantom?: P
}

/**
 * A planned action to update an event from its current `eventParams` to `eventParams`.
 */
type UpdateStep<P extends Provider> = {
    kind: 'update'
    handle: EndpointHandle
    state: EndpointState<P>
}

/**
 * Creates a `Plan` for updating a state from one state to another.
 *
 * @param left The left state.
 * @param right The right state.
 * @returns A `Plan` for updating the left state to the right state.
 */
function createPlan<
    L extends IndexedState<Record<string, Provider>>,
    R extends State<Record<string, Provider>>,
>(left: L, right: R): Plan<Record<string, Provider>> {
    const comparison = createComparison(left, right)
    const providers = comparison.providers // Merged providers
    const providerPlans: Plan<Record<string, Provider>>['providerPlans'] = {}
    let idCounter = 0

    for (const [providerKey, providerComparison] of Object.entries(
        comparison.providerComparisons,
    )) {
        providerPlans[providerKey] = new Map()
        const steps = matchAndDiff(providerComparison)
        for (const step of steps) {
            const id = createStepId(idCounter++)
            providerPlans[providerKey].set(id, step)
        }
    }

    return {
        baseUrl: right.baseUrl,
        providers,
        providerPlans,
        getStepById: getStepById(providerPlans),
        getStepIds: getStepIds(providerPlans),
    }
}

const getStepById =
    <P extends Record<string, Provider>>(
        providerPlans: Plan<P>['providerPlans'],
    ) =>
    (id: StepId) => {
        let existing = 0
        let step: Step<Provider> | undefined = undefined
        for (const providerPlan of Object.values(providerPlans)) {
            const s = providerPlan.get(id)
            if (s) {
                step = s
                existing++
            }
        }

        if (existing > 1) {
            return err(new Error(`more than one step shares id ${id}`))
        } else if (existing < 1 || step == undefined) {
            return err(new Error(`no step found by id ${id}`))
        }

        return ok(step)
    }

const getStepIds =
    <P extends Record<string, Provider>>(
        providerPlans: Plan<P>['providerPlans'],
    ) =>
    () => {
        const ids: StepId[] = []
        for (const providerPlan of Object.values(providerPlans)) {
            ids.push(...(providerPlan as Map<StepId, Step<Provider>>).keys())
        }

        return ids
    }

/**
 * Comapres two states by merging their Providers and juxtaposing their respective `EndpointState`s.
 */
type Comparison<P extends Record<string, Provider>> = {
    providers: P
    providerComparisons: {
        [K in keyof P]: ProviderComparison<P[K]>
    }
}

/**
 * `left` contains the states for `P` from the left state.
 * `right` contains the states for `P` from the right state
 */
type ProviderComparison<P extends Provider> = {
    left: EndpointIndex<P>
    right: EndpointState<P>[]
}

/**
 * @param left The left state.
 * @param right The right state.
 * @returns A `Comparison` of left and right.
 */
function createComparison<
    L extends IndexedState<Record<string, Provider>>,
    R extends State<Record<string, Provider>>,
>(left: L, right: R): Comparison<Record<string, Provider>> {
    const providers = mergeProviders(left.providers, right.providers)
    const providerComparisons: Comparison<
        typeof providers
    >['providerComparisons'] = {}

    for (const [leftProviderKey, leftEndpointIndex] of Object.entries(
        left.providerStates,
    )) {
        providerComparisons[leftProviderKey] = {
            left: new Map(leftEndpointIndex.entries()),
            right: [],
        }
    }

    for (const [rightProviderKey, rightEndpoints] of Object.entries(
        right.providerStates,
    )) {
        if (!providerComparisons[rightProviderKey]) {
            providerComparisons[rightProviderKey] = {
                left: new Map(),
                right: [...rightEndpoints],
            }
        } else {
            providerComparisons[rightProviderKey].right = [...rightEndpoints]
        }
    }

    return {
        providers,
        providerComparisons,
    }
}

/**
 * Merges two providers into one.
 *
 * @param left The left provider.
 * @param right The right provider.
 * @returns A merged provider.
 */
function mergeProviders<
    L extends Record<string, Provider>,
    R extends Record<string, Provider>,
>(left: L, right: R): Record<string, Provider> {
    const merged: Record<string, Provider> = left
    for (const [kr, vr] of Object.entries(right)) {
        // TODO: right now, this just chooses the right provider params.
        // It might make more sense to implement more complex merging logic.
        merged[kr] = vr
    }
    return merged
}

/**
 * Matches and diffs a `ProviderComparison`
 * URL-aware: same relativeUrl = update, different relativeUrl = delete + create
 *
 * @param left The left map of subscriptions.
 * @param right The right map of subscriptions.
 * @returns A diff of the two maps.
 */
function matchAndDiff<P extends Provider>({
    left,
    right,
}: ProviderComparison<P>) {
    const steps: Set<Step<P>> = new Set()

    type LeftEntry = [EndpointHandle, EndpointState<P>]
    const leftCopy: LeftEntry[] = Array.from(left.entries())
    const rightCopy = right.slice()
    const rightUsed = new Set<number>()

    // Step 1: Remove exact matches (same URL + same events + same config)
    for (let il = leftCopy.length - 1; il >= 0; il--) {
        const entry = leftCopy[il]!
        const [, leftState] = entry
        for (let ir = 0; ir < rightCopy.length; ir++) {
            if (rightUsed.has(ir)) continue
            const rightState = rightCopy[ir]!
            if (
                leftState.relativeUrl === rightState.relativeUrl &&
                isDeepStrictEqual(leftState, rightState)
            ) {
                leftCopy.splice(il, 1)
                rightUsed.add(ir)
                break
            }
        }
    }

    // Step 2: Find URL matches (same relativeUrl, different events/config) → update
    for (let il = leftCopy.length - 1; il >= 0; il--) {
        const entry = leftCopy[il]!
        const [handle, leftState] = entry
        const matchIdx = rightCopy.findIndex(
            (r, ir) =>
                !rightUsed.has(ir) && r.relativeUrl === leftState.relativeUrl,
        )
        if (matchIdx !== -1) {
            const rightState = rightCopy[matchIdx]!
            steps.add({
                kind: 'update',
                handle,
                state: rightState,
            } as UpdateStep<P>)
            leftCopy.splice(il, 1)
            rightUsed.add(matchIdx)
        }
    }

    // Step 3: Remaining left items → delete (new URL, removed)
    for (const entry of leftCopy) {
        const [handle] = entry
        steps.add({
            kind: 'delete',
            handle,
        } as DeleteStep<P>)
    }

    // Step 4: Remaining right items → create (new URL, added)
    for (let ir = 0; ir < rightCopy.length; ir++) {
        if (rightUsed.has(ir)) continue
        steps.add({
            kind: 'create',
            state: rightCopy[ir],
        } as CreateStep<P>)
    }

    return steps
}

export {
    type Plan,
    type Step,
    type StepId,
    createStepId,
    type CreateStep,
    type DeleteStep,
    type UpdateStep,
    createPlan,
}
