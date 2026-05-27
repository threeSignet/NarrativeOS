import { Engine } from "./base";

const registry = new Map<string, new () => Engine>();

export function registerEngine(name: string, ctor: new () => Engine) {
  registry.set(name, ctor);
}

export function getEngine(name: string): Engine {
  const ctor = registry.get(name);
  if (!ctor) throw new Error(`Engine "${name}" not registered. Available: ${Array.from(registry.keys()).join(", ")}`);
  return new ctor();
}

export function listEngines(): string[] {
  return Array.from(registry.keys());
}
