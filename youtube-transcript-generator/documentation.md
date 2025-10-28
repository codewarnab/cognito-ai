# YouTube Transcript Service Documentation# YouTube Transcript and Video Info Service Documentation



------



## **Overview**## **Overview**



This Express-based service fetches YouTube video transcripts (subtitles/captions). It uses the `@distube/ytdl-core` library to extract video metadata and the `youtube-transcript-api` library to retrieve subtitles, with a fallback mechanism to manually scrape caption URLs when needed.This Express-based service fetches YouTube video information (metadata) and transcripts (subtitles) in any available language. It uses the `ytdl-core` library to extract video metadata and the `youtube-captions-scraper` library to retrieve subtitles. Firebase Firestore is used to cache the results (transcripts and summaries) to prevent repetitive fetching and improve performance.



The service is designed to be deployed on Vercel as a serverless function or run locally as a standalone Express server.---



---## **Service Endpoints**



## **Service Endpoints**### 1. **POST `/smart-transcript-v2`**



### 1. **GET `/health`****Description**

Checks Firestore for a transcript of the YouTube video. If missing, fetches transcript, title, description, date, image, inferred tags, and stores them all in Firestore.

**Description**

A simple health check endpoint to verify that the service is running.**Request Body:**



**Response:**```json

{

```text  "url": "https://www.youtube.com/watch?v=VIDEO_ID"

OK}

``````



---**Response 200:**



### 2. **GET `/debug`**```json

