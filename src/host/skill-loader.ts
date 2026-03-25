import fs from "fs";
import path from "path";

interface Skill {
  name: string;
  trigger: string;
  description: string;
  tools: string[];
  prompt: string;
}

export function loadSkills(): Skill[] {
  const skillsRoot = path.resolve(process.cwd(), "skills");
  if (!fs.existsSync(skillsRoot)) return [];

  const names = fs.readdirSync(skillsRoot).filter((name) => {
    const full = path.join(skillsRoot, name);
    return fs.statSync(full).isDirectory();
  });

  return names.map((name) => {
    const configPath = path.join(skillsRoot, name, "config.json");
    const promptPath = path.join(skillsRoot, name, "skill.md");

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const prompt = fs.readFileSync(promptPath, "utf8");

    return {
      ...config,
      prompt,
    };
  });
}
