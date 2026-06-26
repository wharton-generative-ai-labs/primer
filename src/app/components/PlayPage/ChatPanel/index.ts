// Public API of the ChatPanel module. PlayPageSplitContent imports ChatPanel;
// CompactChat (upcoming) will reuse AgentAvatar, AudioIconButton, and the
// palette helpers.

export { ChatPanel } from './ChatPanel';
export type { ChatPanelProps } from './ChatPanel';
export { CompactChat } from './CompactChat';
export type { CompactChatProps } from './CompactChat';
export { AgentAvatar } from './AgentAvatar';
export { AudioIconButton } from './AudioIconButton';
export { AgentHeader } from './AgentHeader';
export { HandoffDivider } from './HandoffDivider';
export { ToolErrorNotice } from './ToolErrorNotice';
export { MessageRow } from './MessageRow';
export { AgentFilterButton } from './AgentFilterButton';
export { DelegationStatusLine } from './DelegationStatusLine';
export { AGENT_PALETTE, agentPalette, agentInitials } from './palette';
export type { AgentPalette } from './palette';
