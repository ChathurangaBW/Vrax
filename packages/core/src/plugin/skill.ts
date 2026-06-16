/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { Effect } from "effect"
import { PluginV2 } from "../plugin"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeVraxContent from "./skill/customize-vrax.md" with { type: "text" }

export const CustomizeOpencodeContent = customizeVraxContent

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const transform = yield* skill.transform()

    yield* transform((editor) => {
      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-vrax",
            description:
              "Use ONLY when the user is editing or creating Vrax's own configuration: vrax.json, vrax.jsonc, files under .vrax/, or files under ~/.config/vrax/. Also use when creating or fixing Vrax agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring Vrax itself.",
            location: AbsolutePath.make("/builtin/customize-vrax.md"),
            content: CustomizeOpencodeContent,
          }),
        }),
      )
    })
  }),
})
