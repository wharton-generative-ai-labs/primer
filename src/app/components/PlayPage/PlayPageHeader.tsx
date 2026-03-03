"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ExperienceMetadata, AgentConfig } from "../../lib/types";
import { HEADER_CLASSES } from "@/config/layout";

interface PlayPageHeaderProps {
  experienceMetadata: ExperienceMetadata | null;
  agents: Record<string, AgentConfig>;
  selectedAgentKey: string;
  setSelectedAgentKey: (key: string) => void;
  isDebugModeEnabled: boolean;
  canSwitchAgents: boolean;
}

export function PlayPageHeader({
  experienceMetadata,
  agents,
  selectedAgentKey,
  setSelectedAgentKey,
  isDebugModeEnabled,
  canSwitchAgents,
}: PlayPageHeaderProps) {
  // Filter out backend agents for the dropdown
  const frontendAgents = Object.entries(agents).filter(([, agent]) => agent.type !== 'backend');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  return (
    <>
      <style jsx>{`
        @keyframes header-blur-in {
          0% {
            backdrop-filter: blur(16px) saturate(100%);
          }
          100% {
            backdrop-filter: blur(16px) saturate(25%);
          }
        }
        
        .header-animate {
          animation: header-blur-in 4s ease-in-out forwards;
        }
      `}</style>
      <div className={`${HEADER_CLASSES} flex items-center z-[100] header-animate`}>
      {/* Logo - Left side */}
      <div className="flex-shrink-0 absolute left-1.5 md:left-2">
        <Image
          src="/images/gail_logo_vert_rev.png"
          alt="Wharton Generative AI Labs"
          width={1}
          height={1}
          sizes="250px"
          className="w-[60px] md:w-[80px] h-auto"
          placeholder="empty"
        />
      </div>

      {/* Title and Agent Name - Center */}
      <div className="flex-1 flex justify-center items-center">
        {experienceMetadata && (
          <div className="flex flex-col items-center mx-auto">
            <h1 className="text-base md:text-2xl font-minion">
              {experienceMetadata.title}
            </h1>
            {/* Agent name with hover dropdown in debug mode */}
            {isDebugModeEnabled && selectedAgentKey && canSwitchAgents && frontendAgents.length > 1 ? (
              <div 
                className="relative"
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <span className="text-xs text-gray-300 cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                  {agents[selectedAgentKey]?.name || selectedAgentKey}
                  <svg 
                    className="w-3 h-3" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
                {/* Dropdown menu with bridge to prevent gap */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 z-[110]">
                    {/* Invisible bridge to cover the gap */}
                    <div className="absolute top-0 left-0 right-0 h-1" />
                    {/* Actual dropdown */}
                    <div className="bg-black/90 backdrop-blur-sm border border-white/30 rounded-lg shadow-lg min-w-[150px] py-1">
                      {frontendAgents.map(([key, agent]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedAgentKey(key);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${
                            key === selectedAgentKey ? 'text-white font-medium' : 'text-gray-300'
                          }`}
                        >
                          {agent.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-300">
                {agents[selectedAgentKey]?.name || selectedAgentKey}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side spacer to balance layout */}
      <div className="flex items-center space-x-2 md:space-x-4 absolute right-1.5 md:right-2">
        {/* Empty div for layout balance */}
      </div>
    </div>
    </>
  );
}

