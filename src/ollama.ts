import { RequestInit } from 'node-fetch';

export type OllamaOptions = {
  model?: string;
  timeoutMs?: number;
};

export async function generateWithOllama(prompt: string, options?: OllamaOptions): Promise<string> {
  const model = options?.model || 'llama2';
  const url = 'http://localhost:11434/api/generate';

  const body = { model, prompt };

  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };

  // Use global fetch (Node 18+). If not available, the runtime will throw.
  const res = await fetch(url, init as any);
  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  // Try JSON parse, otherwise return text
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const json = await res.json();
    // Attempt to extract text from known shapes
    if (typeof json === 'string') return json;
    if (json?.generation && typeof json.generation === 'string') return json.generation;
    if (Array.isArray(json.choices) && json.choices[0]?.content) {
      return String(json.choices[0].content);
    }
    // Fallback to JSON stringify
    return JSON.stringify(json);
  }

  return await res.text();
}
