import nodemailer from 'nodemailer';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // use SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || params.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Template for new candidate application
  async sendNewApplicationNotification(
    recipientEmail: string, 
    recipientName: string,
    candidateName: string, 
    jobTitle: string,
    companyName: string
  ): Promise<boolean> {
    const subject = `New Application: ${candidateName} applied for ${jobTitle}`;
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">New Job Application</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">RecruitFlow Notification</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello ${recipientName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! A new candidate has applied for a position at ${companyName}.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #667eea;">Application Details</h3>
                <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidateName}</p>
                <p style="margin: 5px 0;"><strong>Position:</strong> ${jobTitle}</p>
                <p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>
              </div>
              
              <p style="font-size: 16px; margin: 20px 0;">
                Log in to your RecruitFlow dashboard to review the application and start the evaluation process.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Review Application
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                This is an automated notification from RecruitFlow. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Template for candidate status change
  async sendStatusChangeNotification(
    recipientEmail: string,
    recipientName: string,
    candidateName: string,
    jobTitle: string,
    oldStatus: string,
    newStatus: string,
    companyName: string
  ): Promise<boolean> {
    const subject = `Status Update: ${candidateName} - ${jobTitle}`;
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Candidate Status Update</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">RecruitFlow Notification</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello ${recipientName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                There's been a status update for a candidate in your recruitment pipeline.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #667eea;">Status Change Details</h3>
                <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidateName}</p>
                <p style="margin: 5px 0;"><strong>Position:</strong> ${jobTitle}</p>
                <p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>
                <p style="margin: 5px 0;"><strong>Previous Status:</strong> <span style="color: #666;">${oldStatus}</span></p>
                <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="color: #28a745; font-weight: bold;">${newStatus}</span></p>
              </div>
              
              <p style="font-size: 16px; margin: 20px 0;">
                Log in to your RecruitFlow dashboard to view the candidate details and take further action.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  View Candidate
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                This is an automated notification from RecruitFlow. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: recipientEmail, subject, html });
  }

  // Template for @mention in comments
  async sendMentionNotification(
    recipientEmail: string,
    recipientName: string,
    mentionedByName: string,
    candidateName: string,
    commentText: string,
    companyName: string
  ): Promise<boolean> {
    const subject = `You were mentioned in a comment about ${candidateName}`;
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">You Were Mentioned</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">RecruitFlow Notification</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello ${recipientName},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${mentionedByName} mentioned you in a comment about candidate ${candidateName}.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #667eea;">Comment Details</h3>
                <p style="margin: 5px 0;"><strong>Mentioned by:</strong> ${mentionedByName}</p>
                <p style="margin: 5px 0;"><strong>Candidate:</strong> ${candidateName}</p>
                <p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>
                <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;">
                  <p style="margin: 0; font-style: italic;">"${commentText}"</p>
                </div>
              </div>
              
              <p style="font-size: 16px; margin: 20px 0;">
                Click below to view the full conversation and respond.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  View Comment
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                This is an automated notification from RecruitFlow. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: recipientEmail, subject, html });
  }
}

export const emailService = new EmailService();