export const INTEGER_TOKEN_RE = /^-?\d+$/
export const NUMBER_TOKEN_RE = /^-?\d+(\.\d+)?$/
export const HEX_COLOR_RE = /^#[\da-fA-F]{6}$/

export function isValidInteger(value: string): boolean {
  return INTEGER_TOKEN_RE.test(value)
}

export function isValidNumber(value: string): boolean {
  return NUMBER_TOKEN_RE.test(value)
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value)
}

export function parseNumber(value: string): number | null {
  if (!isValidNumber(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseInteger(value: string): number | null {
  if (!isValidInteger(value)) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
