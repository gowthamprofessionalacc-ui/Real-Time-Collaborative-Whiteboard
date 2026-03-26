"use client";

// =============================================================
// MAIN PAGE — Where toolbar and canvas come together
// =============================================================
//
// WHY dynamic() WITH ssr: false?
// ----------------------------------
// Konva uses browser APIs: window, document, HTMLCanvasElement.
// Next.js tries to render pages on the server first (Server-Side Rendering).
// The server has NO browser APIs → Konva would crash.
//
// dynamic() with { ssr: false } tells Next.js:
//   "Don't try to render this on the server.
//    Wait until the browser loads, then render it."
//
// This is called "lazy loading" or "client-only rendering."
//
// ALTERNATIVE APPROACH:
// You could make the entire page "use client" and use useEffect
// to wait for mount. But dynamic() is cleaner and is the
// Next.js-recommended pattern.

import dynamic from "next/dynamic";
import Toolbar from "@/components/Toolbar";

// Load Canvas only in the browser (not during server-side rendering)
const Canvas = dynamic(() => import("@/components/Canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <p className="text-gray-400">Loading canvas...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left sidebar — tools and settings */}
      <Toolbar />

      {/* Main canvas area — takes remaining space */}
      <Canvas />
    </div>
  );
}
