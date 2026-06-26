"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/config/auth";

interface UserDialogUser {
  email: string;
  roles: RoleKey[];
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: UserDialogUser | null;
  availableRoles: RoleKey[];
  isSaving: boolean;
  onSubmit: (input: { email: string; roles: RoleKey[] }) => Promise<void> | void;
}

export function UserDialog({
  open,
  onOpenChange,
  editingUser,
  availableRoles,
  isSaving,
  onSubmit,
}: UserDialogProps) {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<RoleKey[]>([]);

  useEffect(() => {
    if (!open) return;
    setEmail(editingUser?.email ?? "");
    setRoles(editingUser ? [...editingUser.roles] : []);
  }, [open, editingUser]);

  const toggleRole = (role: RoleKey) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ email: email.trim(), roles });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
          <DialogDescription>
            {editingUser
              ? "Update the role assignments for this user."
              : "Enter the email address and select roles for the new user."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">Email address</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={!!editingUser || isSaving}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div
              role="group"
              aria-label="Roles"
              className="grid grid-cols-2 gap-2"
            >
              {availableRoles.map((role) => {
                const selected = roles.includes(role);
                return (
                  <Button
                    key={role}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                    disabled={isSaving}
                    aria-pressed={selected}
                    className={cn("justify-between", !selected && "text-muted-foreground")}
                  >
                    <span>{role}</span>
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </Button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingUser ? "Save Changes" : "Add User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
