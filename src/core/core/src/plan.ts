import { isDeepStrictEqual } from 'util'
import { err, ok, Result } from 'neverthrow'
import { State } from './state.js'
import { Provider, EndpointState, EndpointIndex } from './provider.js'
import { BaseUrl } from './url.js'
import { ProviderSet } from './provider-set.js'
import {
    downcastEndpointHandle,
    endpointHandleIsOrphan,
    EndpointHandleReal,
} from './endpoint-handle.js'

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
type Plan<P extends ProviderSet> = {
    baseUrl: BaseUrl
    providers: P
    providerPlans: {
        [K in keyof P]: Map<StepId, Step<P[K]>>
    }
    /**
     * @returns the `Step` corresponding to `id`
     */
    getStepById(id: StepId): Result<Step<P[keyof P]>, Error>
    /**
     * @returns `StepId`s in this `Plan`
     */
    getStepIds(): StepId[]
    /**
     * @returns if there are no steps in the `Plan`
     */
    isEmpty(): boolean
}

export type PlanError = InvalidOrphanEndpointHandleError

export interface InvalidOrphanEndpointHandleError extends Error {
    name: 'InvalidOrphanEndpointHandleError'
    message: string
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
    handle: EndpointHandleReal
    __phantom?: P
}

/**
 * A planned action to update an event from its current `eventParams` to `eventParams`.
 */
type UpdateStep<P extends Provider> = {
    kind: 'update'
    handle: EndpointHandleReal
    state: EndpointState<P>
}

/**
 * Creates a `Plan` for updating a state from one state to another.
 *
 * @param left The left state.
 * @param right The right state.
 * @returns A `Plan` for updating the left state to the right state.
 */
function createPlan<L extends State<ProviderSet>, R extends State<ProviderSet>>(
    left: L,
    right: R,
): Result<Plan<ProviderSet>, PlanError> {
    const comparison = createComparison(left, right)
    const providers = comparison.providers // Merged providers
    const providerPlans: Plan<ProviderSet>['providerPlans'] = {}
    let idCounter = 0

    for (const [providerKey, providerComparison] of Object.entries(
        comparison.providerComparisons,
    )) {
        providerPlans[providerKey] = new Map()
        const steps = matchAndDiff(providerComparison)
        if (steps.isErr()) {
            return err(steps.error)
        }

        for (const step of steps.value) {
            const id = createStepId(idCounter++)
            providerPlans[providerKey].set(id, step)
        }
    }

    return ok({
        baseUrl: right.baseUrl,
        providers,
        providerPlans,
        getStepById: (id: StepId) => getStepAndProviderById(providerPlans, id).map(r => r.step),
        getStepIds: getStepIds(providerPlans),
        isEmpty: () => getStepIds(providerPlans)().length === 0,
    })
}

const getStepAndProviderById =
    <P extends ProviderSet>(providerPlans: Plan<P>['providerPlans'], id: StepId) => {
        let existing = 0
        let step: Step<Provider> | undefined = undefined
        let provider: string | undefined
        for (const e of Object.entries(providerPlans)) {
            const [providerName, providerPlan] = e as [string, Map<StepId, Step<Provider>>] // Typescript!!!!
            const s = providerPlan.get(id)
            if (s) {
                step = s
                provider = providerName
                existing++
            }
        }

        if (existing > 1) {
            return err(new Error(`more than one step shares id ${id}`))
        } else if (existing < 1 || step == undefined) {
            return err(new Error(`no step found by id ${id}`))
        }

        return ok({ step, provider: provider! })
    }

const getStepIds =
    <P extends ProviderSet>(providerPlans: Plan<P>['providerPlans']) =>
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
type Comparison<P extends ProviderSet> = {
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
    right: EndpointIndex<P>
}

/**
 * @param left The left state.
 * @param right The right state.
 * @returns A `Comparison` of left and right.
 */
function createComparison<
    L extends State<ProviderSet>,
    R extends State<ProviderSet>,
>(left: L, right: R): Comparison<ProviderSet> {
    const providers = mergeProviders(left.providers, right.providers)
    const providerComparisons: Comparison<
        typeof providers
    >['providerComparisons'] = {}

    for (const [leftProviderKey, leftEndpointIndex] of Object.entries(
        left.providerStates,
    )) {
        providerComparisons[leftProviderKey] = {
            left: new Map(leftEndpointIndex.entries()),
            right: new Map(),
        }
    }

    for (const [rightProviderKey, rightEndpointIndex] of Object.entries(
        right.providerStates,
    )) {
        if (!providerComparisons[rightProviderKey]) {
            providerComparisons[rightProviderKey] = {
                left: new Map(),
                right: new Map(rightEndpointIndex.entries()),
            }
        } else {
            providerComparisons[rightProviderKey].right = new Map(
                rightEndpointIndex.entries(),
            )
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
function mergeProviders<L extends ProviderSet, R extends ProviderSet>(
    left: L,
    right: R,
): ProviderSet {
    const merged: ProviderSet = left
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
}: ProviderComparison<P>): Result<Set<Step<P>>, PlanError> {
    const steps: Set<Step<P>> = new Set()

    for (const [leftHandle, leftState] of left) {
        const realHandle = downcastEndpointHandle(leftHandle)
        if (realHandle == undefined) {
            return err({
                name: 'InvalidOrphanEndpointHandleError',
                message: 'left state contains an orphan endpoint handle',
            } satisfies InvalidOrphanEndpointHandleError)
        }

        const rightState = right.get(leftHandle)
        if (rightState) {
            if (!isDeepStrictEqual(leftState, rightState)) {
                steps.add({
                    kind: 'update',
                    handle: realHandle,
                    state: rightState,
                } satisfies UpdateStep<P>)
            } // else nothing, the endpoints are identical between left & right
        } else {
            // If it's in the left, but not the right, delete
            steps.add({
                kind: 'delete',
                handle: realHandle,
            } satisfies DeleteStep<P>)
        }
    }

    for (const [rightHandle, rightState] of right) {
        if (!endpointHandleIsOrphan(rightHandle)) {
            continue
        }
        // TODO assert that left shouldn't have this one
        steps.add({
            kind: 'create',
            state: rightState,
        } satisfies CreateStep<P>)
    }

    return ok(steps)
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
