/**
 * Reminders Handler
 *
 * Handles reminder-related external messages:
 * - GET_REMINDERS: Get all active reminders
 * - CREATE_REMINDER: Create a new reminder
 * - UPDATE_REMINDER: Update an existing reminder
 * - DELETE_REMINDER: Delete a reminder
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    CreateReminderPayload,
    UpdateReminderPayload,
    DeleteReminderPayload,
    Reminder,
} from '@cognito/shared';
import {
    getActiveReminders,
    saveReminder,
    deleteReminder,
    updateReminder,
} from '@/actions/reminder/storage';
import { successResponse, errorResponse } from '../utils';
import { RemindersBroadcaster } from '../remindersBroadcaster';

const log = createLogger('ExternalMessaging:Reminders', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const REMINDER_MESSAGE_TYPES = [
    'GET_REMINDERS',
    'CREATE_REMINDER',
    'UPDATE_REMINDER',
    'DELETE_REMINDER',
] as const;

/**
 * Handle reminder-related messages
 */
export async function handleReminderMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_REMINDERS':
            return handleGetReminders();

        case 'CREATE_REMINDER':
            return handleCreateReminder(message.payload as CreateReminderPayload);

        case 'UPDATE_REMINDER':
            return handleUpdateReminder(message.payload as UpdateReminderPayload);

        case 'DELETE_REMINDER':
            return handleDeleteReminder(message.payload as DeleteReminderPayload);

        default:
            return null;
    }
}

/**
 * Handle GET_REMINDERS message
 */
async function handleGetReminders(): Promise<ExternalResponse> {
    try {
        const reminders = await getActiveReminders();
        return successResponse(reminders);
    } catch (error) {
        log.error('Failed to get reminders', error);
        return errorResponse('Failed to get reminders');
    }
}

/**
 * Handle CREATE_REMINDER message
 */
async function handleCreateReminder(
    payload: CreateReminderPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        const id = crypto.randomUUID();
        const reminder: Reminder = {
            id,
            title: payload.title,
            when: payload.when,
            createdAt: Date.now(),
            generatedTitle: payload.generatedTitle,
            generatedDescription: payload.generatedDescription,
            repeat: payload.repeat || 'none',
        };

        await saveReminder(reminder);
        await chrome.alarms.create(`reminder:${id}`, { when: reminder.when });

        log.info('Created reminder via external message', { id });

        // Broadcast update to connected webapp pages
        RemindersBroadcaster.broadcastUpdate();

        return successResponse(reminder);
    } catch (error) {
        log.error('Failed to create reminder', error);
        return errorResponse('Failed to create reminder');
    }
}

/**
 * Handle UPDATE_REMINDER message
 */
async function handleUpdateReminder(
    payload: UpdateReminderPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload?.id || !payload?.updates) {
            return errorResponse('Missing id or updates in payload');
        }

        const updated = await updateReminder(payload.id, payload.updates);

        // Reschedule alarm if time changed
        if (payload.updates.when !== undefined) {
            await chrome.alarms.clear(`reminder:${payload.id}`);
            if (!updated.isPaused) {
                await chrome.alarms.create(`reminder:${payload.id}`, {
                    when: updated.when,
                });
            }
        }

        log.info('Updated reminder via external message', { id: payload.id });

        // Broadcast update to connected webapp pages
        RemindersBroadcaster.broadcastUpdate();

        return successResponse(updated);
    } catch (error) {
        log.error('Failed to update reminder', error);
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to update reminder'
        );
    }
}

/**
 * Handle DELETE_REMINDER message
 */
async function handleDeleteReminder(
    payload: DeleteReminderPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload?.id) {
            return errorResponse('Missing id in payload');
        }

        // Clear the alarm first
        await chrome.alarms.clear(`reminder:${payload.id}`);
        // Delete from storage
        await deleteReminder(payload.id);

        log.info('Deleted reminder via external message', { id: payload.id });

        // Broadcast update to connected webapp pages
        RemindersBroadcaster.broadcastUpdate();

        return successResponse();
    } catch (error) {
        log.error('Failed to delete reminder', error);
        return errorResponse('Failed to delete reminder');
    }
}
