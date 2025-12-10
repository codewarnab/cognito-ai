export interface Env {
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_AGENT_ID: string;
}

interface TTSRequestBody {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    
    // CORS: Allow any chrome-extension:// origin OR localhost for development
    const isAllowedOrigin = 
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://localhost');

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Endpoint: GET /api/signed-url
    if (url.pathname === '/api/signed-url' && request.method === 'GET') {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${env.ELEVENLABS_AGENT_ID}`,
          {
            headers: {
              'xi-api-key': env.ELEVENLABS_API_KEY,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ElevenLabs API error:', response.status, errorText);
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json() as { signed_url: string };
        
        return new Response(
          JSON.stringify({ signedUrl: data.signed_url }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('Error getting signed URL:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate signed URL' }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Endpoint: GET /api/voices - List available voices
    if (url.pathname === '/api/voices' && request.method === 'GET') {
      try {
        const response = await fetch(
          'https://api.elevenlabs.io/v1/voices',
          {
            headers: {
              'xi-api-key': env.ELEVENLABS_API_KEY,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json() as { voices: unknown[] };
        
        return new Response(
          JSON.stringify({ voices: data.voices }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('Error fetching voices:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch voices' }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Endpoint: GET /api/health - Health check
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Endpoint: POST /api/text-to-speech - Convert text to speech
    if (url.pathname === '/api/text-to-speech' && request.method === 'POST') {
      try {
        const body: unknown = await request.json();
        
        // Validate request body
        if (!body || typeof body !== 'object') {
          return new Response(
            JSON.stringify({ error: 'Invalid request body' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const { text, voice_id, model_id, voice_settings } = body as TTSRequestBody;

        if (!text || typeof text !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Text is required' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        if (!voice_id || typeof voice_id !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Voice ID is required' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Prepare request body for ElevenLabs API
        const elevenLabsBody: Record<string, unknown> = {
          text,
          model_id: model_id || 'eleven_multilingual_v2',
        };

        if (voice_settings) {
          elevenLabsBody.voice_settings = {
            stability: voice_settings.stability ?? 0.5,
            similarity_boost: voice_settings.similarity_boost ?? 0.75,
            style: voice_settings.style ?? 0,
            use_speaker_boost: voice_settings.use_speaker_boost ?? true,
            speed: voice_settings.speed ?? 1.0,
          };
        }

        // Call ElevenLabs TTS Streaming API for faster time-to-first-audio
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': env.ELEVENLABS_API_KEY,
            },
            body: JSON.stringify(elevenLabsBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ElevenLabs TTS API error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
            {
              status: response.status,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Stream the audio response directly to the client
        // This allows playback to begin before the full audio is generated
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
          },
        });
      } catch (error) {
        console.error('Error in text-to-speech:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate speech' }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
