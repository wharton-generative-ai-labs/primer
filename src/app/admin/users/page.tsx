"use client";

import React, { useState, useEffect, useCallback } from "react";
import PrimerBackground from '@/app/components/PrimerBackground';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/app/hooks/usePermissions";
import { Permission } from "@/config/auth";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Users, 
  Plus, 
  Trash2,
  Edit3,
  ArrowLeft,
  Shield,
  ShieldCheck,
  Lock,
  Loader2,
  Check,
  X
} from "lucide-react";

type RoleKey = 'PLAYER' | 'EDUCATOR' | 'EDITOR' | 'TESTER' | 'ADMIN' | 'ADD_MAGIC';

interface UserInfo {
  email: string;
  roles: RoleKey[];
  source: 'env' | 'file';
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
  
  // Create/Edit user dialog
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<RoleKey[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      
      setUsers(data.users || []);
      setAvailableRoles(data.availableRoles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [fetchUsers, isAuthenticated]);

  // Open dialog to create new user
  const handleCreateUser = () => {
    setEditingUser(null);
    setUserEmail("");
    setSelectedRoles([]);
    setShowUserDialog(true);
  };

  // Open dialog to edit existing user
  const handleEditUser = (user: UserInfo) => {
    setEditingUser(user);
    setUserEmail(user.email);
    setSelectedRoles([...user.roles]);
    setShowUserDialog(true);
  };

  // Toggle role selection
  const toggleRole = (role: RoleKey) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // Save user (create or update)
  const handleSaveUser = async () => {
    if (!userEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedRoles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one role",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          email: userEmail.trim(),
          roles: selectedRoles
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save user');
      }
      
      toast({
        title: "Success",
        description: editingUser ? "User updated successfully" : "User created successfully"
      });
      
      setShowUserDialog(false);
      fetchUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to save user',
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          email: userToDelete
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
      
      setShowDeleteDialog(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete user',
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Get role color for display
  const getRoleColor = (role: RoleKey): string => {
    switch (role) {
      case 'ADMIN': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'TESTER': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'EDUCATOR': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'EDITOR': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'PLAYER': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'ADD_MAGIC': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Check permissions before rendering
  if (!isAuthenticated) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <div className="text-white">Loading...</div>
        </div>
      </PrimerBackground>
    );
  }

  if (!can(Permission.ADMIN_USERS)) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <Card className="bg-black/50 backdrop-blur-lg border-red-500/50 max-w-md">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription className="text-white/70">
                You do not have permission to access user administration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => window.location.href = '/'}
                variant="custom"
              >
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrimerBackground>
    );
  }

  if (error) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <Card className="bg-black/50 backdrop-blur-lg border-red-500/50 max-w-md">
            <CardHeader>
              <CardTitle className="text-red-400">Error</CardTitle>
              <CardDescription className="text-white/70">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => window.location.href = '/'}
                variant="custom"
              >
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrimerBackground>
    );
  }

  const envUsers = users.filter(u => u.source === 'env');
  const fileUsers = users.filter(u => u.source === 'file');

  return (
    <PrimerBackground showOverlays={false} useInitialBackdrop={true}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="backdrop-blur-lg bg-black/50 border-b border-white/10">
          <div className="p-4">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    User Administration
                  </h1>
                  <p className="text-sm text-white/60">
                    Manage user accounts and role assignments
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCreateUser}
                variant="custom"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-xl">
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              </div>
            ) : (
              <>
                {/* Environment-Defined Users */}
                <Card className="bg-black/30 backdrop-blur-lg border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Lock className="h-5 w-5 text-amber-400" />
                      Environment-Defined Users
                      <span className="text-sm font-normal text-white/60 ml-2">
                        ({envUsers.length})
                      </span>
                    </CardTitle>
                    <CardDescription>
                      These users are defined in the environment configuration and cannot be modified here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {envUsers.length === 0 ? (
                      <p className="text-white/50 text-sm py-4 text-center">
                        No environment-defined users
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {envUsers.map((user) => (
                          <div 
                            key={user.email}
                            className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-amber-500/20"
                          >
                            <div className="flex items-center gap-3">
                              <Lock className="h-4 w-4 text-amber-400/70" />
                              <span className="text-white">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {user.roles.map(role => (
                                <span 
                                  key={role}
                                  className={`text-xs px-2 py-1 rounded border ${getRoleColor(role)}`}
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* File-Based Users */}
                <Card className="bg-black/30 backdrop-blur-lg border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-400" />
                      Managed Users
                      <span className="text-sm font-normal text-white/60 ml-2">
                        ({fileUsers.length})
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Users managed through this interface. You can add, edit, or remove these users.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {fileUsers.length === 0 ? (
                      <div className="text-center py-8 text-white/50">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No managed users yet</p>
                        <p className="text-sm mt-1">Click &quot;Add User&quot; to create a user account</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fileUsers.map((user) => (
                          <div 
                            key={user.email}
                            className="flex items-center justify-between p-3 rounded-lg bg-black/20"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-white">{user.email}</span>
                              </div>
                              {user.modifiedAt && (
                                <p className="text-xs text-white/40 mt-1">
                                  Modified: {new Date(user.modifiedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                {user.roles.map(role => (
                                  <span 
                                    key={role}
                                    className={`text-xs px-2 py-1 rounded border ${getRoleColor(role)}`}
                                  >
                                    {role}
                                  </span>
                                ))}
                              </div>
                              <Button
                                onClick={() => handleEditUser(user)}
                                variant="ghost"
                                size="sm"
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setUserToDelete(user.email);
                                  setShowDeleteDialog(true);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit User Dialog */}
      <AlertDialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <AlertDialogContent className="bg-gray-900 border-white/20 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingUser ? 'Edit User' : 'Add User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingUser 
                ? 'Update the role assignments for this user.'
                : 'Enter the email address and select roles for the new user.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="userEmail">Email Address</Label>
              <Input
                id="userEmail"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1"
                disabled={!!editingUser}
              />
            </div>
            <div>
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableRoles.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`flex items-center justify-between p-2 rounded border transition-colors ${
                      selectedRoles.includes(role)
                        ? getRoleColor(role)
                        : 'bg-black/30 border-white/20 text-white/60 hover:border-white/40'
                    }`}
                  >
                    <span className="text-sm">{role}</span>
                    {selectedRoles.includes(role) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4 opacity-30" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingUser ? 'Save Changes' : 'Add User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-white">{userToDelete}</span>? 
              This user will lose all access to Primer. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrimerBackground>
  );
}

