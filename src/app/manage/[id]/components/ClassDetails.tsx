import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Trash2,
  UserPlus,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Class, ClassMember } from "@/app/lib/types";

interface ClassDetailsProps {
  selectedClass: Class;
  onToggleActive: (classId: string, currentlyActive: boolean) => void;
  onDelete: (classId: string) => void;
  onAddMembers: () => void;
  onRemoveMember: (email: string) => void;
}

export function ClassDetails({
  selectedClass,
  onToggleActive,
  onDelete,
  onAddMembers,
  onRemoveMember
}: ClassDetailsProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl font-bold text-brand">
            {selectedClass.name}
          </h2>
          {selectedClass.description && (
            <p className="text-muted-foreground mt-1">
              {selectedClass.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Created {new Date(selectedClass.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onToggleActive(selectedClass.id, selectedClass.isActive)}
            variant="outline"
            className={selectedClass.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          >
            {selectedClass.isActive ? (
              <ToggleRight className="size-5" />
            ) : (
              <ToggleLeft className="size-5" />
            )}
            {selectedClass.isActive ? 'Active' : 'Inactive'}
          </Button>
          <Button
            onClick={() => onDelete(selectedClass.id)}
            variant="ghost"
            className="text-rose-800 hover:text-rose-800 dark:text-rose-200 dark:hover:text-rose-200 hover:bg-rose-100 bg-background dark:hover:bg-rose-900"
          >
            <Trash2 className="size-5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Members section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold leading-7">
              Members ({selectedClass.members.length})
            </CardTitle>
            <CardDescription className="text-base leading-6">
              Students enrolled in this class can access the experience
            </CardDescription>
          </div>
          {selectedClass.members.length > 0 && (
            <Button
              onClick={onAddMembers}
              size="sm"
            >
              <UserPlus className="size-5" />
              Add Members
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {selectedClass.members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2 text-foreground">No members yet</p>
              <p className="text-sm mb-6">Add student email addresses to give them access</p>
              <Button
                onClick={onAddMembers}
              >
                <UserPlus className="size-5" />
                Add Members
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedClass.members.map((member: ClassMember) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div>
                    <span className="text-foreground">{member.email}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      Added {new Date(member.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    onClick={() => onRemoveMember(member.email)}
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive "
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

