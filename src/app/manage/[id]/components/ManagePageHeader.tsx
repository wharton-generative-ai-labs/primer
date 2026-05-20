import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check, Plus, Users, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ManageTab = 'classes' | 'analytics';

interface ManagePageHeaderProps {
  experienceId: string;
  experienceTitle?: string;
  activeTab: ManageTab;
  onTabChange: (tab: ManageTab) => void;
  onCreateClass: () => void;
}

export function ManagePageHeader({
  experienceId,
  experienceTitle,
  activeTab,
  onTabChange,
  onCreateClass
}: ManagePageHeaderProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/play/${experienceId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast({
      title: "Link copied!",
      description: "Share this link with your students"
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur">
      <div className="p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-serif text-xl font-semibold text-foreground">
                Experience Management
              </h1>
              <p className="text-base leading-6 text-muted-foreground">
                {experienceTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopyLink}
              variant="outline"
            >
              {copiedLink ? (
                <Check className="size-5" />
              ) : (
                <Copy className="size-5" />
              )}
              {copiedLink ? 'Copied!' : 'Copy Play Link'}
            </Button>
            {activeTab === 'classes' && (
              <Button
                onClick={onCreateClass}
                variant="outline"
              >
                <Plus className="size-5" />
                Create Class
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="px-4 max-w-7xl mx-auto">
        <div className="flex gap-1">
          <button
            onClick={() => onTabChange('classes')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'classes'
                ? 'bg-background text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Users className="h-4 w-4" />
            Classes
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'analytics'
                ? 'bg-background text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </button>
        </div>
      </div>
    </div>
  );
}

