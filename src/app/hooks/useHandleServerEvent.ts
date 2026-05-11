"use client";

import { ServerEvent, SessionStatus, AgentConfig, ToolResponse } from "@/app/lib/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useScene } from "@/app/hooks/useScene";
import { useFileUpload } from "@/app/contexts/FileUploadContext";
import { useRef } from "react";
import { ToolRegistry } from "@/app/lib/ToolRegistry";
import { useExperienceUrl } from "@/app/hooks/useExperienceUrl";
import { useArtifact } from "@/app/contexts/ArtifactContext";
import { getSceneUrl } from '@/app/lib/scene-utils';
import { getSceneManager } from '@/app/lib/SceneManager';
import { ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from "@/lib/logger";
import { generateUUID } from '@/app/lib/uuid';

const logger = createModuleLogger('useHandleServerEvent');
// ✅ CENTRALIZED IMPORTS - migrated tools
import { SoundToolContext, getSoundManager } from '@/app/lib/tools/sound';
import { ExperienceToolContext, getExperienceManager } from '@/app/lib/tools/experience';
import { WebSearchToolContext, getWebSearchManager } from '@/app/lib/tools/research';
import { ImageGeneratorToolContext, getImageGeneratorManager } from '@/app/lib/tools/image-generator';
// Note: Information tool is now backend-first, no client-side manager needed
// ✅ CENTRALIZED IMPORTS - UI components migrated
import { MermaidToolContext, getMermaidManager } from '@/app/lib/tools/ui/mermaid/index';
import { toast } from "@/hooks/use-toast";
// ✅ CENTRALIZED IMPORTS - UI event handlers for server-first tools
import { 
  handleUIElementShow, 
  handleUIElementHide, 
  handleUIElementMove, 
  handleUIElementResize,
  handleUIElementMaximize,
  handleUIElementDestroy,
  handleUIObserveRequest
} from '@/app/lib/tools/client/ui-event-handlers';
import { handleToolResponse, getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';

export interface UseHandleServerEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setIsAIAudioPlaying: (isPlaying: boolean) => void;
  setIsUserAudioPlaying: (isPlaying: boolean) => void;
  setQueuedAgentTransfer: (key: string | null) => void;
  isDebugModeEnabled: boolean;
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  onSessionUpdated: () => void;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentKey,
  agents,
  sendClientEvent,
  setIsAIAudioPlaying,
  setIsUserAudioPlaying,
  setQueuedAgentTransfer,
  isDebugModeEnabled,
  showChecklist,
  hideChecklist,
  onSessionUpdated,
}: UseHandleServerEventParams) {
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptBreadcrumbWithId,
    updateTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();
  const { logServerEvent } = useEvent();
  const { setScene } = useScene();
  const { showFileUpload } = useFileUpload();
  const { getExperienceId } = useExperienceUrl();
  const toolRegistry = ToolRegistry.getInstance();
  const { listArtifacts, createArtifact, deleteArtifact, updateArtifact, getArtifact } = useArtifact();

  const handleFunctionCall = async (function_request: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    logger.debug({ arguments: function_request.arguments }, 'Raw fn args');
    const args = JSON.parse(function_request.arguments);

    // Create a context object for tool execution
    const experienceId = getExperienceId();
    if (!experienceId) {
      logger.error({ functionName: function_request.name }, 'No experience ID found when executing tool');
      throw new Error('Experience ID is required');
    }

    const functionCallId = function_request.call_id;

    // context should be created based on target tool's advertised dependencies (eventually)
    const toolContext: ToolContext &
      SoundToolContext &
      ExperienceToolContext &
      WebSearchToolContext &
      ImageGeneratorToolContext &
      MermaidToolContext = {
      functionCallId,
      transcriptItems,
      selectedAgentKey,
      agents,
      experienceId,
      setScene,
      sendClientEvent,
      showFileUpload,
      addTranscriptBreadcrumb,
      setQueuedAgentTransfer,
      listArtifacts,
      createArtifact: (name: string, content: string, type: string, metadata?: any) => createArtifact(name, content, type, metadata),
      deleteArtifact,
      updateArtifact: (id: string, content: string, metadata?: any) => updateArtifact(id, content, metadata),
      getArtifact,
      getSceneUrl,
      getAvailableScenes: () => getSceneManager().getAvailableScenes(),
      addCustomScene: (sceneName: string, imageUrl: any) => {
        const sceneManager = getSceneManager();
        sceneManager.addCustomScene(sceneName, { path: imageUrl, url: imageUrl });
        return { result: true };
      },
      removeCustomScene: (sceneName) => {
        const result = getSceneManager().removeCustomScene(sceneName);
        return { result };
      },
      getAvailableSounds: () => getSoundManager().getAvailableSounds(),
      playSound: (sound: string, options?: { volume?: number, loop?: boolean }) => getSoundManager().playSound(sound, options),
      createExperience: () => getExperienceManager().createExperience(),
      copyTemplate: (templateExperienceId) => getExperienceManager().copyTemplate(templateExperienceId),
      createDirectory: (experienceId, path) => getExperienceManager().createDirectory(experienceId, path),
      createFile: (experienceId, path, content, contentEncoding) => getExperienceManager().createFile(experienceId, path, content, contentEncoding),
      deleteDirectory: (experienceId, path) => getExperienceManager().deleteDirectory(experienceId, path),
      deleteFile: (experienceId, path) => getExperienceManager().deleteFile(experienceId, path),
      moveFile: (experienceId, sourcePath, destinationPath) => getExperienceManager().moveFile(experienceId, sourcePath, destinationPath),
      moveDirectory: (experienceId, sourcePath, destinationPath) => getExperienceManager().moveDirectory(experienceId, sourcePath, destinationPath),
      listResources: (experienceId) => getExperienceManager().listResources(experienceId),
      getResourceContent: (experienceId, path) => getExperienceManager().getResourceContent(experienceId, path),
      searchWeb: (query) => getWebSearchManager().searchWeb(query),
      generateImage: (prompt, options) => getImageGeneratorManager().generateImage(prompt, options),
      showMermaidDiagram: (title: string, diagram: string) => getMermaidManager().showMermaidDiagram(title, diagram),
      hideDiagram: () => getMermaidManager().hideDiagram(),
      // Note: Information and note tools are now backend-first, they use their respective stores on the server
      showChecklist: showChecklist || (() => logger.warn({}, 'showChecklist not available')),
      hideChecklist: hideChecklist || (() => logger.warn({}, 'hideChecklist not available')),
      toast: (options: { title: string; variant?: 'default' | 'destructive' }) => {
        toast({
          title: options.title,
          variant: options.variant || 'default',
        });
      },
      // Custom component event callbacks
      onComponentEvent: (event) => {
        logger.info('Component event received', event);
        
        // Send event as system message so it's in context but hidden from transcript
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{
              type: "input_text",
              text: `[Component Event] ${event.componentId}: ${event.eventType}\n${JSON.stringify(event.eventData, null, 2)}`
            }]
          }
        });
        
        // Trigger agent response
        sendClientEvent({
          type: "response.create"
        });
      },
      onComponentStateChange: (event) => {
        logger.info('Component state changed', event);
        // Optionally log state changes without notifying agent
        // (Agent will be notified via onComponentEvent for important events)
      },
    };

    // Create breadcrumb ID for tracking
    const breadcrumbId = `tool-${functionCallId || generateUUID()}`;

    try {
      if (toolRegistry.hasToolWithName(function_request.name)) {
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumbWithId(
            breadcrumbId,
            `Calling ${function_request.name}`,
            args,
            "IN_PROGRESS"
          );
        }
        
        const result = await toolRegistry.execute(function_request.name, args, toolContext) as ToolResponse;

        switch (result.status) {
          case 'deferred':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (deferred)`,
                { status: 'deferred', message: result.message }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }
            return;

          case 'error':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (error)`,
                { status: 'error', message: result.message, data: result.data }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }
            
            sendClientEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: function_request.call_id,
                output: JSON.stringify({ error: result.message, ...result.data }),
              },
            });
            break;

          case 'success':
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name}`,
                { status: 'success', data: result.data }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }

            sendClientEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: function_request.call_id,
                output: JSON.stringify(result.data),
              },
            });
            break;

          default:
            if (isDebugModeEnabled) {
              updateTranscriptBreadcrumb(
                breadcrumbId,
                `Called ${function_request.name} (invalid)`,
                { status: 'error', message: `Tool returned unknown status: ${result.status}` }
              );
              updateTranscriptItemStatus(breadcrumbId, "DONE");
            }
            break;
        }
      } else {
        logger.warn({ functionName: function_request.name, args }, 'AI called unknown function');

        const simulatedResult = { result: true };
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumbWithId(
            breadcrumbId,
            `${function_request.name} (SIMULATED)`,
            simulatedResult,
            "DONE"
          );
        }

        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: function_request.call_id,
            output: JSON.stringify(simulatedResult),
          },
        });
      }
    } catch (error) {
      logger.error({ err: error, functionName: function_request.name }, 'Error executing tool');

      // Send an error result back to the AI
      const errorResult = {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      };

      if (isDebugModeEnabled) {
        updateTranscriptBreadcrumb(
          breadcrumbId,
          `Called ${function_request.name} (error)`,
          errorResult
        );
        updateTranscriptItemStatus(breadcrumbId, "DONE");
      }

      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: function_request.call_id,
          output: JSON.stringify(errorResult),
        },
      });
    }

    // Always trigger a response after handling the function call
    sendClientEvent({ type: "response.create" });
  };

  const handleServerEvent = (serverEvent: ServerEvent) => {
    logServerEvent(serverEvent);

    if (!serverEvent.delta && serverEvent.type.startsWith("output_audio_buffer")) {
      setIsAIAudioPlaying(serverEvent.type === "output_audio_buffer.started");
    }
    
    if (serverEvent.type.startsWith("input_audio_buffer.speech_")) {
      setIsUserAudioPlaying(serverEvent.type === "input_audio_buffer.speech_started");
    }

    switch (serverEvent.type) {
      case "session.created": {
        // OpenAI Realtime API session created
        if (serverEvent.session?.id) {
          logger.debug({ sessionId: serverEvent.session.id }, 'OpenAI realtime session created');
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "OpenAI Realtime session created",
              {
                id: serverEvent.session.id,
                started: new Date().toLocaleString()
              }
            );
          }
        }
        break;
      }

      case "socket.session.connected": {
        // Socket server connection established (distinct from OpenAI session)
        if (serverEvent.session?.id) {
          logger.debug({ sessionId: serverEvent.session.id }, 'Primer socket session connected, setting status to CONNECTED');
          setSessionStatus("CONNECTED");
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "Primer Socket connected",
              {
                id: serverEvent.session.id,
                connected: new Date().toLocaleString()
              }
            );
          }
        }
        break;
      }

      case "session.updated": {
        // Don't change status on session updates, just log it
        logger.debug({ session: serverEvent.session }, 'Session updated');
        // Notify that session was updated - this will increment sessionConfiguredCount
        // if there was a pending initial configuration
        onSessionUpdated();
        break;
      }

      case "error": {
        logger.error({
          error: serverEvent.error,
          type: serverEvent.error?.type,
          message: serverEvent.error?.message,
          code: serverEvent.error?.code
        }, 'Server error');
        
        // Handle different error types appropriately.
        //
        // Important: `setSessionStatus("DISCONNECTED")` here only flips React
        // state — it does NOT tear down the WebRTC peer connection. So if the
        // underlying connection is still healthy (audio/data channel still
        // flowing), forcing the status to DISCONNECTED creates a split-brain:
        // the user can keep talking to the agent but UI controls (mute,
        // speaker, etc.) gated on `CONNECTED` disappear. Only flip to
        // DISCONNECTED when we're confident the connection itself is dead.
        if (serverEvent.error?.type === 'authentication_error') {
          // Authentication failures usually mean the ephemeral key is
          // dead/expired — the connection cannot recover.
          setSessionStatus("DISCONNECTED");
        } else if (serverEvent.error?.type === 'invalid_request_error') {
          // `invalid_request_error` is the server rejecting a single client
          // event (e.g. a malformed `session.update`). The peer connection
          // itself stays open, so we log/breadcrumb but stay CONNECTED.
          // Tearing the UI down here would mislead the user about the actual
          // connection state.
          logger.warn({
            code: serverEvent.error?.code,
            param: serverEvent.error?.param,
            message: serverEvent.error?.message,
          }, 'Server rejected a client event; connection still healthy');
          if (isDebugModeEnabled) {
            addTranscriptBreadcrumb(
              "Recoverable Error",
              {
                type: serverEvent.error.type,
                code: serverEvent.error.code,
                param: serverEvent.error.param,
                message: serverEvent.error.message,
                action: "Continued (connection still open)"
              }
            );
          }
        } else {
          // For other error types, log but don't disconnect unless we know they're critical
          logger.warn({ type: serverEvent.error?.type }, 'Non-critical error, continuing');
        }
        break;
      }

      // GA Realtime API introduced `conversation.item.added`, fired when a
      // new item is added to the conversation (e.g., immediately after the
      // input audio buffer commits — before the transcript exists). We
      // handle it identically to the legacy `conversation.item.created`
      // event so the user message item gets registered in the transcript
      // panel; otherwise the later `input_audio_transcription.completed`
      // update is a no-op (it can only update existing items) and the
      // user's message never appears.
      case "conversation.item.added":
      case "conversation.item.created": {
        const content = serverEvent.item?.content;
        let text = "";
        
        // Handle regular message content
        if (Array.isArray(content)) {
          text = content[0]?.text || content[0]?.transcript || "";
        }
        
        const role = serverEvent.item?.role as "user" | "assistant" | "system";
        const itemId = serverEvent.item?.id;

        if (itemId && transcriptItems.some((item) => item.itemId === itemId)) {
          break;
        }

        // Only show user and assistant messages in transcript, skip system messages
        if (itemId && role && role !== "system") {
          if (role === "user" && !text) {
            text = "[Transcribing...]";
          }
          addTranscriptMessage(itemId, role, text);
        }
        break;
      }

      // GA Realtime API: emitted when a conversation item is finalized. The
      // event includes the full content of the item (transcript for audio,
      // text for text). This is a defensive catch-all for both user and
      // assistant items — if the `added` / `created` event was missed, or
      // if streaming deltas didn't fire, this still surfaces the message
      // with its final text. Idempotent with the other handlers thanks to
      // the existence check inside `addTranscriptMessage` and the no-op
      // behavior of `updateTranscriptMessage` when nothing changed.
      case "conversation.item.done": {
        const item = serverEvent.item;
        const itemId = item?.id;
        const role = item?.role as "user" | "assistant" | "system" | undefined;
        if (!itemId || !role || role === "system") {
          break;
        }

        const content = item?.content;
        const finalText = Array.isArray(content)
          ? content[0]?.text || content[0]?.transcript || ""
          : "";

        const exists = transcriptItems.some((t) => t.itemId === itemId);
        if (!exists) {
          addTranscriptMessage(itemId, role, finalText);
        } else if (finalText) {
          updateTranscriptMessage(itemId, finalText, false);
        }
        updateTranscriptItemStatus(itemId, "DONE");
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const itemId = serverEvent.item_id;
        const finalTranscript =
          !serverEvent.transcript || serverEvent.transcript === "\n"
            ? "[inaudible]"
            : serverEvent.transcript;
        if (itemId) {
          updateTranscriptMessage(itemId, finalTranscript, false);
        }
        break;
      }

      // GA Realtime API renamed the audio-transcript streaming events:
      //   legacy: response.audio_transcript.{delta,done}
      //   GA:     response.output_audio_transcript.{delta,done}
      // We handle both so non-GA realtime models (e.g. gpt-4o-realtime-preview)
      // still produce transcripts. Without the GA handler, the message item
      // gets created with an empty text and the conversation panel shows a
      // timestamp with no body.
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.output_audio_transcript.done": {
        // Final, complete transcript for the audio output. We replace
        // (append=false) to make sure the rendered text matches the
        // server's authoritative version even if a delta got dropped.
        const itemId = serverEvent.item_id;
        const finalTranscript = serverEvent.transcript || "";
        if (itemId && finalTranscript) {
          updateTranscriptMessage(itemId, finalTranscript, false);
        }
        break;
      }

      case "response.text.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.completed": // Used by Responses API (figure out a nice way to do this)
      case "response.done": {
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (
              outputItem.type === "function_call" &&
              outputItem.name &&
              outputItem.arguments
            ) {
              handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: outputItem.arguments,
              });
            }
          });
        }
        break;
      }

      case "response.in_progress": {
        if (isDebugModeEnabled) {
          addTranscriptBreadcrumb("Response in progress", {
            id: serverEvent.response?.id,
            status: serverEvent.response?.status
          });
        }
        break;
      }

      case "response.output_text.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      case "response.completed": {
        if (serverEvent.response?.output) {
          serverEvent.response.output.forEach((outputItem) => {
            if (outputItem.type === "message" && outputItem.content) {
              outputItem.content.forEach((content) => {
                if (content.type === "output_text" || content.type === "text") {
                  const itemId = outputItem.id;
                  if (itemId) {
                    updateTranscriptMessage(itemId, content.text, false);
                    updateTranscriptItemStatus(itemId, "DONE");
                  }
                }
              });
            }
          });
        }
        break;
      }

      case "response.output_item.added": {
        const itemId = serverEvent.item?.id;
        const role = serverEvent.item?.role as "user" | "assistant";
        if (itemId && role) {
          addTranscriptMessage(itemId, role, "");
        }
        break;
      }

      case "response.output_text.done": {
        const itemId = serverEvent.item_id;
        const text = serverEvent.text || "";
        if (itemId) {
          updateTranscriptMessage(itemId, text, false);
        }
        break;
      }

      case "response.output_item.done": {
        const itemId = serverEvent.item?.id;
        if (itemId) {
          // Safety net: if any streaming transcript deltas were missed
          // (e.g. an event-name mismatch between legacy and GA), use the
          // final text from the item's content array. GA content parts use
          // `type: "output_audio"` (with `transcript`) or `type: "output_text"`
          // (with `text`); legacy used `audio` / `text`. Both expose the same
          // fields, so reading either works regardless of API generation.
          const content = serverEvent.item?.content;
          if (Array.isArray(content)) {
            const finalText =
              content[0]?.text || content[0]?.transcript || "";
            if (finalText) {
              updateTranscriptMessage(itemId, finalText, false);
            }
          }
          updateTranscriptItemStatus(itemId, "DONE");
        }
        break;
      }

      case "conversation.item.create": {
        const content = serverEvent.item?.content;
        let text = "";
        
        // Handle regular message content
        if (Array.isArray(content)) {
          text = content[0]?.text || "";
        }
        
        const role = serverEvent.item?.role as "user" | "assistant";
        const itemId = serverEvent.item?.id;

        if (itemId && role) {
          addTranscriptMessage(itemId, role, text);
        }
        break;
      }

      case "response.failed": {
        logger.error({
          id: serverEvent.response?.id,
          error: serverEvent.response?.error
        }, 'Response failed');
        if (serverEvent.response?.error) {
          const errorMessage = `Error: ${serverEvent.response.error.message}`;
          addTranscriptMessage(`error-${Date.now()}`, "assistant", errorMessage);
        }
        break;
      }

      case "toast.show": {
        // Handle toast notifications from backend
        const { message, type = 'default' } = (serverEvent as { data?: { message?: string; type?: string } }).data || {};
        if (message) {
          toast({
            title: message,
            variant: type === 'destructive' ? 'destructive' : 'default',
          });
        }
        break;
      }

      case "ui.element.show": {
        const data = (serverEvent as any).data;
        handleUIElementShow(data);
        break;
      }

      case "ui.element.hide": {
        const data = (serverEvent as any).data;
        handleUIElementHide(data);
        break;
      }

      case "ui.element.move": {
        const data = (serverEvent as any).data;
        handleUIElementMove(data);
        break;
      }

      case "ui.element.resize": {
        const data = (serverEvent as any).data;
        handleUIElementResize(data);
        break;
      }

      case "ui.element.maximize": {
        const data = (serverEvent as any).data;
        handleUIElementMaximize(data);
        break;
      }

      case "ui.element.destroy": {
        const data = (serverEvent as any).data;
        handleUIElementDestroy(data);
        break;
      }

      case "ui.observe.request": {
        const data = (serverEvent as any).data;
        handleUIObserveRequest(data);
        break;
      }

      case "ui.slide.create": {
        const data = (serverEvent as any).data;
        // Handle async imports in IIFE to avoid making parent function async
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            // Import slide manager utilities
            const { setSlideComponent } = await import('@/app/lib/tools/ui/slides/SlideManager');
            const { generateUUID } = await import('@/app/lib/uuid');
            const React = await import('react');
            const { SlideComponent } = await import('@/app/lib/tools/ui/slides/SlideComponent');
            
            // Generate unique slide ID
            const slideId = `slide-${generateUUID()}`;
            
            // Create the slide component
            const component = React.createElement(SlideComponent, {
              id: slideId,
              title: data.title,
              content: data.content
            });
            
            // Register the slide component (will auto-register with UIElementManager on mount)
            setSlideComponent(slideId, component);
            
            // Send success response back to backend with slideId
            // Use socket.emit directly to avoid wrapping in client:message
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                slideId,
                title: data.title,
                // Include artifact info if this was from showArtifact
                ...(data.artifactId && {
                  artifactId: data.artifactId,
                  artifactName: data.artifactName,
                  artifactType: data.artifactType
                })
              }
            });
            
            logger.debug({ slideId, title: data.title }, 'Slide created successfully');
          } catch (error) {
            logger.error(error, 'Error creating slide');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to create slide'
              }
            });
          }
        })();
        break;
      }

      // Component tool UI events
      case "ui.component.create": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager, createComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            
            let manager = getComponentManager();
            
            // Lazy initialization if needed
            if (!manager && typeof window !== 'undefined' && (window as any).Babel) {
              // Get experienceId from event data (preferred) or sessionStorage
              const experienceId = data.experienceId || sessionStorage.getItem('primer:experience-id');
              const sessionId = sessionStorage.getItem('primer:session-id');
              
              if (sessionId && experienceId) {
                manager = createComponentManager(experienceId, sessionId);
                logger.debug({ experienceId, sessionId }, 'ComponentManager lazily initialized');
              } else {
                logger.warn({ experienceId, sessionId }, 'Missing experienceId or sessionId for ComponentManager initialization');
              }
            }
            
            if (!manager) {
              // Check if Babel is loaded
              const babelLoaded = typeof window !== 'undefined' && !!(window as any).Babel;
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { 
                  error: babelLoaded 
                    ? 'Component manager not initialized. Missing experienceId or sessionId.' 
                    : 'Component manager not initialized. Ensure Babel has loaded.'
                }
              });
              return;
            }
            
            // Create callbacks that emit socket events
            const onEvent = (event: any) => {
              // Re-fetch socket in case it changed
              const currentSocket = getGlobalSocket();
              logger.info({ 
                event, 
                socketConnected: currentSocket?.connected,
                socketId: currentSocket?.id,
                hasSocket: !!currentSocket
              }, 'Component event callback invoked, forwarding via socket');
              
              if (!currentSocket?.connected) {
                logger.error({ hasSocket: !!currentSocket }, 'Socket not connected when trying to emit component event');
                return;
              }
              
              currentSocket.emit('component.event', {
                instanceId: event.instanceId,
                componentId: event.componentId,
                eventType: event.eventType,
                eventData: event.eventData,
                timestamp: event.timestamp
              }, (ack: any) => {
                // Acknowledgment callback (if server responds)
                logger.info({ ack }, 'Component event emit acknowledged');
              });
            };
            
            const onStateChange = (event: any) => {
              logger.debug({ event }, 'Component state changed, forwarding via socket');
              socket.emit('component.stateChange', {
                instanceId: event.instanceId,
                componentId: event.componentId,
                stateChanges: event.stateChanges,
                timestamp: event.timestamp
              });
            };
            
            // Show the component with event callbacks
            logger.info({ componentId: data.componentId, hasOnEvent: !!onEvent, hasOnStateChange: !!onStateChange }, 'Calling showComponent with callbacks');
            const instanceId = await manager.showComponent(
              data.componentId,
              data.initialState || {},
              onEvent,
              onStateChange
            );
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId,
                componentId: data.componentId,
                message: `Component ${data.componentId} created successfully`
              }
            });
            
            logger.debug({ instanceId, componentId: data.componentId }, 'Component created successfully');
          } catch (error) {
            logger.error(error, 'Error creating component');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to create component'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.updateState": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            manager.updateComponentState(data.instanceId, data.stateUpdates);
            const newState = manager.getComponentState(data.instanceId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId: data.instanceId,
                state: newState,
                message: 'Component state updated successfully'
              }
            });
            
            logger.debug({ instanceId: data.instanceId }, 'Component state updated');
          } catch (error) {
            logger.error(error, 'Error updating component state');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to update component state'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.getState": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            const state = manager.getComponentState(data.instanceId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                instanceId: data.instanceId,
                state,
                message: 'Component state retrieved successfully'
              }
            });
            
            logger.debug({ instanceId: data.instanceId }, 'Component state retrieved');
          } catch (error) {
            logger.error(error, 'Error getting component state');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to get component state'
              }
            });
          }
        })();
        break;
      }

      case "ui.component.clearCache": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const manager = getComponentManager();
            
            if (!manager) {
              socket.emit('tool.result', {
                callId: data.callId,
                status: 'error',
                data: { error: 'Component manager not initialized' }
              });
              return;
            }
            
            manager.clearComponentCache(data.componentId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                componentId: data.componentId,
                message: `Cache cleared for component: ${data.componentId}. Next create will reload from disk.`
              }
            });
            
            logger.debug({ componentId: data.componentId }, 'Component cache cleared');
          } catch (error) {
            logger.error(error, 'Error clearing component cache');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : 'Failed to clear component cache'
              }
            });
          }
        })();
        break;
      }

      // Component runtime events are handled directly by RealtimeController
      // for proper injection into the OpenAI Realtime conversation.
      // These cases are kept as no-ops for completeness but shouldn't be reached.
      case "component.event.forward":
      case "component.stateChange.forward":
        // Handled by RealtimeController's direct socket listener
        break;

      // Note tool UI events
      case "ui.note.sync": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.syncFromStorage(data.notes || []);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { synced: true }
            });
            
            logger.debug({ noteCount: data.notes?.length || 0 }, 'Notes synced from server');
          } catch (error) {
            logger.error(error, 'Error syncing notes');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to sync notes' }
            });
          }
        })();
        break;
      }

      case "ui.note.display": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.displayNote(data.note);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { noteId: data.note.id }
            });
            
            logger.debug({ noteId: data.note.id }, 'Note displayed');
          } catch (error) {
            logger.error(error, 'Error displaying note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to display note' }
            });
          }
        })();
        break;
      }

      case "ui.note.hide": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.hideNote(data.noteId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { hidden: true }
            });
            
            logger.debug({ noteId: data.noteId }, 'Note hidden');
          } catch (error) {
            logger.error(error, 'Error hiding note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to hide note' }
            });
          }
        })();
        break;
      }

      case "ui.note.delete": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.deleteNote(data.noteId);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { deleted: true }
            });
            
            logger.debug({ noteId: data.noteId }, 'Note deleted');
          } catch (error) {
            logger.error(error, 'Error deleting note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to delete note' }
            });
          }
        })();
        break;
      }

      case "ui.note.update": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const manager = getNotesManager();
            manager.updateNote(data.noteId, data.updates);
            
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: { updated: true }
            });
            
            logger.debug({ noteId: data.noteId, updates: Object.keys(data.updates) }, 'Note updated');
          } catch (error) {
            logger.error(error, 'Error updating note');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to update note' }
            });
          }
        })();
        break;
      }

      case "ui.note.getScreenDimensions": {
        const data = (serverEvent as any).data;
        (async () => {
          const socket = getGlobalSocket();
          if (!socket) {
            logger.error('No socket available for tool.result');
            return;
          }

          try {
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'success',
              data: {
                width: window.innerWidth,
                height: window.innerHeight,
                safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
              }
            });
            
            logger.debug({ width: window.innerWidth, height: window.innerHeight }, 'Screen dimensions sent');
          } catch (error) {
            logger.error(error, 'Error getting screen dimensions');
            socket.emit('tool.result', {
              callId: data.callId,
              status: 'error',
              data: { error: error instanceof Error ? error.message : 'Failed to get screen dimensions' }
            });
          }
        })();
        break;
      }

      case "tool.response": {
        const data = (serverEvent as any).data;
        handleToolResponse(data);
        break;
      }

      default:
        break;
    }
  };

  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return handleServerEventRef;
}