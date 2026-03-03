import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>,
  hasAudio: boolean = true,
  model: string = "gpt-4o-realtime-preview"
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
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

  const baseUrl = "https://api.openai.com/v1/realtime";

  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
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