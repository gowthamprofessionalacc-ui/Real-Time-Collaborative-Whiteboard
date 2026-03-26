"use client";

// =============================================================
// USER LIST — Shows who's currently in the room
// =============================================================
// Displays connected users with their assigned colors.
// This helps users know who they're collaborating with.

interface User {
  socketId: string;
  userName: string;
  color: string;
}

interface Props {
  users: User[];
  isConnected: boolean;
  myColor: string;
  userName: string;
}

export default function UserList({ users, isConnected, myColor, userName }: Props) {
  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <p className="text-xs font-semibold text-gray-500 uppercase">
          {isConnected ? "Online" : "Offline"}
        </p>
      </div>
      <div className="space-y-1">
        {/* Show yourself first */}
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: myColor }}
          />
          <span className="text-xs text-gray-600">{userName} (you)</span>
        </div>
        {/* Other users */}
        {users
          .filter((u) => u.userName !== userName)
          .map((user) => (
            <div key={user.socketId} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: user.color }}
              />
              <span className="text-xs text-gray-600">{user.userName}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
