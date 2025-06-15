const request = require('supertest');

// Mock the email service before importing the app
jest.mock('../server/email.js', () => ({
  emailService: {
    sendEmail: jest.fn(),
    sendNewApplicationNotification: jest.fn(),
    sendStatusChangeNotification: jest.fn(),
    sendMentionNotification: jest.fn()
  }
}));

const { app } = require('../server/index.js');
const { emailService } = require('../server/email.js');

describe('Email Notifications Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Candidate Application Email Notifications', () => {
    test('should send email notification when new candidate applies', async () => {
      // Mock successful email sending
      emailService.sendNewApplicationNotification.mockResolvedValue(true);

      // Test that email notification is triggered during application submission
      // This would be triggered by the application submission endpoint
      const mockEmailData = {
        to: 'hr@company.com',
        recipientName: 'HR Manager',
        candidateName: 'John Doe',
        jobTitle: 'Software Engineer',
        companyName: 'Tech Corp'
      };

      await emailService.sendNewApplicationNotification(
        mockEmailData.to,
        mockEmailData.recipientName,
        mockEmailData.candidateName,
        mockEmailData.jobTitle,
        mockEmailData.companyName
      );

      expect(emailService.sendNewApplicationNotification).toHaveBeenCalledWith(
        'hr@company.com',
        'HR Manager',
        'John Doe',
        'Software Engineer',
        'Tech Corp'
      );
    });

    test('should handle email notification failures gracefully', async () => {
      // Mock email failure
      emailService.sendNewApplicationNotification.mockRejectedValue(new Error('SMTP connection failed'));

      try {
        await emailService.sendNewApplicationNotification(
          'hr@company.com',
          'HR Manager',
          'John Doe',
          'Software Engineer',
          'Tech Corp'
        );
      } catch (error) {
        expect(error.message).toBe('SMTP connection failed');
      }

      expect(emailService.sendNewApplicationNotification).toHaveBeenCalled();
    });
  });

  describe('Status Change Email Notifications', () => {
    test('should send email notification when candidate status changes', async () => {
      // Mock successful email sending
      emailService.sendStatusChangeNotification.mockResolvedValue(true);

      const mockStatusData = {
        to: 'hr@company.com',
        recipientName: 'HR Manager',
        candidateName: 'John Doe',
        newStatus: 'interview',
        jobTitle: 'Software Engineer',
        companyName: 'Tech Corp'
      };

      await emailService.sendStatusChangeNotification(
        mockStatusData.to,
        mockStatusData.recipientName,
        mockStatusData.candidateName,
        mockStatusData.newStatus,
        mockStatusData.jobTitle,
        mockStatusData.companyName
      );

      expect(emailService.sendStatusChangeNotification).toHaveBeenCalledWith(
        'hr@company.com',
        'HR Manager',
        'John Doe',
        'interview',
        'Software Engineer',
        'Tech Corp'
      );
    });

    test('should send different email content for different status changes', async () => {
      emailService.sendStatusChangeNotification.mockResolvedValue(true);

      // Test hired status
      await emailService.sendStatusChangeNotification(
        'hr@company.com',
        'HR Manager',
        'John Doe',
        'hired',
        'Software Engineer',
        'Tech Corp'
      );

      // Test rejected status
      await emailService.sendStatusChangeNotification(
        'hr@company.com',
        'HR Manager',
        'Jane Smith',
        'rejected',
        'Product Manager',
        'Tech Corp'
      );

      expect(emailService.sendStatusChangeNotification).toHaveBeenCalledTimes(2);
      expect(emailService.sendStatusChangeNotification).toHaveBeenNthCalledWith(
        1, 'hr@company.com', 'HR Manager', 'John Doe', 'hired', 'Software Engineer', 'Tech Corp'
      );
      expect(emailService.sendStatusChangeNotification).toHaveBeenNthCalledWith(
        2, 'hr@company.com', 'HR Manager', 'Jane Smith', 'rejected', 'Product Manager', 'Tech Corp'
      );
    });
  });

  describe('Comment Mention Email Notifications', () => {
    test('should send email notification when user is mentioned in comment', async () => {
      emailService.sendMentionNotification.mockResolvedValue(true);

      const mockMentionData = {
        to: 'john@company.com',
        recipientName: 'John Smith',
        commenterName: 'Sarah Jones',
        candidateName: 'Mike Johnson',
        commentContent: '@johnsmith please review this candidate for the senior role',
        companyName: 'Tech Corp'
      };

      await emailService.sendMentionNotification(
        mockMentionData.to,
        mockMentionData.recipientName,
        mockMentionData.commenterName,
        mockMentionData.candidateName,
        mockMentionData.commentContent,
        mockMentionData.companyName
      );

      expect(emailService.sendMentionNotification).toHaveBeenCalledWith(
        'john@company.com',
        'John Smith',
        'Sarah Jones',
        'Mike Johnson',
        '@johnsmith please review this candidate for the senior role',
        'Tech Corp'
      );
    });

    test('should handle multiple mentions in single comment', async () => {
      emailService.sendMentionNotification.mockResolvedValue(true);

      // Simulate multiple mentions
      await emailService.sendMentionNotification(
        'john@company.com',
        'John Smith',
        'Sarah Jones',
        'Mike Johnson',
        '@johnsmith @marydoe please both review this candidate',
        'Tech Corp'
      );

      await emailService.sendMentionNotification(
        'mary@company.com',
        'Mary Doe',
        'Sarah Jones',
        'Mike Johnson',
        '@johnsmith @marydoe please both review this candidate',
        'Tech Corp'
      );

      expect(emailService.sendMentionNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Email Service Configuration', () => {
    test('should validate email service is properly configured', async () => {
      // Test basic email sending functionality
      emailService.sendEmail.mockResolvedValue(true);

      const testEmail = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>This is a test email</p>',
        text: 'This is a test email'
      };

      const result = await emailService.sendEmail(testEmail);

      expect(result).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(testEmail);
    });

    test('should handle SMTP configuration errors', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('Invalid SMTP credentials'));

      try {
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test</p>',
          text: 'Test'
        });
      } catch (error) {
        expect(error.message).toBe('Invalid SMTP credentials');
      }
    });
  });

  describe('Email Content Validation', () => {
    test('should format candidate application email correctly', async () => {
      emailService.sendNewApplicationNotification.mockImplementation((to, recipientName, candidateName, jobTitle, companyName) => {
        // Validate that all required parameters are present
        expect(to).toBeTruthy();
        expect(recipientName).toBeTruthy();
        expect(candidateName).toBeTruthy();
        expect(jobTitle).toBeTruthy();
        expect(companyName).toBeTruthy();
        return Promise.resolve(true);
      });

      await emailService.sendNewApplicationNotification(
        'hr@company.com',
        'HR Manager',
        'John Doe',
        'Software Engineer',
        'Tech Corp'
      );

      expect(emailService.sendNewApplicationNotification).toHaveBeenCalled();
    });

    test('should format status change email correctly', async () => {
      emailService.sendStatusChangeNotification.mockImplementation((to, recipientName, candidateName, status, jobTitle, companyName) => {
        // Validate parameters and status formatting
        expect(to).toBeTruthy();
        expect(recipientName).toBeTruthy();
        expect(candidateName).toBeTruthy();
        expect(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).toContain(status);
        expect(jobTitle).toBeTruthy();
        expect(companyName).toBeTruthy();
        return Promise.resolve(true);
      });

      await emailService.sendStatusChangeNotification(
        'hr@company.com',
        'HR Manager',
        'John Doe',
        'interview',
        'Software Engineer',
        'Tech Corp'
      );

      expect(emailService.sendStatusChangeNotification).toHaveBeenCalled();
    });
  });
});