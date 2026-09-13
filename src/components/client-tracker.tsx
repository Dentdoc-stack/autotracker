"use client";

import dynamic from "next/dynamic";

const Tracker = dynamic(() => import("./tracker"), { ssr: false });

export default function ClientTracker() {
  return <Tracker />;
}
