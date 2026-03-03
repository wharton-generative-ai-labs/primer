"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import PrimerBackground from '@/app/components/PrimerBackground';
import { AnalyticsPanel } from '@/app/components/AnalyticsPanel';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Hooks
import { useClasses } from './hooks/useClasses';
import { useClassDetails } from './hooks/useClassDetails';
import { useExperienceInfo } from './hooks/useExperienceInfo';

// Components
import { ManagePageHeader } from './components/ManagePageHeader';
import { ClassList } from './components/ClassList';
import { ClassDetails } from './components/ClassDetails';
import { EmptyClassState } from './components/EmptyClassState';
import { CreateClassDialog } from './components/CreateClassDialog';
import { AddMembersDialog } from './components/AddMembersDialog';
import { DeleteClassDialog } from './components/DeleteClassDialog';

type ManageTab = 'classes' | 'analytics';

export default function ManageClassesPage() {
  const params = useParams();
  const experienceId = params?.id as string;
  const { toast } = useToast();
  
  // Custom hooks
  const experienceInfo = useExperienceInfo(experienceId);
  const {
    classes,
    isLoading,
    error,
    fetchClasses,
    createClass,
    deleteClass,
    toggleClassActive
  } = useClasses(experienceId);
  
  const {
    selectedClass,
    fetchClassDetails,
    addMembers,
    removeMember,
    clearSelectedClass
  } = useClassDetails(experienceId);

  // Local state
  const [activeTab, setActiveTab] = useState<ManageTab>('classes');
  
  // Create class dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  
  // Add members dialog state
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [newMembersText, setNewMembersText] = useState("");
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  // Fetch classes on mount
  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Handlers
  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a class name",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await createClass(newClassName, newClassDescription);
      toast({
        title: "Success",
        description: `Class "${newClassName}" created successfully`
      });
      setShowCreateDialog(false);
      setNewClassName("");
      setNewClassDescription("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create class',
        variant: "destructive"
      });
    }
  };

  const handleAddMembers = async () => {
    if (!selectedClass || !newMembersText.trim()) {
      toast({
        title: "Error",
        description: "Please enter at least one email address",
        variant: "destructive"
      });
      return;
    }
    
    // Parse emails (one per line or comma-separated)
    const emails = newMembersText
      .split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes('@'));
    
    if (emails.length === 0) {
      toast({
        title: "Error",
        description: "No valid email addresses found",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const addedCount = await addMembers(selectedClass.id, emails);
      toast({
        title: "Success",
        description: `Added ${addedCount} member(s) to the class`
      });
      setShowAddMembersDialog(false);
      setNewMembersText("");
      fetchClasses(); // Update member count
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to add members',
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!selectedClass) return;
    
    try {
      await removeMember(selectedClass.id, email);
      toast({
        title: "Success",
        description: `Removed ${email} from the class`
      });
      fetchClasses(); // Update member count
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to remove member',
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (classId: string, currentlyActive: boolean) => {
    try {
      await toggleClassActive(classId, currentlyActive);
      toast({
        title: "Success",
        description: `Class ${!currentlyActive ? 'activated' : 'deactivated'}`
      });
      if (selectedClass?.id === classId) {
        await fetchClassDetails(classId);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to update class',
        variant: "destructive"
      });
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    
    try {
      await deleteClass(classToDelete);
      toast({
        title: "Success",
        description: "Class deleted successfully"
      });
      setShowDeleteDialog(false);
      setClassToDelete(null);
      if (selectedClass?.id === classToDelete) {
        clearSelectedClass();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete class',
        variant: "destructive"
      });
    }
  };

  const handleSelectClass = async (classId: string) => {
    try {
      await fetchClassDetails(classId);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch class details',
        variant: "destructive"
      });
    }
  };

  // Loading state
  if (isLoading && !experienceInfo) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <div className="text-white">Loading...</div>
        </div>
      </PrimerBackground>
    );
  }

  // Error state
  if (error) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <Card className="bg-black/50 backdrop-blur-lg border-red-500/50 max-w-md">
            <CardHeader>
              <CardTitle className="text-red-400">Access Denied</CardTitle>
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

  return (
    <PrimerBackground showOverlays={false} useInitialBackdrop={true}>
      <div className="flex flex-col h-full">
        <ManagePageHeader
          experienceId={experienceId}
          experienceTitle={experienceInfo?.title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCreateClass={() => setShowCreateDialog(true)}
        />

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'classes' ? (
            <div className="h-full flex">
              <ClassList
                classes={classes}
                selectedClassId={selectedClass?.id || null}
                onSelectClass={handleSelectClass}
              />

              <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-xl">
                {selectedClass ? (
                  <ClassDetails
                    selectedClass={selectedClass}
                    onToggleActive={handleToggleActive}
                    onDelete={(classId) => {
                      setClassToDelete(classId);
                      setShowDeleteDialog(true);
                    }}
                    onAddMembers={() => setShowAddMembersDialog(true)}
                    onRemoveMember={handleRemoveMember}
                  />
                ) : (
                  <EmptyClassState />
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-black/60 backdrop-blur-xl">
              <AnalyticsPanel experienceId={experienceId} classes={classes} />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateClassDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        className={newClassName}
        classDescription={newClassDescription}
        onClassNameChange={setNewClassName}
        onClassDescriptionChange={setNewClassDescription}
        onCreate={handleCreateClass}
      />

      <AddMembersDialog
        open={showAddMembersDialog}
        onOpenChange={setShowAddMembersDialog}
        membersText={newMembersText}
        onMembersTextChange={setNewMembersText}
        onAdd={handleAddMembers}
      />

      <DeleteClassDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteClass}
      />
    </PrimerBackground>
  );
}
