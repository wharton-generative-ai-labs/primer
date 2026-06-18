import React from 'react';
import { Users } from "lucide-react";
import { ClassSummary } from "@/app/lib/types";

interface ClassListProps {
  classes: ClassSummary[];
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
}

export function ClassList({ classes, selectedClassId, onSelectClass }: ClassListProps) {
  return (
    <div className="w-80 border-r border-border bg-card overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Classes ({classes.length})
        </h2>
        {classes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No classes yet</p>
            <p className="text-sm mt-1">Create a class to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => onSelectClass(cls.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedClassId === cls.id
                    ? 'bg-accent border border-border'
                    : 'bg-secondary hover:bg-accent border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground truncate">
                    {cls.name}
                  </span>
                  {!cls.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{cls.memberCount} members</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

