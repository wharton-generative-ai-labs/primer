import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>,
  hasAudio: boolean = true,
  // The model parameter is no longer used by the GA endpoint (the model is
  // bound to the ephemeral key by /v1/realtime/client_secrets) but is kept
  // in the signature for backwards compatibility with existing callers.
  _model: string = "gpt-realtime"
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  void _model;
  const pc = new RTCPeerConnection();

  if (hasAudio) {
    pc.ontrack = (e) => {
      if (hasAudio && audioElement.current) {
        audioElement.current.srcObject = e.streams[0];
      }
    };

    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    ms.getTracks().forEach(track => pc.addTrack(track));
  } else {
    // For text-only mode, add a dummy audio transceiver to satisfy the API requirement
    pc.addTransceiver('audio', { direction: 'inactive' });
  }

  const dc = pc.createDataChannel("oai-events");

  // Always include audio in the offer, but mark it as inactive for text-only mode
  const offerOptions: RTCOfferOptions = { offerToReceiveAudio: true };
  const offer = await pc.createOffer(offerOptions);

  await pc.setLocalDescription(offer);

  // Wait for ICE candidate gathering to complete before sending the offer.
  // Chrome gathers candidates inline so skipping this works there, but
  // Firefox gathers asynchronously — sending an incomplete SDP can cause
  // ICE negotiation to use sub-optimal or missing candidates. Cap at 3 s
  // so a broken network environment can't stall indefinitely.
  if (pc.iceGatheringState !== "complete") {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }, 3000);

      function onStateChange() {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          pc.removeEventListener("icegatheringstatechange", onStateChange);
          resolve();
        }
      }

      pc.addEventListener("icegatheringstatechange", onStateChange);
    });
  }

  // GA Realtime WebRTC endpoint. The legacy POST /v1/realtime?model=...
  // path does not support newer models like gpt-realtime-2; the GA endpoint
  // is /v1/realtime/calls and the model is already bound to the ephemeral
  // key by /v1/realtime/client_secrets, so no `?model=` query is needed.
  // See: https://developers.openai.com/api/docs/guides/realtime-webrtc
  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    // Use the live localDescription (includes all gathered ICE candidates)
    // rather than the original offer snapshot.
    body: pc.localDescription!.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answerSdp = await sdpResponse.text();

  // Try to parse the response as JSON in case it's an error message
  try {
    const jsonResponse = JSON.parse(answerSdp);
    if (jsonResponse.error) {
      throw new Error(`API Error: ${jsonResponse.error.message}`);
    }
  } catch {
    // Not JSON, which is expected for SDP
  }

  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  await pc.setRemoteDescription(answer);

  return { pc, dc };
} 