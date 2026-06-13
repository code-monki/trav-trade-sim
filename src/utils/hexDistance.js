// Traveller hex grid distance using cube coordinate conversion.
//
// Hex codes are 4-char strings 'CCRR' where col and row are 1-based integers.
// Traveller uses odd-column-up offset: odd-numbered columns are shifted toward
// row 1 by half a hex relative to even columns.
//
// Derived from the Traveller neighbor rule:
//   odd-col (c,r): neighbors at (c±1, r) and (c±1, r-1)
//   even-col (c,r): neighbors at (c±1, r) and (c±1, r+1)
//
// Cube conversion: x = col, z = row - floor((col+1)/2), y = -x - z
// The key term is floor((col+1)/2), NOT floor(col/2) — the latter fails for
// odd-column adjacency.

export function hexDistance(hexA, hexB) {
  const colA = parseInt(hexA.slice(0, 2)), rowA = parseInt(hexA.slice(2, 4))
  const colB = parseInt(hexB.slice(0, 2)), rowB = parseInt(hexB.slice(2, 4))

  const zA = rowA - Math.floor((colA + 1) / 2)
  const yA = -colA - zA

  const zB = rowB - Math.floor((colB + 1) / 2)
  const yB = -colB - zB

  return Math.max(
    Math.abs(colA - colB),
    Math.abs(yA - yB),
    Math.abs(zA - zB),
  )
}
