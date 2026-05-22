export type TemplatePayload = Record<string, string>;

const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

export function renderArgs(argsTemplate: string[], payload: TemplatePayload): string[] {
  return argsTemplate.map((arg) =>
    arg.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        return match;
      }

      const value = payload[key];
      return value === undefined ? match : value;
    })
  );
}
