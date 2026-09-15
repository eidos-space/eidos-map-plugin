import { describe, expect, it } from "vitest"
import { coordinate, longitudeBounds, unwrapRing } from "./coordinates"
describe("map coordinates", () => {
  it("does not draw Fiji and Russia polygon edges across the whole map", () => {
    expect(
      unwrapRing([
        [179, 70],
        [-180, 71],
        [179, 70],
      ])
    ).toEqual([
      [179, 70],
      [180, 71],
      [179, 70],
    ])
  })
  it("preserves zero, accepts numeric strings and rejects missing or invalid values", () => {
    expect(coordinate(0, 90)).toBe(0)
    expect(coordinate(" 31.23 ", 90)).toBe(31.23)
    for (const value of [
      null,
      undefined,
      "",
      " ",
      true,
      [],
      Infinity,
      "north",
      91,
    ])
      expect(coordinate(value, 90)).toBeNull()
  })
  it("fits across the date line rather than spanning the whole world", () => {
    expect(longitudeBounds([179, -179])).toEqual([179, 181])
    expect(longitudeBounds([121, 120])).toEqual([120, 121])
    expect(longitudeBounds([-74])).toEqual([-74, -74])
  })
})
