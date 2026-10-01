import { fold } from "./home";
import type { SkillGroup } from "./types";

/** Groups restricted to the skills whose name, summary and description contain every word of the query; empty groups dropped. */
export function filterSkills(groups: SkillGroup[], query: string): SkillGroup[] {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups
    .map((g) => ({
      ...g,
      skills: g.skills.filter((s) => {
        const text = fold(`${s.name} ${s.summary} ${s.description}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((g) => g.skills.length);
}

/** Detail page URL; ids hold "/" and ":" (plugin:superpowers/brainstorming), each segment is encoded. */
export const skillLink = (id: string) => "/skills/" + id.split("/").map(encodeURIComponent).join("/");
