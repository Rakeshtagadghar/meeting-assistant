import type {
  AISummaryKind,
  JsonValue,
  SummaryPayload,
  ActionItemsPayload,
  DecisionsPayload,
  RisksPayload,
  KeyPointsPayload,
} from "./types";

export function isValidConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function isSummaryPayload(value: unknown): value is SummaryPayload {
  if (!isObject(value)) return false;
  return (
    typeof value["title"] === "string" &&
    Array.isArray(value["bullets"]) &&
    value["bullets"].every((b: unknown) => typeof b === "string") &&
    typeof value["oneLiner"] === "string"
  );
}

export function isActionItemsPayload(
  value: unknown,
): value is ActionItemsPayload {
  if (!isObject(value)) return false;
  if (!Array.isArray(value["items"])) return false;

  return value["items"].every((item: unknown) => {
    if (!isObject(item)) return false;
    if (typeof item["text"] !== "string") return false;
    if (typeof item["confidence"] !== "number") return false;
    if (!isValidConfidence(item["confidence"])) return false;
    if (item["owner"] !== null && typeof item["owner"] !== "string")
      return false;
    if (item["due"] !== null && typeof item["due"] !== "string") return false;
    return true;
  });
}

export function isDecisionsPayload(value: unknown): value is DecisionsPayload {
  if (!isObject(value)) return false;
  return isStringArray(value["decisions"]);
}

export function isRisksPayload(value: unknown): value is RisksPayload {
  if (!isObject(value)) return false;
  return isStringArray(value["risks"]);
}

export function isKeyPointsPayload(value: unknown): value is KeyPointsPayload {
  if (!isObject(value)) return false;
  return (
    isStringArray(value["keyPoints"]) && typeof value["oneLiner"] === "string"
  );
}

function validateSummary(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (typeof payload["title"] !== "string") {
    errors.push("SUMMARY: missing or invalid 'title'");
  }

  if (!Array.isArray(payload["bullets"])) {
    errors.push("SUMMARY: missing or invalid 'bullets'");
  } else if (payload["bullets"].length === 0) {
    errors.push("SUMMARY: 'bullets' must not be empty");
  } else if (!payload["bullets"].every((b: unknown) => typeof b === "string")) {
    errors.push("SUMMARY: 'bullets' must contain only strings");
  }

  if (typeof payload["oneLiner"] !== "string") {
    errors.push("SUMMARY: missing or invalid 'oneLiner'");
  }

  return errors;
}

function validateActionItems(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!Array.isArray(payload["items"])) {
    errors.push("ACTION_ITEMS: missing or invalid 'items'");
    return errors;
  }

  payload["items"].forEach((item: unknown, index: number) => {
    if (!isObject(item)) {
      errors.push(
        `ACTION_ITEMS: item at index ${String(index)} is not an object`,
      );
      return;
    }
    if (typeof item["text"] !== "string") {
      errors.push(
        `ACTION_ITEMS: item at index ${String(index)} missing 'text'`,
      );
    }
    if (
      typeof item["confidence"] !== "number" ||
      !isValidConfidence(item["confidence"])
    ) {
      errors.push(
        `ACTION_ITEMS: item at index ${String(index)} has invalid 'confidence'`,
      );
    }
  });

  return errors;
}

function validateDecisions(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!Array.isArray(payload["decisions"])) {
    errors.push("DECISIONS: missing or invalid 'decisions'");
  } else if (
    !payload["decisions"].every((d: unknown) => typeof d === "string")
  ) {
    errors.push("DECISIONS: 'decisions' must contain only strings");
  }

  return errors;
}

function validateRisks(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!Array.isArray(payload["risks"])) {
    errors.push("RISKS: missing or invalid 'risks'");
  } else if (!payload["risks"].every((r: unknown) => typeof r === "string")) {
    errors.push("RISKS: 'risks' must contain only strings");
  }

  return errors;
}

function validateKeyPoints(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!Array.isArray(payload["keyPoints"])) {
    errors.push("KEY_POINTS: missing or invalid 'keyPoints'");
  } else if (
    !payload["keyPoints"].every((k: unknown) => typeof k === "string")
  ) {
    errors.push("KEY_POINTS: 'keyPoints' must contain only strings");
  }

  if (typeof payload["oneLiner"] !== "string") {
    errors.push("KEY_POINTS: missing or invalid 'oneLiner'");
  }

  return errors;
}

export function validateSummaryPayload(
  kind: AISummaryKind,
  payload: JsonValue,
): { valid: boolean; errors: string[] } {
  if (!isObject(payload)) {
    return { valid: false, errors: [`${kind}: payload must be an object`] };
  }

  const p = payload as Record<string, unknown>;

  let errors: string[];

  switch (kind) {
    case "SUMMARY":
      errors = validateSummary(p);
      break;
    case "ACTION_ITEMS":
      errors = validateActionItems(p);
      break;
    case "DECISIONS":
      errors = validateDecisions(p);
      break;
    case "RISKS":
      errors = validateRisks(p);
      break;
    case "KEY_POINTS":
      errors = validateKeyPoints(p);
      break;
  }

  return { valid: errors.length === 0, errors };
}
