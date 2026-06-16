import { run as runTui, type TuiInput } from "@vrax/tui"
import { Global } from "@vrax/core/global"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(Global.defaultLayer))
}
