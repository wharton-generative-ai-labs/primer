import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, Plus, Users, BarChart3 } from "lucide-react";
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
    <div className="backdrop-blur-lg bg-black/50 border-b border-white/10">
      <div className="p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
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
              <h1 className="text-xl font-semibold text-white">
                Experience Management
              </h1>
              <p className="text-sm text-white/60">
                {experienceTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopyLink}
              variant="custom"
              size="sm"
            >
              {copiedLink ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedLink ? 'Copied!' : 'Copy Play Link'}
            </Button>
            {activeTab === 'classes' && (
              <Button
                onClick={onCreateClass}
                variant="custom"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
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
                ? 'bg-black/30 text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="h-4 w-4" />
            Classes
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'analytics'
                ? 'bg-black/30 text-white border-b-2 border-purple-500'
                : 'text-white/60 hover:text-white hover:bg-white/5'
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