{

**Description**  "videoID": "VIDEO_ID",

Provides debug information, including the client's IP address and the server's region. Useful for debugging and monitoring.  "title": "Video Title",

  "duration": 14,

**Response:**  "transcript": "Full transcript text...",

  "description": "First line of the video description",

```json  "date": "2025-01-26",

{  "image": "https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg",

  "ip": "123.456.789.000",  "tags": ["ios", "automation", "shortcuts"],

  "region": "iad1"  "canonical_url": "https://blog.andreszenteno.com/notes/video-title"

}}

``````



- **`ip`**: IP address of the requester (from headers or socket).---

- **`region`**: Server region (e.g., Vercel region or `local` if running locally).

### 2. **POST `/smart-summary-firebase-v2`**

---

**Description**

### 3. **POST `/simple-transcript`**Checks Firestore for an existing summary. If not found, generates an AI-powered summary and tags using OpenAI, formats it with Markdown frontmatter, and saves it to `summaries` and `transcripts` collections.



**Description****Request Body:**

Fetches the YouTube video transcript along with basic metadata (title and duration). Returns a simplified version with the video title and a concatenated string of subtitles in the first available language.

```json

**Request Body:**{

  "url": "https://www.youtube.com/watch?v=VIDEO_ID",

```json  "model": "openai"

{}

  "url": "https://www.youtube.com/watch?v=VIDEO_ID"```

}

```**Response 200:**



- **`url`** (required): The URL of the YouTube video.```json

{

**Response 200 (Success):**  "summary": "---\ntitle: \"Video Title\"\ndate: 2025-01-26\ntags:\n  - ios\n  - automation\n  - shortcuts\n---\n...summary...",

  "fromCache": false

```json}

{```

  "duration": 14,

  "title": "How to Build a Chrome Extension",* Uses the deployed AI service `/api/openai-chat-youtube-transcript-v2` to fetch `summary` and `tags`.

  "transcript": "Hello everyone, welcome to this tutorial. In this video, we will learn how to build a Chrome extension..."* Markdown-compatible output can be used in Obsidian, static blogs, etc.

}* Tags are stored in both collections for indexing and reuse.

```

---

- **`duration`**: Duration of the video in minutes (calculated from video length in seconds).

- **`title`**: Title of the video.### 3. **POST `/transcript`**

- **`transcript`**: Full transcript as a single concatenated string.

This endpoint retrieves full YouTube video information and timestamped captions (subtitles) in all available languages. It fetches video metadata (e.g., title, description, etc.) and subtitles (with timestamps) for all languages supported by the video.

**Response 400 (Bad Request):**

#### **Request Body:**

```json

{```json

  "message": "URL is required in the request body."{

}  "url": "https://www.youtube.com/watch?v=VIDEO_ID"

```}

```

**Response 404 (No Captions Available):**

- `url`: The URL of the YouTube video from which you want to fetch the transcript and video info.

```json

{#### **Response:**

  "message": "No captions available for this video.",

  "details": "This video does not have any subtitles or closed captions."```json

}{

```  "status": "success",

  "status_code": 200,

**Response 503 (YouTube Blocked Request):**  "message": "success",

  "data": {

```json    "videoID": "VIDEO_ID",

{    "videoInfo": {

  "message": "YouTube blocked the request. This video may have restrictions or YouTube has updated their API.",      "name": "Video Title",

  "details": "Status code: 410",      "thumbnailUrl": {

  "videoId": "VIDEO_ID"        "hqdefault": "URL"

}      },

```      "embedUrl": "https://www.youtube.com/embed/VIDEO_ID",

      "duration": 120,

**Response 500 (General Error):**      "description": "Video description",

      "upload_date": "2025-01-01",

```json      "genre": "Music",

{      "author": "Video Author",

  "message": "An error occurred while fetching the simple transcript.",      "channel_id": "CHANNEL_ID"

  "details": "Error description here",    },

  "videoId": "VIDEO_ID"    "language_code": [

}      {

```        "code": "en",

        "name": "English"

---      },

      {

## **How It Works**        "code": "es",

        "name": "Spanish"

### Transcript Fetching Strategy      }

    ],

The service uses a two-tier approach to fetch transcripts:    "transcripts": {

      "en": {

1. **Primary Method**: Uses the `youtube-transcript-api` library to fetch transcripts directly.        "custom": [

2. **Fallback Method**: If the primary method fails, the service:          {

   - Uses `@distube/ytdl-core` to fetch video information and caption track URLs            "start": 0,

   - Manually scrapes the caption XML from YouTube's signed URLs            "end": 10,

   - Parses the XML to extract transcript text with timestamps            "text": "Hello World"

          },

### Video Information          ...

        ]

The service extracts the following information from YouTube:      },

- Video title      "es": {

- Video duration (in seconds, converted to minutes)        "custom": [

- Caption tracks (language codes and base URLs)          {

            "start": 0,

### Error Handling            "end": 10,

            "text": "Hola Mundo"

The service provides detailed error messages for common issues:          },

- **Missing URL**: Returns 400 if no URL is provided          ...

- **No Captions**: Returns 404 if the video has no subtitles        ]

- **YouTube Blocking**: Returns 503 if YouTube blocks the request (HTTP 410)      }

- **Video Unavailable**: Returns 404 if the video is private or unavailable    }

- **Disabled Transcripts**: Returns 404 if transcripts are disabled for the video  }

}

---```



## **Dependencies**- **`videoID`**: Unique ID for the YouTube video.

- **`videoInfo`**: Metadata about the video, such as title, description, duration, etc.

- **`express`**: Web framework for creating the API- **`language_code`**: A list of available languages for the subtitles.

- **`@distube/ytdl-core`**: YouTube video information extractor- **`transcripts`**: An object containing subtitles in all available languages with their respective timestamps and text.

- **`youtube-transcript-api`**: Primary library for fetching transcripts

- **`axios`**: HTTP client for fetching caption XML---

- **`he`**: HTML entity decoder for cleaning transcript text

- **`cors`**: Enable CORS for cross-origin requests### 4. **POST `/simple-transcript`**

- **`dotenv`**: Load environment variables

This endpoint returns a simplified version of the transcript, which includes the video title and a concatenated string of subtitles in the first available language.

---

#### **Request Body:**

## **Deployment**

```json

### Vercel (Serverless){

  "url": "https://www.youtube.com/watch?v=VIDEO_ID"

The service is designed to work with Vercel's serverless functions. Simply deploy the project to Vercel, and the Express app will be automatically wrapped as a serverless function.}

