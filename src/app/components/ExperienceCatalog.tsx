import React, { useEffect, useState, useCallback, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Permission } from '@/config/auth';
import { usePermissions } from '../hooks/usePermissions';
import { MoreVertical, Edit, Trash2, Download, SlidersHorizontal, Users, ShieldCheck, Info, Loader2, Package, ArrowLeft, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { getRelativeTimeString, formatDateTime } from '../lib/date-utils';
import { useSession } from 'next-auth/react';
import { ReadmeDialog } from './ReadmeDialog';

interface Experience {
  id: string;
  title: string;
  version: string;
  description: string;
  kind?: string;
  sceneCount?: number;
  soundsCount?: number;
  agents: { key: string; name: string }[];
  initialAgent?: string;
  tools?: { source: string; name: string }[];
  created?: string; // ISO 8601 datetime
  lastModified?: string; // ISO 8601 datetime
  author?: string;
  authorEmail?: string;
  hasReadme?: boolean;
}
interface ModuleCatalogEntry {
  id: string;
  title: string;
  description: string;
  version: string;
  kind: string;
  author: string;
  requires: string[];
  installed: boolean;
  installedVersion: string | null;
  updateAvailable: boolean;
}

interface ExperienceCatalogProps {
  onExperienceLoad: (configPath: string) => Promise<void>;
  onInstallClick?: () => void;
}

const ExperienceCatalog: React.FC<ExperienceCatalogProps> = ({ onExperienceLoad, onInstallClick }) => {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [loadingExperienceId, setLoadingExperienceId] = useState<string | null>(null);
  const [filterByAuthor, setFilterByAuthor] = useState(false);

  // Module browsing state
  const [showModules, setShowModules] = useState(false);
  const [modules, setModules] = useState<ModuleCatalogEntry[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('experienceCatalog.showTemplates');
      return stored === 'true';
    }
    return false;
  });
  const [showBundled, setShowBundled] = useState(true);
  const [showDebugger, setShowDebugger] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('experienceCatalog.showDebugger');
      return stored === 'true';
    }
    return false;
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [readmeDialogOpen, setReadmeDialogOpen] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [experienceToDelete, setExperienceToDelete] = useState<Experience | null>(null);
  
  // Check if user is admin (can view templates)
  const isAdmin = can(Permission.ADMIN_USERS);
  const isTechnical = can(Permission.VIEW_TECHNICAL);

  // Helper function to check if user is the author of an experience
  const isAuthor = (experience: Experience) => {
    return session?.user?.email && experience.authorEmail === session.user.email;
  };

  // Helper function to check if user can edit a specific experience
  const canEditExperience = (experience: Experience) => {
    // EDIT_ANY_EXPERIENCE allows editing any experience (admin/editor/tester)
    if (can(Permission.EDIT_ANY_EXPERIENCE)) return true;
    // EDIT_OWN_EXPERIENCE allows editing only experiences you authored (educator)
    if (can(Permission.EDIT_OWN_EXPERIENCE)) {
      return isAuthor(experience);
    }
    return false;
  };

  // Helper function to check if user can delete a specific experience
  const canDeleteExperience = (experience: Experience) => {
    return can(Permission.DELETE_EXPERIENCE) || isAuthor(experience);
  };

  // Helper function to check if user can manage classes for an experience
  const canManageClasses = (experience: Experience) => {
    // MANAGE_ANY_CLASSES allows managing classes for any experience (admin)
    if (can(Permission.MANAGE_ANY_CLASSES)) return true;
    // MANAGE_OWN_CLASSES allows managing classes only for experiences you authored (educator)
    if (can(Permission.MANAGE_OWN_CLASSES)) {
      return isAuthor(experience);
    }
    return false;
  };

  // Helper function to render the metadata line (created/modified + author)
  const renderMetadata = (experience: Experience) => {
    if (!experience.created && !experience.lastModified) {
      return null;
    }

    const dateToShow = experience.lastModified || experience.created;
    if (!dateToShow) return null;

    // Determine if we should show "Created" or "Last modified"
    const isModified = experience.lastModified && experience.created && experience.lastModified !== experience.created;
    const label = isModified ? 'Last modified' : 'Created';
    const relativeTime = getRelativeTimeString(dateToShow);
    const fullDateTime = formatDateTime(dateToShow);

    return (
      <div className="text-xs text-white/50 mt-1">
        <HoverCard>
          <HoverCardTrigger asChild>
            <span>
              {label} {relativeTime}
              {experience.author && ` • ${experience.author}`}
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto bg-black/90 border-gray-700 text-white/70 text-xs">
            {fullDateTime}
          </HoverCardContent>
        </HoverCard>
      </div>
    );
  };

  // Save showTemplates to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('experienceCatalog.showTemplates', String(showTemplates));
    }
  }, [showTemplates]);

  // Save showDebugger to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('experienceCatalog.showDebugger', String(showDebugger));
    }
  }, [showDebugger]);

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const params = new URLSearchParams();
        if (showTemplates && isAdmin) {
          params.set('includeTemplates', 'true');
        }
        // Only send includeBundled if false (default is true on server)
        if (!showBundled) {
          params.set('includeBundled', 'false');
        }
        if (showDebugger && isTechnical) {
          params.set('includeDebugger', 'true');
        }
        const url = `/api/experiences${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          return;
        }
        
        setExperiences(data.experiences);
      } catch (_error) {
        setError('Failed to load experiences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExperiences();
  }, [showTemplates, showBundled, showDebugger, isAdmin]);

  useEffect(() => {
    if (!isLoading && !error && experiences.length > 0) {
      searchInputRef.current?.focus();
    }
  }, [isLoading, error, experiences.length]);

  const handleExperienceClick = async (experienceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // Prevent multiple clicks while loading
    if (loadingExperienceId) {
      return;
    }
    
    // Set loading state immediately
    setLoadingExperienceId(experienceId);
    
    try {
      // Session management (recovery or fresh start) is handled by the play page
      await onExperienceLoad(`/api/storage/${experienceId}/experience.json`);
    } catch (error) {
      // Reset loading state on error
      setLoadingExperienceId(null);
      throw error;
    }
  };

  const handleEditClick = (experienceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering the parent click handler
    setOpenDropdown(null); // Close dropdown before navigation
    window.location.href = `/edit/${experienceId}`;
  };

  const handleManageClassesClick = (experienceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering the parent click handler
    setOpenDropdown(null); // Close dropdown before navigation
    window.location.href = `/manage/${experienceId}`;
  };

  const handleDeleteClick = (experienceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const experience = experiences.find(exp => exp.id === experienceId);
    setExperienceToDelete(experience || null);
    setDeleteDialogOpen(true);
    setOpenDropdown(null);
  };

  const handleConfirmDelete = async () => {
    if (!experienceToDelete) return;

    setIsDeleting(experienceToDelete.id);
    setDeleteDialogOpen(false);
    
    try {
      const response = await fetch(`/api/experiences/${experienceToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete experience');
      }

      // Remove the experience from the list
      setExperiences(prev => prev.filter(exp => exp.id !== experienceToDelete.id));
      
      toast({
        title: "Experience deleted",
        description: `"${experienceToDelete.title}" has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : 'Failed to delete experience',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
      setExperienceToDelete(null);
    }
  };

  const fetchModules = useCallback(async () => {
    setIsLoadingModules(true);
    setModuleError(null);
    try {
      const response = await fetch('/api/modules');
      const data = await response.json();
      if (data.error) {
        setModuleError(data.error);
        return;
      }
      setModules(data.modules || []);
    } catch {
      setModuleError('Failed to load modules from registry');
    } finally {
      setIsLoadingModules(false);
    }
  }, []);

  const handleBrowseModules = () => {
    setShowModules(true);
    fetchModules();
  };

  const handleInstallModule = async (moduleId: string) => {
    setInstallingModuleId(moduleId);
    try {
      const response = await fetch('/api/modules/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Installation failed');
      }

      const installedCount = data.installed?.length || 0;
      const skippedCount = data.skipped?.length || 0;
      toast({
        title: 'Module installed',
        description: `Installed ${installedCount} module(s)${skippedCount > 0 ? `, ${skippedCount} already present` : ''}.`,
      });

      // Refresh both modules list and experiences list
      fetchModules();
      // Re-fetch experiences to show newly installed ones
      const params = new URLSearchParams();
      if (showTemplates && isAdmin) params.set('includeTemplates', 'true');
      if (!showBundled) params.set('includeBundled', 'false');
      if (showDebugger && isTechnical) params.set('includeDebugger', 'true');
      const url = `/api/experiences${params.toString() ? `?${params.toString()}` : ''}`;
      const expResponse = await fetch(url);
      const expData = await expResponse.json();
      if (!expData.error) {
        setExperiences(expData.experiences);
      }
    } catch (error) {
      toast({
        title: 'Install failed',
        description: error instanceof Error ? error.message : 'Failed to install module',
        variant: 'destructive',
      });
    } finally {
      setInstallingModuleId(null);
    }
  };

  const filteredExperiences = experiences.filter(experience => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = experience.title.toLowerCase().includes(searchLower) ||
                         experience.description.toLowerCase().includes(searchLower);
    
    // Apply author filter if enabled
    if (filterByAuthor && session?.user?.email) {
      return matchesSearch && experience.authorEmail === session.user.email;
    }
    
    return matchesSearch;
  }).sort((a, b) => {
    // Define kind priority: no kind first, then user, bundled, meta, debugger, and template last
    const kindPriority: Record<string, number> = {
      'user': 1,
      'bundled': 2,
      'meta': 3,
      'debugger': 4,
      'template': 5,
    };
    
    const aKindPriority = a.kind ? (kindPriority[a.kind] ?? 6) : 0;
    const bKindPriority = b.kind ? (kindPriority[b.kind] ?? 6) : 0;
    
    // First sort by kind priority
    if (aKindPriority !== bKindPriority) {
      return aKindPriority - bKindPriority;
    }
    
    // Within same priority group, sort by lastModified descending
    const aDate = a.lastModified || a.created || '';
    const bDate = b.lastModified || b.created || '';
    return bDate.localeCompare(aDate);
  });

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredExperiences.length === 1 && !loadingExperienceId) {
      e.preventDefault();
      const experienceId = filteredExperiences[0].id;
      setLoadingExperienceId(experienceId);
      
      try {
        // Session management (recovery or fresh start) is handled by the play page
        await onExperienceLoad(`/api/storage/${experienceId}/experience.json`);
      } catch (error) {
        // Reset loading state on error
        setLoadingExperienceId(null);
        throw error;
      }
    }
  };

  const filteredModules = modules.filter(m => {
    const searchLower = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(searchLower) ||
           m.description.toLowerCase().includes(searchLower);
  });

  const getModuleTitleById = (id: string): string => {
    const mod = modules.find(m => m.id === id);
    return mod?.title || id;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col justify-end min-h-0 max-h-full">
      <div className="rounded-lg p-6 text-center backdrop-blur-lg shadow-2xl text-white bg-black/60 flex flex-col min-h-0 overflow-hidden">

        {showModules ? (
          <>
            <div className="flex items-center mb-4">
              <Button
                onClick={() => setShowModules(false)}
                variant="custom"
                size="sm"
                className="flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h2 className="text-xl font-semibold flex-1 text-center pr-[68px]">Module Registry</h2>
            </div>

            {isLoadingModules ? (
              <div className="flex items-center justify-center gap-2 py-8 text-white/70">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading modules...</span>
              </div>
            ) : moduleError ? (
              <p className="text-red-400 py-4">{moduleError}</p>
            ) : filteredModules.length === 0 ? (
              <p className="text-white/70 py-4">No modules available from the registry.</p>
            ) : (
              <ScrollArea className="flex-1 pr-4 min-h-0">
                <div className="space-y-3">
                  {filteredModules.map((mod) => (
                    <div
                      key={mod.id}
                      className={`block text-left px-4 py-3 rounded-lg transition-all relative ${
                        mod.installed
                          ? 'bg-white/5'
                          : 'bg-white/5 border border-dashed border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{mod.title}</h3>
                          {mod.kind === 'template' && (
                            <span className="px-1.5 py-0.5 text-xs bg-purple-500/30 text-purple-200 rounded">
                              Template
                            </span>
                          )}
                          {mod.kind === 'meta' && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-500/30 text-amber-200 rounded">
                              Meta
                            </span>
                          )}
                          {mod.installed ? (
                            <span className="px-1.5 py-0.5 text-xs bg-green-500/30 text-green-200 rounded flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Installed
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-xs bg-white/10 text-white/60 rounded">
                              Available
                            </span>
                          )}
                          {mod.updateAvailable && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-500/30 text-blue-200 rounded">
                              Update
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">v{mod.version}</span>
                          {!mod.installed && can(Permission.UPLOAD_EXPERIENCE) && (
                            <Button
                              onClick={() => handleInstallModule(mod.id)}
                              variant="custom"
                              size="sm"
                              className="flex items-center gap-1.5 text-xs"
                              disabled={!!installingModuleId}
                            >
                              {installingModuleId === mod.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Installing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3 h-3" />
                                  Install
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-white/70 text-xs">{mod.description}</p>
                      {mod.requires.length > 0 && (
                        <p className="text-white/40 text-xs mt-1">
                          Requires: {mod.requires.map(r => getModuleTitleById(r)).join(', ')}
                        </p>
                      )}
                      {mod.author && (
                        <p className="text-white/40 text-xs mt-0.5">{mod.author}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {modules.length > 0 && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            )}
          </>
        ) : (
          <>
        <h2 className="text-xl font-semibold mb-4">Available Experiences</h2>
        
        {isLoading ? (
          <p className="text-white/90">Loading experiences...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <>
            {experiences.length === 0 ? (
              <p className="text-white/90 flex-1 flex items-center justify-center">No experiences available</p>
            ) : (
              <ScrollArea className="flex-1 pr-4 min-h-0">
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredExperiences.map((experience) => (
                      <motion.a
                        key={experience.id}
                        href={`/play/${experience.id}`}
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleExperienceClick(experience.id, e)}
                        className={`block text-left px-4 py-2 rounded-lg transition-all relative overflow-hidden ${
                          loadingExperienceId === experience.id 
                            ? 'bg-white/15 shadow-lg cursor-default' 
                            : loadingExperienceId 
                            ? 'bg-white/5 opacity-40 pointer-events-none' 
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {loadingExperienceId === experience.id && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{
                              x: ['-100%', '100%'],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                          />
                        )}
                        <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">{experience.title}</h3>
                            {loadingExperienceId === experience.id && (
                              <div className="flex items-center gap-1.5 text-sm text-white/80">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading...</span>
                              </div>
                            )}
                            {experience.kind === 'template' && (
                              <span className="px-1.5 py-0.5 text-xs bg-purple-500/30 text-purple-200 rounded">
                                Template
                              </span>
                            )}
                            {experience.kind === 'meta' && (
                              <span className="px-1.5 py-0.5 text-xs bg-amber-500/30 text-amber-200 rounded">
                                Meta Experience
                              </span>
                            )}
                            {experience.kind === 'debugger' && (
                              <span className="px-1.5 py-0.5 text-xs bg-rose-500/30 text-rose-200 rounded">
                                Debugger
                              </span>
                            )}
                            {experience.kind === 'bundled' && (
                              <span className="px-1.5 py-0.5 text-xs bg-sky-500/30 text-sky-200 rounded">
                                Bundled
                              </span>
                            )}
                            {experience.kind === 'user' && (
                              <span className="px-1.5 py-0.5 text-xs bg-white/15 text-white/80 rounded">
                                User
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {experience.hasReadme && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedExperience(experience);
                                        setReadmeDialogOpen(true);
                                      }}
                                      className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                                    >
                                      <Info className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-black/90 border-gray-700 text-white max-w-[140px] text-center">
                                    <p>View Experience<br />Information</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <div className="text-xs text-white/70 text-right">
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <span className="cursor-help">{experience.version}</span>
                                </HoverCardTrigger>
                              <HoverCardContent className="w-80 bg-black/90 border-gray-700 text-white/70">
                                <div className="text-xs text-left">
                                  <p><span className="font-semibold">Version:</span> {experience.version}</p>
                                  <p><span className="font-semibold">ID:</span> {experience.id}</p>
                                  <p className="font-semibold mt-1">Agents:</p>
                                  <ul className="list-none pl-2">
                                    {experience.agents?.length > 0 ? (
                                      experience.agents.map(agent => (
                                        <li key={agent.key}>
                                          {agent.name}{agent.key === experience.initialAgent ? ' *' : ''}
                                        </li>
                                      ))
                                    ) : (
                                      <li>No agents configured</li>
                                    )}
                                  </ul>
                                  {experience.tools && experience.tools.length > 0 && (
                                    <>
                                      <p className="font-semibold mt-1">Tools:</p>
                                      <ul className="list-none pl-2">
                                        {[...experience.tools]
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map(tool => (
                                            <li key={`${tool.source}-${tool.name}`}>
                                              {tool.name}
                                            </li>
                                          ))}
                                      </ul>
                                    </>
                                  )}
                                  {experience.sceneCount !== undefined && (
                                    <p className="mt-1"><span className="font-semibold">Scenes:</span> {experience.sceneCount}</p>
                                  )}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                            </div>
                            {(canEditExperience(experience) || canDeleteExperience(experience) || canManageClasses(experience)) && (
                              <DropdownMenu 
                                open={openDropdown === experience.id}
                                onOpenChange={(open) => setOpenDropdown(open ? experience.id : null)}
                              >
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none"
                                    title="Actions"
                                    disabled={isDeleting === experience.id}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-black/90 border-gray-700">
                                  {canManageClasses(experience) && experience.kind !== 'template' && experience.kind !== 'meta' && experience.kind !== 'debugger' && (
                                    <DropdownMenuItem
                                      onClick={(e) => handleManageClassesClick(experience.id, e)}
                                      className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                                    >
                                      <Users className="w-4 h-4 mr-2" />
                                      Manage
                                    </DropdownMenuItem>
                                  )}
                                  {canEditExperience(experience) && (
                                    <DropdownMenuItem
                                      onClick={(e) => handleEditClick(experience.id, e)}
                                      className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteExperience(experience) && (
                                    <DropdownMenuItem
                                      onClick={(e) => handleDeleteClick(experience.id, e)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer"
                                      disabled={isDeleting === experience.id}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      {isDeleting === experience.id ? 'Deleting...' : 'Delete'}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <p className="text-white/70 text-xs">{experience.description}</p>
                        {renderMetadata(experience)}
                        </div>
                      </motion.a>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
            
            {/* Controls section - always shown when not loading/error */}
            <div className="mt-4 space-y-3">
              {experiences.length > 0 && (
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search experiences..."
                  value={searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={!!loadingExperienceId}
                  className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              )}
              {(can(Permission.UPLOAD_EXPERIENCE) && onInstallClick) || (session?.user?.email && experiences.length > 0) ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {can(Permission.UPLOAD_EXPERIENCE) && onInstallClick && (
                      <Button
                        onClick={onInstallClick}
                        variant="custom"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={!!loadingExperienceId}
                      >
                        <Download className="w-4 h-4" />
                        Install Experience
                      </Button>
                    )}
                    {can(Permission.UPLOAD_EXPERIENCE) && (
                      <Button
                        onClick={handleBrowseModules}
                        variant="custom"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={!!loadingExperienceId}
                      >
                        <Package className="w-4 h-4" />
                        Browse Modules
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(session?.user?.email || isAdmin) && experiences.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="custom"
                            size="sm"
                            className={`flex items-center gap-2 ${filterByAuthor || showTemplates || !showBundled || showDebugger ? 'bg-white/20' : ''}`}
                            title="View options"
                            disabled={!!loadingExperienceId}
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                            View
                            {(filterByAuthor || showTemplates || !showBundled || showDebugger) && (
                              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/30 rounded-full">
                                {[filterByAuthor, showTemplates, !showBundled, showDebugger].filter(Boolean).length}
                              </span>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 border-gray-700">
                          {session?.user?.email && (
                            <>
                              <DropdownMenuLabel className="text-white/60 text-xs">Filter</DropdownMenuLabel>
                              <DropdownMenuCheckboxItem
                                checked={filterByAuthor}
                                onCheckedChange={setFilterByAuthor}
                                className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                              >
                                My Experiences Only
                              </DropdownMenuCheckboxItem>
                            </>
                          )}
                          {session?.user?.email && <DropdownMenuSeparator className="bg-white/10" />}
                          <DropdownMenuLabel className="text-white/60 text-xs">Include</DropdownMenuLabel>
                          <DropdownMenuCheckboxItem
                            checked={showBundled}
                            onCheckedChange={setShowBundled}
                            className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                          >
                            Bundled
                          </DropdownMenuCheckboxItem>
                          {isTechnical && (
                            <DropdownMenuCheckboxItem
                              checked={showDebugger}
                              onCheckedChange={setShowDebugger}
                              className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                            >
                              Debugger
                            </DropdownMenuCheckboxItem>
                          )}
                          {isAdmin && (
                            <DropdownMenuCheckboxItem
                              checked={showTemplates}
                              onCheckedChange={setShowTemplates}
                              className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                            >
                              Templates
                            </DropdownMenuCheckboxItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {isAdmin && (
                      <Button
                        onClick={() => window.location.href = '/admin/users'}
                        variant="custom"
                        size="sm"
                        className="flex items-center gap-2"
                        title="Manage users and permissions"
                        disabled={!!loadingExperienceId}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Admin
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
          </>
        )}

      </div>
      
      {/* README Dialog */}
      {selectedExperience && (
        <ReadmeDialog
          experienceId={selectedExperience.id}
          experienceTitle={selectedExperience.title}
          open={readmeDialogOpen}
          onOpenChange={setReadmeDialogOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#2a3441] border-gray-600 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure you want to delete &ldquo;{experienceToDelete?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white text-gray-900 hover:bg-gray-100">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-[#dc3545] text-white hover:bg-[#c82333]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExperienceCatalog; 