"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, RefreshCw, Loader2 } from 'lucide-react';
import { ClassSelectorProps } from '../types';

/**
 * Component for selecting a class and managing sessions index
 */
export function ClassSelector({
  classes,
  selectedClassId,
  onClassChange,
  onRefreshIndex,
  isLoadingIndex,
  sessionsIndex
}: ClassSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Select Class
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Select value={selectedClassId} onValueChange={onClassChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a class..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map(cls => (
                <SelectItem
                  key={cls.id}
                  value={cls.id}
                >
                  {cls.name} ({cls.memberCount} members)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedClassId && (
            <Button
              onClick={onRefreshIndex}
              disabled={isLoadingIndex}
              variant="outline"
              size="sm"
            >
              {isLoadingIndex ? (
                <Loader2 className="size-5 animate-spin mr-2" />
              ) : (
                <RefreshCw className="size-5 mr-2" />
              )}
              Refresh Index
            </Button>
          )}
        </div>
        
        {sessionsIndex && (
          <div className="mt-4 text-sm text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {sessionsIndex.membersWithSessions}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {sessionsIndex.totalMembers}
            </span>{" "}
            members have completed sessions
            <span className="ml-2 text-muted-foreground/70">
              (Last updated: {new Date(sessionsIndex.lastUpdated).toLocaleString()})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

