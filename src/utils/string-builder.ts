type StringBuilderInput =
  | string
  | boolean
  | null
  | undefined
  | { [key: string]: boolean }
  | StringBuilderInput[];

/**
 * A utility for conditionally building strings, inspired by clsx
 *
 * @example
 * stringBuilder(
 *   "Base text\n",
 *   condition && "Conditional text\n",
 *   { "Text if true\n": booleanValue, "Text if false\n": !booleanValue },
 *   ["Multiple", " strings", condition && " conditionally"]
 * )
 */
export function stringBuilder(...inputs: StringBuilderInput[]): string {
  const result: string[] = [];

  function processInput(input: StringBuilderInput) {
    if (!input) return;

    if (typeof input === "string") {
      result.push(input);
    } else if (Array.isArray(input)) {
      input.forEach(processInput);
    } else if (typeof input === "object") {
      Object.entries(input).forEach(([text, condition]) => {
        if (condition) {
          result.push(text);
        }
      });
    }
  }

  inputs.forEach(processInput);
  return result.join("");
}

/**
 * Utility for building multi-line strings with proper spacing
 */
export function lines(...strings: (string | boolean | null | undefined)[]): string {
  return (
    strings.filter((s): s is string => Boolean(s) && typeof s === "string").join("\n") + "\n\n"
  );
}

/**
 * Utility for building bullet points
 */
export function bullets(...items: (string | boolean | null | undefined)[]): string {
  return (
    items
      .filter((s): s is string => Boolean(s) && typeof s === "string")
      .map((item) => `- ${item}`)
      .join("\n") + "\n\n"
  );
}
