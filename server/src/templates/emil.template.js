export const getEmailTemplate = ({
  subject,
  description,
  leadName,
  feature1Image,
  feature2Image,
  bannerImage,
  trackingPixelUrl,
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
  <!-- styles remain unchanged -->
</head>
<body style="background-color: #f4f4f4; margin: 0; padding: 0;">
  <div style="padding: 20px 0;">
    <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />
    <table style="max-width: 600px; margin: auto; background-color: white; border-radius: 8px;">
      <tr>
        <td style="text-align: center; padding: 25px 30px; border-bottom: 1px solid #eee;">
          <img src="https://via.placeholder.com/150x40/007bff/ffffff?text=YourLogo" alt="Logo" width="150" height="40" />
        </td>
      </tr>

      <tr>
        <td>
          <img src="${bannerImage}" alt="Banner" width="600" height="250" style="width: 100%; max-width: 600px;" />
        </td>
      </tr>

      <tr>
        <td style="padding: 30px; background-color: #f8fafd; text-align: center;">
          <h1 style="margin-bottom: 15px;">${subject}</h1>
          <p style="margin-bottom: 25px;">${description}</p>
        </td>
      </tr>

      <tr>
        <td style="padding: 30px;">
          <h2>Hi ${leadName || "there"},</h2>
          <p>At Acme Corp, we provide innovative solutions designed to help you grow.</p>
          <ul>
            <li><strong>Enhanced Visibility:</strong> Real-time overview of your operations.</li>
            <li><strong>Optimized Resources:</strong> Improve efficiency with smart forecasting.</li>
            <li><strong>Insights:</strong> Make data-driven decisions quickly.</li>
          </ul>
        </td>
      </tr>

      <tr>
        <td style="padding: 10px 30px 30px;">
          <table width="100%">
            <tr>
              <td width="50%" style="padding-right: 10px;">
                <img src="${feature1Image}" width="100%" style="border-radius: 5px;" />
                <h3>Seamless Integration</h3>
                <p>Integrate with your systems for unified data flow.</p>
              </td>
              <td width="50%" style="padding-left: 10px;">
                <img src="${feature2Image}" width="100%" style="border-radius: 5px;" />
                <h3>Dedicated Support</h3>
                <p>We're always here to support your growth.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding: 30px; text-align: center; background-color: #f8fafd;">
          <h2>Ready to elevate your business?</h2>
          <a href="https://yourwebsite.com/demo" style="padding: 14px 28px; background-color: #007bff; color: white; border-radius: 5px; text-decoration: none;">
            Schedule Your Free Demo
          </a>
        </td>
      </tr>

      <tr>
        <td style="padding: 25px 30px; background-color: #333; color: #ccc; text-align: center;">
          <p>Acme Corp<br/>123 Business Lane, City, ST</p>
          <p>&copy; 2025 Acme Corp. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