```

### Local Development

- `url`: The URL of the YouTube video.

To run the service locally:

#### **Response:**

```bash

node index.js```json

```{

  "duration": 14,

The server will start on port 3000 (or the port specified in the `PORT` environment variable).  "title": "Video Title",

  "transcript": "This is the transcript..."

---}

```

## **Logging**

- **`duration`**: Duration of the video in minutes.

The service logs all incoming requests with the following information:- **`title`**: Title of the video.

- HTTP method and endpoint- **`transcript`**: Full transcript as a concatenated string.

- IP address

- User agent

- Referer

- Timestamp



All transcript fetching operations are logged with detailed information about the fetching process, including which method (TranscriptAPI or manual scrape) was used.

Perfect — here’s a clean and concise version for **API docs / OpenAPI / Swagger style documentation**:

---

---

## **Implementation Details**

### 5. **POST `/simple-transcript-v3`**

### XML Parsing

**Description**

When falling back to manual scraping, the service parses YouTube's transcript XML format:Fetches and returns the transcript of a YouTube video in a requested language (or default language if not specified). Caches transcripts per language for faster future access.



```xml**Request Body**

<?xml version="1.0" encoding="utf-8" ?>

<transcript>```json

  <text start="0" dur="2.5">Hello World</text>{

  <text start="2.5" dur="3.0">This is a transcript</text>  "url": "string (required) - YouTube video URL",

</transcript>  "lang": "string (optional) - Language code (e.g. en, es, en-US)"

```}

```

The parser extracts:

- `start`: Start time in seconds**Response 200**

- `dur`: Duration in seconds

- `text`: Caption text (HTML decoded)```json

{

### Request Headers  "videoID": "string",

  "duration": "number (minutes)",

For manual scraping, the service uses the following headers to mimic a browser request:  "title": "string",

  "transcript": "string",

```javascript  "transcriptLanguageCode": "string",

{  "languages": [

  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',    { "code": "string" }

  'Accept-Language': 'en-US,en;q=0.9',  ],

  'Referer': 'https://www.youtube.com/',  "videoInfoSummary": {

  'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9...'    "author": "string",

}    "description": "string",

```    "embed": "object",

    "thumbnails": "array",

### Language Selection    "viewCount": "string",

    "publishDate": "string",

The service automatically selects the first available caption language from the video. If multiple languages are available, it defaults to the first one in the caption tracks list.    "video_url": "string"

  }

---}

```

## **Example Usage**

**Response 404**

### cURL Example

```json

```bash{

curl -X POST https://your-service.vercel.app/simple-transcript \  "message": "No captions available for this video."

  -H "Content-Type: application/json" \}

  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'```

```

**Response 500**

### JavaScript Example

```json

```javascript{

const response = await fetch('https://your-service.vercel.app/simple-transcript', {  "message": "An error occurred while fetching and saving the transcript."

  method: 'POST',}

  headers: {```

    'Content-Type': 'application/json',

  },**Notes**

  body: JSON.stringify({

    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'* `languages` is only included if more than one caption language is available.

  })* Cached transcripts are automatically updated and stored by video ID and language.

});

---

const data = await response.json();

console.log(data.title);### 6. **POST `/smart-transcript`**

console.log(data.transcript);

```This endpoint checks Firestore for an existing transcript for the specified YouTube video. If it exists, the cached version is returned. If not, it fetches the transcript, stores it in Firestore, and returns the result.



---#### **Request Body:**


```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

- `url`: The URL of the YouTube video.

#### **Response:**

```json
{
  "videoID": "VIDEO_ID",
  "title": "Video Title",
  "duration": 14,
  "transcript": "Full transcript text..."
}
```

- **`videoID`**: Unique video ID.
- **`title`**: Video title.
- **`duration`**: Video duration in minutes.
- **`transcript`**: Full transcript.

---

### 7. **POST `/smart-summary`**

