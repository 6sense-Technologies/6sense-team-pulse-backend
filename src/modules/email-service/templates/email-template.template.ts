export class EmailTemplate {
  static userVerificationOTPEmailTemplate(
    userName: string,
    otpCode: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Roboto', sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 640px; margin: 0 auto; padding: 16px;">
    <!-- Logo Section -->
    <div style="text-align: left; margin-bottom: 16px;">
      <img src="https://i.ibb.co.com/BgFvW6n/image-2-1.jpg" alt="Ops4Team Logo" style="max-width: 100px; height: auto;">
    </div>

    <!-- Card Section -->
    <div style="background-color: #F8F9FB; padding: 24px; border-radius: 8px; box-sizing: border-box;">
      <h1 style="font-size: 20px; font-weight: bold; color: #121A26; margin: 0 0 16px;">Hello ${userName},</h1>
      <h1 style="font-size: 20px; font-weight: bold; color: #121A26; margin: 0 0 16px;">Verify Your Email Address</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #384860; margin: 0 0 16px;">
        Please use the following One-Time Password (OTP) to verify your email address. This code is valid for 2 minutes.
      </p>
      <div style="font-size: 24px; font-weight: bold; color: #2969FF; text-align: center; margin: 24px 0;">
        ${otpCode}
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #384860; margin: 0 0 16px;">
        If you did not request this verification, please ignore this email.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #384860; margin: 0;">
        Thank you,<br>The Ops4Team
      </p>
    </div>

    <!-- Footer Section -->
    <div style="font-size: 14px; color: #858C95; text-align: left; margin-top: 24px;">
      <p style="margin: 8px 0;">
        Questions or FAQ? Contact us at 
        <a href="mailto:support@ops4team.com" style="color: #0C66E4; text-decoration: none;">support@ops4team.ai</a>. 
        For more information about Ops4Team, visit 
        <a href="https://www.ops4team.ai" style="color: #0C66E4; text-decoration: none;">www.ops4team.ai</a>.
      </p>
      <p style="margin: 8px 0;">© 2025 Ops4Team.</p>
    </div>
  </div>
</body>
</html>
`;
  }
}
