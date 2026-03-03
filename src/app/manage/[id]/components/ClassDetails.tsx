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
  UserMinus,
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
          <h2 className="text-2xl font-bold text-white">
            {selectedClass.name}
          </h2>
          {selectedClass.description && (
            <p className="text-white/60 mt-1">
              {selectedClass.description}
            </p>
          )}
          <p className="text-sm text-white/40 mt-2">
            Created {new Date(selectedClass.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onToggleActive(selectedClass.id, selectedClass.isActive)}
            variant="ghost"
            size="sm"
            className={selectedClass.isActive ? 'text-green-400' : 'text-yellow-400'}
          >
            {selectedClass.isActive ? (
              <ToggleRight className="h-5 w-5 mr-2" />
            ) : (
              <ToggleLeft className="h-5 w-5 mr-2" />
            )}
            {selectedClass.isActive ? 'Active' : 'Inactive'}
          </Button>
          <Button
            onClick={() => onDelete(selectedClass.id)}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Members section */}
      <Card className="bg-black/50 backdrop-blur-lg border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">
              Members ({selectedClass.members.length})
            </CardTitle>
            <CardDescription>
              Students enrolled in this class can access the experience
            </CardDescription>
          </div>
          {selectedClass.members.length > 0 && (
            <Button
              onClick={onAddMembers}
              variant="custom"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Members
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {selectedClass.members.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No members yet</p>
              <p className="text-sm mb-6">Add student email addresses to give them access</p>
              <Button
                onClick={onAddMembers}
                variant="custom"
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-8 py-3 shadow-lg"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Add Members
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedClass.members.map((member: ClassMember) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between p-3 rounded-lg bg-black/30"
                >
                  <div>
                    <span className="text-white">{member.email}</span>
                    <span className="text-white/40 text-sm ml-2">
                      Added {new Date(member.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    onClick={() => onRemoveMember(member.email)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                  >
                    <UserMinus className="h-4 w-4" />
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

