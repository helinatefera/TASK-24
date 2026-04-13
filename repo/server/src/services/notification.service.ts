import { logger } from '../utils/logger';

/**
 * Notification template definitions.
 *
 * Variable contract: every placeholder like {{var_name}} must be supplied in the
 * data object passed to renderTemplate(). DateTime-typed values (those ending in
 * `_time` or `_date`) are formatted with timezone via formatDateTime() before
 * interpolation so the rendered text is human-readable.
 */
export const NOTIFICATION_TEMPLATES: Record<string, string> = {
  booking_reminder:
    'Reminder: Your event "{{job_title}}" is scheduled for {{event_time}}. Please ensure all arrangements are confirmed.',
  booking_confirmation:
    'Your booking for "{{job_title}}" on {{event_time}} has been confirmed.',
};

/**
 * Format a Date value into a human-readable, timezone-aware string.
 */
export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Render a notification template by replacing {{placeholder}} tokens with
 * the corresponding values from `data`.
 *
 * - Keys ending with `_time` or `_date` are treated as DateTime and formatted
 *   via formatDateTime() so they render with timezone context.
 * - All other values are interpolated as-is.
 * - Any unresolved {{...}} placeholders after rendering indicate a caller bug
 *   and are logged as warnings.
 */
export function renderTemplate(
  templateKey: string,
  data: Record<string, unknown>,
): string {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown notification template: ${templateKey}`);
  }

  let rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) {
      return `{{${key}}}`;
    }
    // DateTime-typed keys get timezone-aware formatting
    if (key.endsWith('_time') || key.endsWith('_date')) {
      return formatDateTime(value as Date | string);
    }
    return String(value);
  });

  // Warn on unresolved placeholders — indicates a caller/data bug
  const unresolved = rendered.match(/\{\{\w+\}\}/g);
  if (unresolved) {
    logger.warn('Unresolved notification template placeholders', {
      templateKey,
      unresolved,
    });
  }

  return rendered;
}
