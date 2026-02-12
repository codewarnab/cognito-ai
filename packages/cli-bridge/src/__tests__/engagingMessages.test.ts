import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCapabilityMessage, createEngagingMessageSender } from '../handlers/engagingMessages';

describe('getCapabilityMessage', () => {
    it('returns a waiting message when tool count is 0', () => {
        const message = getCapabilityMessage(0);
        expect(message).toBe('⏳ Waiting for extension tools...');
    });

    it('includes tool count in message when tools are available', () => {
        const message = getCapabilityMessage(5);
        expect(message).toContain('(5 tools)');
    });

    it('includes tool count for 1 tool', () => {
        const message = getCapabilityMessage(1);
        expect(message).toContain('(1 tools)');
    });
});

describe('createEngagingMessageSender', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends first message immediately on start()', () => {
        vi.useFakeTimers();
        const sendEvent = vi.fn();
        const sender = createEngagingMessageSender(sendEvent, 3000);

        sender.start();
        expect(sendEvent).toHaveBeenCalledTimes(1);
        expect(sendEvent).toHaveBeenCalledWith('status', expect.objectContaining({ message: expect.any(String) }));

        sender.stop();
    });

    it('sends additional messages at intervals', () => {
        vi.useFakeTimers();
        const sendEvent = vi.fn();
        const sender = createEngagingMessageSender(sendEvent, 1000);

        sender.start();
        expect(sendEvent).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(sendEvent).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);
        expect(sendEvent).toHaveBeenCalledTimes(3);

        sender.stop();
    });

    it('stops sending messages when stop() is called', () => {
        vi.useFakeTimers();
        const sendEvent = vi.fn();
        const sender = createEngagingMessageSender(sendEvent, 1000);

        sender.start();
        sender.stop();

        const countAfterStop = sendEvent.mock.calls.length;

        vi.advanceTimersByTime(5000);
        expect(sendEvent).toHaveBeenCalledTimes(countAfterStop);
    });

    it('auto-stops after 5 messages', () => {
        vi.useFakeTimers();
        const sendEvent = vi.fn();
        const sender = createEngagingMessageSender(sendEvent, 100);

        sender.start(); // 1st message

        // Advance enough time for all interval messages to fire
        vi.advanceTimersByTime(10000);

        // Should have at most 5 messages (1 immediate + 4 interval)
        expect(sendEvent.mock.calls.length).toBeLessThanOrEqual(5);

        sender.stop();
    });
});
