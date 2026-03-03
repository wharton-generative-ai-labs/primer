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
    <Card className="bg-black/30 backdrop-blur-lg border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="h-5 w-5" />
          Select Class
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Select value={selectedClassId} onValueChange={onClassChange}>
            <SelectTrigger className="w-64 bg-black/50 border-white/20 text-white">
              <SelectValue placeholder="Choose a class..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-white/20">
              {classes.map(cls => (
                <SelectItem 
                  key={cls.id} 
                  value={cls.id}
                  className="text-white focus:bg-white/20 focus:text-white"
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Index
            </Button>
          )}
        </div>
        
        {sessionsIndex && (
          <div className="mt-4 text-sm text-white/70">
            <span className="text-green-400 font-medium">
              {sessionsIndex.membersWithSessions}
            </span>{" "}
            of{" "}
            <span className="font-medium">
              {sessionsIndex.totalMembers}
            </span>{" "}
            members have completed sessions
            <span className="text-white/50 ml-2">
              (Last updated: {new Date(sessionsIndex.lastUpdated).toLocaleString()})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

