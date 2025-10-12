# Processing Status UI Implementation

## Overview
Added real-time processing status UI to the History page to show which pages are currently being processed and display queue progress.

## Changes Made

### 1. Backend Changes

#### `src/background/queue.ts`
- Added `getQueueStats()` function that returns:
  - `pending`: Number of pages waiting to be processed
  - `failed`: Number of permanently failed pages
  - `total`: Total pages in queue
  - `oldestPending`: Details about the oldest page in queue (url, title, age)

#### `src/background/scheduler.ts`
- Added tracking of current processing batch:
  - `currentBatch`: Array of currently processing jobs with url and title
  - `currentBatchStartTime`: Timestamp when current batch started
- Added `getProcessingStatus()` function that returns:
  - `isProcessing`: Whether scheduler is currently processing
  - `currentBatch`: Array of jobs being processed
  - `processingCount`: Number of pages in current batch
  - `processingDuration`: How long current batch has been processing

#### `src/background/types.ts`
- Added new message types:
  - `GetQueueStats`: Request queue statistics
  - `GetProcessingStatus`: Request current processing status

#### `src/background/message-handler.ts`
- Added message handlers for:
  - `GetQueueStats`: Returns queue statistics
  - `GetProcessingStatus`: Returns current processing status

### 2. Frontend Changes

#### `src/pages/history/components.tsx`
- Added new `ProcessingStatus` component that displays:
  - **Index Stats**: Number of indexed pages and storage size
  - **Queue Stats**: Number of pending pages and failed pages
  - **Processing Status**: Real-time view of currently processing pages
  - **Currently Processing**: Live list of pages being processed with titles and URLs
  - **Next in Queue**: Shows the oldest pending page when idle
  - **Idle State**: Shows "All caught up!" when queue is empty

#### `src/pages/history/history.css`
- Added comprehensive styles for the processing status component:
  - Grid layout for statistics
  - Animated pulse effect for active processing
  - Spinning emoji for processing indicator
  - Color-coded stats (warning for failures, accent for active processing)
  - Responsive design for mobile devices

#### `src/pages/history/index.tsx`
- Added state management for queue and processing status
- Added periodic polling (every 2 seconds) to fetch:
  - Queue statistics
  - Processing status
- Integrated `ProcessingStatus` component into the page layout

## Features

### Real-time Updates
- Queue stats update every 2 seconds
- Shows live processing status
- Displays current batch of pages being processed

### Visual Feedback
- Animated pulse effect on active processing stats
- Spinning hourglass emoji (⏳) for processing indicator
- Color-coded stats:
  - Blue (accent) for active processing
  - Orange for warnings/failures
  - Green checkmark for idle/completed state

### Information Display
- **Indexed Pages**: Total pages in search index with storage size
- **Queue**: Number of pending pages waiting to be processed
- **Failed**: Pages that permanently failed (max retries reached)
- **Processing**: Current batch count and duration
- **Currently Processing**: List of pages with titles and URLs being processed right now
- **Next in Queue**: Shows the oldest pending page when not actively processing
- **Age Information**: Shows how long a page has been waiting in the queue

### User Experience
- Truncated URLs for better readability (max 50 chars)
- Human-readable time formats (e.g., "2m 30s ago", "1h 15m ago")
- Tooltips show full URLs on hover
- Responsive design works on all screen sizes

## Usage

The processing status is automatically displayed on the History page when:
1. The model is ready
2. There are pages in the queue OR pages currently being processed

The component will show:
- Real-time updates of processing progress
- Which specific pages are being processed
- How many pages are waiting
- Any failed pages that need attention

## Performance

- Lightweight polling every 2 seconds
- Minimal data transfer (only stats, not full queue)
- No impact on search or processing performance
- Automatically stops polling when page is closed
