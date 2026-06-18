"use client";

import React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { RoleKey } from "@/config/auth";

type SemanticVariant = NonNullable<BadgeProps["variant"]>;

function roleToVariant(role: RoleKey): SemanticVariant {
  switch (role) {
    case "ADMIN":
      return "destructive";
    case "EDITOR":
    case "TESTER":
      return "default";
    case "EDUCATOR":
      return "secondary";
    case "PLAYER":
      return "outline";
    case "ADD_MAGIC":
      return "secondary";
    default: {
      const _exhaustive: never = role;
      void _exhaustive;
      return "outline";
    }
  }
}

interface RoleBadgeProps {
  role: RoleKey;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge variant={roleToVariant(role)} className={className}>
      {role}
    </Badge>
  );
}
