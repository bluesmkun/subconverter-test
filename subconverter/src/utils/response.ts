export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function success<T>(data: T, message?: string): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export function error(message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export function corsResponse(body: string, contentType: string = 'text/plain'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
  });
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function parseBody<T>(request: Request): Promise<T> {
  return request.json<T>();
}

export function getParam(request: Request, key: string): string | null {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}
