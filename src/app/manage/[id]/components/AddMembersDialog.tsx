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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membersText: string;
  onMembersTextChange: (text: string) => void;
  onAdd: () => void;
}

export function AddMembersDialog({
  open,
  onOpenChange,
  membersText,
  onMembersTextChange,
  onAdd
}: AddMembersDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gray-900 border-white/20">
        <AlertDialogHeader>
          <AlertDialogTitle>Add Members</AlertDialogTitle>
          <AlertDialogDescription>
            Enter email addresses (one per line or comma-separated). These students will be able to access the experience.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="memberEmails">Email Addresses</Label>
          <Textarea
            id="memberEmails"
            value={membersText}
            onChange={(e) => onMembersTextChange(e.target.value)}
            placeholder="student1@school.edu&#10;student2@school.edu&#10;student3@school.edu"
            className="mt-1 font-mono text-sm"
            rows={6}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAdd}>
            Add Members
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

