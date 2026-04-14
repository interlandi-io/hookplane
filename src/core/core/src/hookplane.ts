import { ProviderSet } from "./provider-set.js";
import { StateUnknown } from "./state.js";

export type Hookplane = {
    state: StateUnknown<ProviderSet>,
}
