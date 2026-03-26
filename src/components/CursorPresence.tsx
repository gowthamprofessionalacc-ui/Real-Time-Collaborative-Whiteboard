"use client";

import { Circle, Group, Text } from "react-konva";

// =============================================================
// CURSOR PRESENCE — Show where other users are pointing
// =============================================================
//
// HOW LIVE CURSORS WORK:
//
// 1. User A moves their mouse on the canvas
// 2. Every ~50ms, their cursor position is sent to the server
// 3. Server broadcasts to all other users in the room
// 4. This component renders a colored dot + name label for each remote cursor
//
// WHY IS THIS IMPORTANT?
// Without cursors, you'd have "invisible" collaboration:
// - You see shapes appearing but don't know WHO is doing WHAT
// - Two people might try to edit the same area
// - No sense of "presence" — feels like editing alone
//
// With cursors (like Figma):
// - You can see where everyone is working
// - Natural turn-taking: "Oh, they're working on that section"
// - Feels alive and collaborative
//
// PERFORMANCE NOTE:
// Cursors update ~20 times per second per user. With 10 users,
// that's 200 updates/sec. We use Konva (Canvas) instead of DOM
// elements because Canvas can handle this without layout thrashing.
//
// ALTERNATIVE: CSS-positioned <div> elements for each cursor.
// Works fine for 2-3 users, but starts lagging with many users
// because the browser has to recalculate layout for each update.

interface Props {
  cursors: Map<string, { x: number; y: number; userName: string; color: string }>;
}

export default function CursorPresence({ cursors }: Props) {
  return (
    <>
      {Array.from(cursors.entries()).map(([socketId, cursor]) => (
        <Group key={socketId} x={cursor.x} y={cursor.y}>
          {/* Cursor dot */}
          <Circle
            radius={5}
            fill={cursor.color}
            opacity={0.9}
          />
          {/* User name label */}
          <Text
            x={10}
            y={-8}
            text={cursor.userName}
            fontSize={11}
            fill="#fff"
            padding={3}
            // Background behind the name
            // Konva Text doesn't have native background, so we use
            // a fill on a Rect. But for simplicity, we'll use the
            // text's own background support (Konva does support it).
          />
          {/* Background rect behind name */}
          <Circle
            x={0}
            y={0}
            radius={3}
            fill={cursor.color}
          />
        </Group>
      ))}
    </>
  );
}
