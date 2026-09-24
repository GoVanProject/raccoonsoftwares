"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "taskboard_token";

export function getTaskboardToken() {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(TOKEN_KEY);
}

export function saveTaskboardToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function removeTaskboardToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function useTaskboardToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTokenState(getTaskboardToken());
    setReady(true);
  }, []);

  const setToken = useCallback((nextToken: string) => {
    saveTaskboardToken(nextToken);
    setTokenState(nextToken);
  }, []);

  const clearToken = useCallback(() => {
    removeTaskboardToken();
    setTokenState(null);
  }, []);

  return { token, ready, setToken, clearToken };
}
