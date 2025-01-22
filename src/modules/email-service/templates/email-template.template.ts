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
  <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="background-color: #ffffff; font-family: 'Roboto', sans-serif !important; width: 640px; margin: auto; position: relative;">
  <table style="padding-left: 0px; width:576px;">
    <tr>
      <td style="padding: 40px 32px;">
        <img style="max-width: 134px; width: 100%;" src="https://i.ibb.co.com/BgFvW6n/image-2-1.jpg"/>
      </td>
    </tr>
  </table>
  <table style="background-color: #F8F9FB; width: 576px; margin: 32px; padding: 32px; border-radius: 8px">
    <tr>
      <td colspan="5" style="font-weight: bold; padding-bottom: 20px; font-size: 20px;color:#121A26;">Hello ${userName},</td>
    </tr>
    <tr>
      <td colspan="5" style="font-weight: bold; padding-bottom: 20px; font-size: 20px;color:#121A26;">Verify Your Email Address</td>
    </tr>
    <tr>
      <td colspan="5" style="padding-bottom: 24px;color:#384860;">
        Please use the following One-Time Password (OTP) to verify your email address. This code is valid for 2 minutes.
      </td>
    </tr>
    <tr>
      <td colspan="5" style="font-size: 24px; font-weight: bold; padding-bottom: 24px; color: #2969FF; text-align: center;">
        ${otpCode}
      </td>
    </tr>
    <tr>
      <td colspan="5" style="padding-bottom: 24px;color:#384860;">
        If you did not request this verification, please ignore this email.
      </td>
    </tr>
    <tr>
      <td colspan="5" style="padding-bottom: 0px;color:#384860;">
        Thank you,
      </td>
    </tr>
    <tr>
      <td colspan="5" style="padding-bottom: 20px;color:#384860;">
        The Ops4Team
      </td>
    </tr>
  </table>
  <table style="width: 576px; padding:0px 32px;">
    <tr>
      <td colspan="5" style="padding-bottom: 20px; font-size: 14px; color:#858C95;">Questions or FAQ? Contact us at <a style="color:#0C66E4; text-decoration:none;" href="mailto:support@ops4team.com">support@ops4team.ai</a>. For more information about Ops4Team, visit <a style="color:#0C66E4; text-decoration:none;" href="https://www.ops4team.ai">www.ops4team.ai</a>.</td>
    </tr>
    <tr>
      <td colspan="5" style="padding-bottom: 24px; font-size:14px; color:#858C95;">© 2025 Ops4Team.</td>
    </tr>
  </table>
</body>
</html>
`;
  }
}
