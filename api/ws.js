// Note: Vercel doesn't natively support WebSocket in Serverless Functions.
// This is a workaround using their Edge Functions with WebSocket support.

export const config = {
  runtime: 'edge',
};

// This would be the WebSocket handler for Vercel Edge Functions
// Since Vercel doesn't fully support persistent WebSocket connections
// in Serverless Functions, you might need to use a different approach:

// Option 1: Use a WebSocket service like Pusher, Ably, or Socket.io with Redis
// Option 2: Deploy the server separately on a platform that supports WebSockets
// Option 3: Use Server-Sent Events (SSE) instead of WebSockets

// For now, here's a basic implementation that would work with Edge Functions:

export default async function handler(request) {
  // Check if it's a WebSocket upgrade request
  if (request.headers.get('upgrade') === 'websocket') {
    // This requires Edge Runtime with WebSocket support
    const { socket, response } = Deno.upgradeWebSocket(request);
    
    // Handle WebSocket events
    socket.onopen = () => {
      console.log('WebSocket connection opened');
      socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to game server' }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle game messages here
        console.log('Received:', data);
        
        // Echo back for testing
        socket.send(JSON.stringify({ type: 'echo', data }));
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return response;
  }
  
  // Regular HTTP request
  return new Response(JSON.stringify({
    message: 'Platform Fighter Game Server',
    websocket: 'Available at /api/ws',
    status: 'online'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
