"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Edit3,
  Lock,
  Plus,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

import PrimerBackground from "@/app/components/PrimerBackground";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/app/hooks/usePermissions";
import { Permission, type RoleKey } from "@/config/auth";

import { DeleteUserDialog } from "./DeleteUserDialog";
import { RoleBadge } from "./RoleBadge";
import { UserDialog } from "./UserDialog";

interface UserInfo {
  email: string;
  roles: RoleKey[];
  source: "env" | "file";
  createdAt?: string;
  modifiedAt?: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { can, isAuthenticated } = usePermissions();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users");
      }

      setUsers(data.users || []);
      setAvailableRoles(data.availableRoles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [fetchUsers, isAuthenticated]);

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserDialog(true);
  };

  const handleEditUser = (user: UserInfo) => {
    setEditingUser(user);
    setShowUserDialog(true);
  };

  const handleSaveUser = async ({
    email,
    roles,
  }: {
    email: string;
    roles: RoleKey[];
  }) => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (roles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one role",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", email, roles }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save user");
      }

      toast({
        title: "Success",
        description: editingUser
          ? "User updated successfully"
          : "User created successfully",
      });

      setShowUserDialog(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save user",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", email: userToDelete }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      setShowDeleteDialog(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <PrimerBackground useInitialBackdrop footerType="modules">
        <div className="flex h-full items-center justify-center">
          <p className="text-foreground">Loading...</p>
        </div>
      </PrimerBackground>
    );
  }

  if (!can(Permission.ADMIN_USERS)) {
    return (
      <PrimerBackground useInitialBackdrop footerType="modules">
        <div className="flex h-full items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Access denied
              </CardTitle>
              <CardDescription>
                You do not have permission to access user administration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/">Return home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrimerBackground>
    );
  }

  if (error) {
    return (
      <PrimerBackground useInitialBackdrop footerType="modules">
        <div className="flex h-full items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/">Return home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrimerBackground>
    );
  }

  const envUsers = users.filter((u) => u.source === "env");
  const fileUsers = users.filter((u) => u.source === "file");

  return (
    <PrimerBackground useInitialBackdrop footerType="modules">
      <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-16">
        <header className="mb-8 px-6 pb-5 pt-1 text-center">
          <h1 className="font-serif text-3xl font-bold text-brand md:text-4xl">
            User Management
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-7 text-foreground">
            Manage administrator, instructor, and editor access for Primer.
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="tracking-tight text-lg font-semibold leading-7">
                Environment-defined users
              </CardTitle>
              <CardDescription className="text-base leading-6">
                These users are defined in the environment configuration and
                cannot be modified here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {
                isLoading ? (
                  <div className="space-y-3">
                    <div className="h-6 w-full shrink-0 animate-pulse rounded bg-muted" />
                    <div className="h-6 w-full shrink-0 animate-pulse rounded bg-muted" />
                  </div>
                ) : envUsers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No environment-defined users.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {envUsers.map((user) => (
                    <li
                      key={user.email}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Lock
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-foreground">
                          {user.email}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="tracking-tight text-lg font-semibold leading-7">
                  Managed users
                </CardTitle>
                <CardDescription className="text-base leading-6">
                  Users managed through this interface. You can add, edit, or
                  remove these users.
                </CardDescription>
              </div>
              <Button onClick={handleCreateUser} className="shrink-0">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {
                isLoading ? (
                  <div className="space-y-3">
                    <div className="h-10 w-full shrink-0 animate-pulse rounded bg-muted" />
                    <div className="h-10 w-full shrink-0 animate-pulse rounded bg-muted" />
                    <div className="h-10 w-full shrink-0 animate-pulse rounded bg-muted" />
                  </div>
                ) : fileUsers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Users
                      className="mx-auto mb-3 h-10 w-10 opacity-50"
                      aria-hidden="true"
                    />
                    <p className="text-foreground">No managed users yet</p>
                    <p className="mt-1 text-sm">
                      Click{" "}
                      <button
                        type="button"
                        onClick={handleCreateUser}
                        className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Add User
                      </button>{" "}
                      to create a user account.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {fileUsers.map((user) => (
                      <li
                        key={user.email}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {user.email}
                          </p>
                          {user.modifiedAt ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Modified: {new Date(user.modifiedAt).toLocaleString()}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {user.roles.map((role) => (
                              <RoleBadge key={role} role={role} />
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                            aria-label={`Edit ${user.email}`}
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setUserToDelete(user.email);
                              setShowDeleteDialog(true);
                            }}
                            className="text-rose-800 hover:text-rose-800 dark:hover:text-rose-200 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900"
                            aria-label={`Delete ${user.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              }
            </CardContent>
          </Card>
        </div>
      </div>

      <UserDialog
        open={showUserDialog}
        onOpenChange={(open) => {
          setShowUserDialog(open);
          if (!open) setEditingUser(null);
        }}
        editingUser={editingUser}
        availableRoles={availableRoles}
        isSaving={isSaving}
        onSubmit={handleSaveUser}
      />

      <DeleteUserDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setUserToDelete(null);
        }}
        email={userToDelete}
        isDeleting={isDeleting}
        onConfirm={handleDeleteUser}
      />
    </PrimerBackground>
  );
}