This endpoint checks Firestore for a summary of the specified YouTube video. If a summary exists, it is returned from the cache. If not, the service uses the provided transcript (or fetches it from YouTube) and generates a summary using a model (e.g., ChatGPT).

#### **Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "transcript": "Optional: transcript string",
  "model": "chatgpt"  // Can be 'chatgpt', 'deepseek', or 'anthropic'
}
```

- `url`: The URL of the YouTube video.
- `transcript`: Optional parameter; provide if you already have the transcript.
- `model`: Specify which model to use for generating the summary (e.g., `chatgpt`, `deepseek`, `anthropic`).

#### **Response:**

```json
{
  "summary": "This is the summary of the transcript.",
  "fromCache": true
}
```

- **`summary`**: The generated summary.
- **`fromCache`**: Indicates whether the summary was retrieved from Firestore (`true`) or freshly generated (`false`).

---

### 8. **POST `/smart-summary-firebase`**

This endpoint operates similarly to `/smart-summary`, but it offloads the summary generation and caching to Firestore itself. It sends only the video ID to a model to generate the summary, stores it in Firestore, and returns the summary.

#### **Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "model": "chatgpt"
}
```

- `url`: The URL of the YouTube video.
- `model`: Specify which model to use for generating the summary (e.g., `chatgpt`, `deepseek`, `anthropic`).

#### **Response:**

```json
{
  "summary": "This is the summary of the transcript.",
  "fromCache": true
}
```

- **`summary`**: The generated summary.
- **`fromCache`**: Indicates whether the summary was retrieved from Firestore (`true`) or freshly generated (`false`).

---

### 9. **GET `/health`**

A simple health check endpoint to verify that the service is running.

#### **Response:**

```text
OK
```

---

### 10. **GET `/debug`**

A debug endpoint that returns the IP address and region of the requestor.

#### **Response:**

```json
{
  "ip": "IP_ADDRESS",
  "region": "REGION"
}
```

- **`ip`**: IP address of the requester.
- **`region`**: Region where the server is running (e.g., `local` or `VERCEL_REGION` if deployed).

---

### 11. **POST `/smart-summary-firebase-v3`**

This endpoint enhances `/smart-summary-firebase-v2` by retrieving rich metadata (e.g., category, video author, published date) from Firestore. It generates a structured summary using an external model endpoint and wraps the result in a Markdown document with YAML frontmatter. The summary is then cached in Firestore for future requests.

#### **Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "model": "chatgpt"  // Or "anthropic", "deepseek", etc.
}
```

- **`url`**: Full YouTube video URL.
- **`model`**: AI model to use for summary generation.

### **Response**

```json
{
  "summary": "---\\ntitle: \\"...\\",\\ndate: ...\\ndescription: ...\\ntags: [...]\\n---\\nSummary content...",
  "fromCache": false
}
```
- **`summary`**: Full Markdown output with frontmatter.
- **`fromCache`**: true if retrieved from Firestore, otherwise false.

### **Highlights:**

- Adds extended metadata to the summary frontmatter (e.g., video_author, published_date, video_id, etc.).
- Sends only the videoID to the AI endpoint for summary generation.
- Stores result in summaries collection in Firestore.

---

## **Firebase Firestore Caching**

The service uses Firebase Firestore to cache transcripts and summaries for YouTube videos. If a transcript or summary has already been processed for a video, it will be fetched from Firestore to avoid redundant processing.

### Firestore Collection Structure

- **`transcripts`**: Contains documents for each YouTube video with the video ID as the document ID. The document contains the full transcript and metadata.
- **`summaries`**: Contains documents for each YouTube video with the video ID as the document ID. The document contains the video summary.

---

## **Usage with Firebase**

Before using the Firebase caching system, you must set up Firebase Firestore and create a service account key:

1. **Create a Firebase Project** and enable Firestore.
2. **Generate a Firebase Admin SDK Service Account Key** and save it as `firebaseServiceAccount.json`.
3. **Place the `firebaseServiceAccount.json` file** in the root of the project.
4. **Ensure that Firestore is enabled** for your Firebase project.

---

