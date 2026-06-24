import { useEffect, useRef } from 'react';

export const useWebSocket = (onMessageCallback) => {
  const callbackRef = useRef(onMessageCallback);

  // Update callback reference on every render to avoid stale closures
  useEffect(() => {
    callbackRef.current = onMessageCallback;
  }, [onMessageCallback]);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:5001/ws`;
    
    let socket;
    let reconnectTimeout;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('🔌 Connected to WebSocket server');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (callbackRef.current) {
            callbackRef.current(data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('🔌 WebSocket disconnected. Reconnecting in 3 seconds...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('⚠️ WebSocket error:', err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null; // Prevent reconnect on cleanup
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []); // Run only once on mount
};
