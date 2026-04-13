const {
  renderTemplate,
  formatDateTime,
  NOTIFICATION_TEMPLATES,
} = require('/app/dist/services/notification.service');

describe('Notification Service', () => {
  describe('renderTemplate', () => {
    test('booking_reminder renders with event_time and job_title resolved', () => {
      const result = renderTemplate('booking_reminder', {
        job_title: 'Alumni Gala',
        event_time: new Date('2026-05-10T18:00:00Z'),
      });
      expect(result).toContain('Alumni Gala');
      expect(result).toContain('2026');
      // Must NOT contain unresolved placeholders
      expect(result).not.toMatch(/\{\{\w+\}\}/);
    });

    test('booking_reminder with string date for event_time renders correctly', () => {
      const result = renderTemplate('booking_reminder', {
        job_title: 'Reunion Photo',
        event_time: '2026-06-15T10:30:00Z',
      });
      expect(result).not.toMatch(/\{\{\w+\}\}/);
      expect(result).toContain('Reunion Photo');
      expect(result).toContain('2026');
    });

    test('booking_confirmation also uses event_time consistently', () => {
      const result = renderTemplate('booking_confirmation', {
        job_title: 'Headshots Session',
        event_time: new Date('2026-07-01T09:00:00Z'),
      });
      expect(result).not.toMatch(/\{\{\w+\}\}/);
      expect(result).toContain('Headshots Session');
    });

    test('missing data leaves placeholder unresolved (caller bug)', () => {
      const result = renderTemplate('booking_reminder', {
        job_title: 'Some Event',
        // event_time intentionally omitted
      });
      // Should still contain unresolved {{event_time}}
      expect(result).toMatch(/\{\{event_time\}\}/);
    });

    test('unknown template key throws', () => {
      expect(() => renderTemplate('nonexistent_template', {})).toThrow(
        /unknown notification template/i
      );
    });

    test('template uses event_time not starts_at', () => {
      // This test codifies the H-03 fix: the contract is event_time everywhere
      const template = NOTIFICATION_TEMPLATES.booking_reminder;
      expect(template).toContain('{{event_time}}');
      expect(template).not.toContain('{{starts_at}}');
    });
  });

  describe('formatDateTime', () => {
    test('formats a Date object to human-readable string', () => {
      const result = formatDateTime(new Date('2026-05-10T18:00:00Z'));
      expect(result).toContain('2026');
      // Should contain time component
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    test('formats an ISO string to human-readable string', () => {
      const result = formatDateTime('2026-12-25T14:30:00Z');
      expect(result).toContain('2026');
    });

    test('invalid date returns the raw string', () => {
      const result = formatDateTime('not-a-date');
      expect(result).toBe('not-a-date');
    });
  });
});
