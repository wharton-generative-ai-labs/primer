/**
 * Dialog components for the Experience Editor
 */

import React from 'react';
import path from 'path';
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

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UnsavedChangesDialog({ open, onOpenChange, onConfirm }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in the current file. Do you want to discard them and switch files?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay Here</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Switch Files
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDirectory: boolean;
  contextMenuPath: string | null;
  newName: string;
  onNewNameChange: (name: string) => void;
  onCreate: (path: string, isDirectory: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function CreateDialog({
  open,
  onOpenChange,
  isDirectory,
  contextMenuPath,
  newName,
  onNewNameChange,
  onCreate,
  inputRef
}: CreateDialogProps) {
  const handleCreate = () => {
    if (contextMenuPath && newName) {
      const newPath = path.join(contextMenuPath, newName);
      onCreate(newPath, isDirectory);
      onOpenChange(false);
      onNewNameChange('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New {isDirectory ? 'Folder' : 'File'}</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the name for the new {isDirectory ? 'folder' : 'file'}:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="newName">Name</Label>
          <Input
            id="newName"
            value={newName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewNameChange(e.target.value)}
            placeholder={`Enter ${isDirectory ? 'folder' : 'file'} name`}
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate}>
            Create
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDirectory: boolean;
  contextMenuPath: string | null;
  onDelete: (path: string, isDirectory: boolean) => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  isDirectory,
  contextMenuPath,
  onDelete
}: DeleteDialogProps) {
  const handleDelete = () => {
    if (contextMenuPath) {
      onDelete(contextMenuPath, isDirectory);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {isDirectory ? 'Folder' : 'File'}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <span className="font-bold">{contextMenuPath}</span>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextMenuPath: string | null;
  moveDestination: string;
  onMoveDestinationChange: (destination: string) => void;
  onMove: (sourcePath: string, destinationPath: string, isDirectory: boolean) => void;
}

export function MoveDialog({
  open,
  onOpenChange,
  contextMenuPath,
  moveDestination,
  onMoveDestinationChange,
  onMove
}: MoveDialogProps) {
  const handleMove = () => {
    if (contextMenuPath && moveDestination) {
      onMove(contextMenuPath, moveDestination, contextMenuPath.endsWith('/'));
      onOpenChange(false);
      onMoveDestinationChange('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move {contextMenuPath?.endsWith('/') ? 'Folder' : 'File'}</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the new path for {contextMenuPath}:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="moveDestination">New Path</Label>
          <Input
            id="moveDestination"
            value={moveDestination}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMoveDestinationChange(e.target.value)}
            placeholder="Enter new path"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleMove}>
            Move
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

