import {
  clamp,
  isValidHexColor,
  isValidInteger,
  isValidNumber,
  parseInteger,
  parseNumber,
} from "../../src/core"

describe("validation helpers", () => {
  test("validates integers, numbers, and hex colors", () => {
    expect(isValidInteger("42")).toBe(true)
    expect(isValidInteger("4.2")).toBe(false)
    expect(isValidNumber("-4.2")).toBe(true)
    expect(isValidHexColor("#1a2b3c")).toBe(true)
    expect(isValidHexColor("1a2b3c")).toBe(false)
  })

  test("parses numeric tokens safely", () => {
    expect(parseInteger("42")).toBe(42)
    expect(parseInteger("4.2")).toBeNull()
    expect(parseNumber("4.2")).toBe(4.2)
    expect(parseNumber("nope")).toBeNull()
  })

  test("clamps values", () => {
    expect(clamp(5, 1, 3)).toBe(3)
    expect(clamp(-1, 0, 10)).toBe(0)
  })
})
