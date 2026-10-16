"use client";

import { Header } from "./Header";

/** Terminal layout: header above the titled panels. */
export function Dashboard() {
  return (
    <div className="flex h-screen min-w-[1024px] flex-col bg-surface text-text">
      <Header />
      <div className="min-h-0 flex-1" />
    </div>
  );
}
