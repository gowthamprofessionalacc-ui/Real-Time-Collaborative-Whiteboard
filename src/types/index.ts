// =============================================================
// ELEMENT TYPES — The data model for everything on the canvas
// =============================================================
//
// WHY DISCRIMINATED UNIONS?
// -------------------------
// Each shape type has different properties:
//   - Rectangle needs width, height
//   - Circle needs radius
//   - FreeDraw needs an array of points
//   - Text needs text content and fontSize
//
// By using a `type` field as the discriminator, TypeScript can
// narrow the type automatically:
//
//   if (element.type === "rectangle") {
//     element.width  // ✅ TypeScript knows this exists
//     element.radius // ❌ TypeScript error — rectangles don't have radius
//   }
//
// ALTERNATIVE APPROACHES:
//   1. Single flat type with all optional fields — messy, no type safety
//   2. Class hierarchy (OOP) — works but doesn't play well with React state
//   3. Discriminated unions (what we use) — best for React + TypeScript

export type Tool =
  | "select"
  | "rectangle"
  | "circle"
  | "freehand"
  | "text"
  | "sticky-note";

// Base properties shared by ALL elements
interface BaseElement {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface RectangleElement extends BaseElement {
  type: "rectangle";
  width: number;
  height: number;
}

export interface CircleElement extends BaseElement {
  type: "circle";
  radius: number;
}

export interface FreeDrawElement extends BaseElement {
  type: "freehand";
  // Points stored as flat array: [x1, y1, x2, y2, x3, y3, ...]
  // WHY flat array? Konva's <Line> expects this format.
  // Alternative: Array of {x, y} objects — more readable but requires
  // conversion every render, which hurts performance with 1000s of points.
  points: number[];
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  width: number;
}

export interface StickyNoteElement extends BaseElement {
  type: "sticky-note";
  text: string;
  width: number;
  height: number;
}

// The union — an Element is ONE of these types
export type BoardElement =
  | RectangleElement
  | CircleElement
  | FreeDrawElement
  | TextElement
  | StickyNoteElement;

// For undo/redo: we store snapshots of the elements array
// WHY snapshots over command pattern for now?
// - Simpler to implement
// - Command pattern is better when you have complex operations
//   (like grouping, layer reordering) but for MVP, snapshots work great
// - We can upgrade to command pattern later when adding collaboration
// TRADEOFF: Uses more memory (stores full state copies)
//   but for boards with <10k elements, this is negligible
export type HistoryEntry = BoardElement[];
