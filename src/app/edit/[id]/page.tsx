"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ExperienceEditor } from "@/app/components/ExperienceEditor";
import PrimerBackground from '@/app/components/PrimerBackground';
import { Permission } from "@/config/auth";
import { usePermissions } from "@/app/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { getExperienceMetadata } from "@/app/lib/configUtils";
import { ExperienceMetadata } from "@/app/lib/types";
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
import { createModuleLogger } from "@/lib/logger";
import { HEADER_CLASSES } from "@/config/layout";

const logger = createModuleLogger('edit-page');

export default function EditPage() {
  const params = useParams();
  const experienceId = params?.id as string;
  const { can, isAuthenticated } = usePermissions();
  const { data: session } = useSession();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [experienceMetadata, setExperienceMetadata] = useState<ExperienceMetadata | null>(null);
  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleNavigation = (url: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(url);
    } else {
      window.location.href = url;
    }
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      setHasUnsavedChanges(false);
      // Small timeout to ensure state updates have propagated
      setTimeout(() => {
        window.location.href = pendingNavigation;
      }, 100);
      setPendingNavigation(null);
    }
  };

  // Fetch experience metadata and check authorization
  useEffect(() => {
    async function loadExperienceMetadata() {
      if (!experienceId || !isAuthenticated) return;
      
      // Debug logging
      logger.debug('Authorization check', {
        userEmail: session?.user?.email,
        userRoles: session?.user?.roles?.map(r => r.key),
        userPrivileges: session?.user?.privileges,
        hasEditAny: can(Permission.EDIT_ANY_EXPERIENCE),
        hasEditOwn: can(Permission.EDIT_OWN_EXPERIENCE),
        experienceId
      });
      
      // Check if user has EDIT_ANY_EXPERIENCE permission first
      // This allows admins/editors to edit even if the experience config is invalid
      const hasEditAnyPermission = can(Permission.EDIT_ANY_EXPERIENCE);
      
      try {
        const metadata = await getExperienceMetadata(`/api/storage/${experienceId}/experience.json`);
        setExperienceMetadata(metadata);
        
        logger.info('Experience metadata loaded', {
          title: metadata.title,
          authorEmail: metadata.authorEmail
        });
        
        // Check authorization based on permissions and authorship
        if (hasEditAnyPermission) {
          // User can edit any experience
          logger.info('Authorized via EDIT_ANY_EXPERIENCE');
          setIsAuthorized(true);
        } else if (can(Permission.EDIT_OWN_EXPERIENCE)) {
          // User can only edit their own experiences - check authorship
          const userEmail = session?.user?.email;
          const isOwner = !!userEmail && metadata.authorEmail === userEmail;
          logger.debug('Checking ownership', { userEmail, authorEmail: metadata.authorEmail, isOwner });
          setIsAuthorized(isOwner);
        } else {
          // User has no edit permissions
          logger.info('No edit permissions');
          setIsAuthorized(false);
        }
      } catch (error) {
        logger.error('Failed to load experience metadata', error);
        
        // If user has EDIT_ANY_EXPERIENCE, allow them to edit even if metadata fails to load
        // This is important for fixing broken experiences
        if (hasEditAnyPermission) {
          logger.info('Authorized via EDIT_ANY_EXPERIENCE (despite metadata error)');
          setIsAuthorized(true);
          setExperienceMetadata({
            title: `${experienceId} (Invalid Configuration)`,
            version: '1.0.0',
            description: 'Experience configuration has errors. You can edit it to fix the issues.'
          });
        } else {
          // For non-admins, we need valid metadata to check ownership
          logger.info('Cannot verify ownership - metadata failed to load');
          setIsAuthorized(false);
          setExperienceMetadata({
            title: 'Unknown Experience',
            version: '1.0.0',
            description: 'Failed to load experience metadata'
          });
        }
      }
      
      setAuthorizationChecked(true);
    }

    loadExperienceMetadata();
  }, [experienceId, isAuthenticated, can, session?.user?.email]);

  if (!isAuthenticated) {
    // Show nothing while authentication is being determined
    return null;
  }

  // Show loading while checking authorization
  if (!authorizationChecked) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <div className="bg-background backdrop-blur-lg rounded-lg p-6 max-w-md text-center">
            <p className="text-foreground">Loading...</p>
          </div>
        </div>
      </PrimerBackground>
    );
  }

  // Show access denied if not authorized
  if (!isAuthorized) {
    return (
      <PrimerBackground useInitialBackdrop={true}>
        <div className="flex items-center justify-center h-full">
          <div className="bg-black/50 backdrop-blur-lg rounded-lg p-6 max-w-md text-center">
            <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
            <p className="text-white/90 mb-4">You don&apos;t have permission to edit this experience.</p>
            <Button
              onClick={() => window.location.href = '/'}
              variant="custom"
              size="sm"
            >
              Return Home
            </Button>
          </div>
        </div>
      </PrimerBackground>
    );
  }

  return (
    <PrimerBackground showOverlays={false} useInitialBackdrop={true}>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className={HEADER_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="text-base md:text-lg font-semibold">
              {experienceMetadata ? `Editing: ${experienceMetadata.title}` : 'Loading...'}
            </div>
            <div className="flex gap-1 md:gap-2">
              <Button
                onClick={() => handleNavigation(`/play/${experienceId}`)}
                variant="custom"
                size="sm"
              >
                Run Experience
              </Button>
              <Button
                onClick={() => window.location.href = `/api/download?experienceId=${experienceId}`}
                variant="custom"
                size="sm"
              >
                Download Experience
              </Button>
              <Button
                onClick={() => window.location.href = `/api/download-session-data?experienceId=${experienceId}`}
                variant="custom"
                size="sm"
              >
                Download Session Data
              </Button>
              <Button
                onClick={() => handleNavigation('/')}
                variant="customDestructive"
                size="sm"
              >
                Quit
              </Button>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <ExperienceEditor 
            experienceId={experienceId} 
            visible={true} 
            onUnsavedChangesChange={setHasUnsavedChanges}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>

        {/* Unsaved Changes Alert Dialog */}
        <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => !open && setPendingNavigation(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={confirmNavigation}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrimerBackground>
  );
} 