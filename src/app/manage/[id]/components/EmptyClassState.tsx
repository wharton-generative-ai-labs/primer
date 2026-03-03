import React from 'react';
import { Users } from "lucide-react";

export function EmptyClassState() {
  return (
    <div className="flex items-center justify-center h-full text-white/50">
      <div className="text-center">
        <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg">Select a class to view details</p>
        <p className="text-sm mt-1">or create a new class to get started</p>
      </div>
    </div>
  );
}

