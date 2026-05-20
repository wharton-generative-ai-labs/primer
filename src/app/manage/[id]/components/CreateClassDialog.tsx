import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  classDescription: string;
  onClassNameChange: (name: string) => void;
  onClassDescriptionChange: (description: string) => void;
  onCreate: () => void;
}

export function CreateClassDialog({
  open,
  onOpenChange,
  className,
  classDescription,
  onClassNameChange,
  onClassDescriptionChange,
  onCreate
}: CreateClassDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Class</AlertDialogTitle>
          <AlertDialogDescription>
            Create a class to organize students who will have access to this experience.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="className">Class Name *</Label>
            <Input
              id="className"
              value={className}
              onChange={(e) => onClassNameChange(e.target.value)}
              placeholder="e.g., Fall 2025 Physics 101"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="classDescription">Description (optional)</Label>
            <Textarea
              id="classDescription"
              value={classDescription}
              onChange={(e) => onClassDescriptionChange(e.target.value)}
              placeholder="Brief description of this class"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onCreate}>
            Create Class
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

