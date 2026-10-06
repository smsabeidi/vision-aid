import { useCallback, useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";

import { useSettings } from "@/hooks/use-settings";

export function useAnalysisSpeech(text: string, autoStart = false) {
  const [settings] = useSettings();
  const [speaking, setSpeaking] = useState(false);
  const autoStarted = useRef(false);

  const stop = useCallback(() => {
    void Speech.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback(() => {
    void Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      language: "en-US",
      rate: 0.48,
      pitch: 1,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [text]);

  const toggle = useCallback(() => {
    if (speaking) stop();
    else speak();
  }, [speak, speaking, stop]);

  useEffect(() => {
    if (!autoStart || !settings.autoSpeak || autoStarted.current || !text) return;
    autoStarted.current = true;
    const timer = setTimeout(speak, 450);
    return () => clearTimeout(timer);
  }, [autoStart, settings.autoSpeak, speak, text]);

  useEffect(() => stop, [stop]);

  return { speak, speaking, stop, toggle };
}

