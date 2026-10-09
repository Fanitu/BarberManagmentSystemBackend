const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false // Only for development
      }
    };
    
    console.log('📧 Email Configuration:');
    console.log('  Host:', config.host);
    console.log('  Port:', config.port);
    console.log('  User:', config.auth.user);
    console.log('  Pass:', config.auth.pass ? '****' + config.auth.pass.slice(-4) : 'MISSING');
    
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};


const buildInsightsList = (lines) => {
  if (!lines || lines.length === 0) return "";
  return `
    <ul style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#444;">
      ${lines.map((line) => `<li style="margin-bottom:4px;">${line}</li>`).join("")}
    </ul>
  `;
};

const buildNarrativeBlock = (section) => {
  if (section.narrative) {
    return `<p style="margin:10px 0 0; font-size:14px; color:#333; line-height:1.5; font-style:italic;">${section.narrative}</p>`;
  }
  return buildInsightsList(section.insights); // fallback when AI call failed or no key configured
};

const sendAdminInvitationEmail = async (email, shopName, token,shopCode) => {
  const emailTransporter = getTransporter();
  
  if (!emailTransporter) {
    throw new Error('Email service is not configured');
  }

  // Validate from email
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    throw new Error('SMTP_FROM is not set. Please configure your email settings');
  }

  const setupUrl = `${'http://localhost:5174' || 'http://localhost:5174'}/admin-setup/${token}`;
  
  const mailOptions = {
    from: `"MB Barber Management" <${fromEmail}>`,
    to: email,
    subject: `🎉 Welcome to MB Barber Management - Set Up Your Admin Account`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to MB Barber Management</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #ffffff;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .shop-name {
              font-size: 20px;
              font-weight: bold;
              color: #667eea;
              margin: 20px 0;
            }
            .features {
              background-color: #f8f9fa;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .features h3 {
              margin-top: 0;
              color: #495057;
            }
            .feature-item {
              margin: 10px 0;
              padding-left: 20px;
              position: relative;
            }
            .feature-item:before {
              content: "✓";
              position: absolute;
              left: 0;
              color: #28a745;
              font-weight: bold;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 25px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              transition: transform 0.2s;
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(0,0,0,0.15);
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              font-size: 12px;
              color: #6c757d;
            }
            .expiry-note {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              color: #856404;
              padding: 10px;
              border-radius: 5px;
              margin: 15px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Welcome to MB Barber Management</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You've been invited to manage <span class="shop-name">${shopName}</span> with the Barber Code <span class="shop-name">${shopCode}</span> using our professional barber management system.</p>
              
              <div class="features">
                <h3>✨ What You Can Do With Our Platform:</h3>
                <div class="feature-item">Manage Shop effortlessly</div>
                <div class="feature-item">Track each and every Barber performance</div>
                <div class="feature-item">Manage your barber team efficiently</div>
                <div class="feature-item">View real-time analytics and reports</div>
                <div class="feature-item">Reduce no-shows with automated reminders</div>
                <div class="feature-item">Increase revenue with better organization and all time analysis</div>
                <div class="feature-item">Making decision with real time analysis and reports</div>
                <div class="feature-item">And much more!</div>
              </div>

              <p><strong>Ready to get started?</strong></p>
              <p>Click the button below to create your admin account. You'll set your name and password, and you'll be ready to manage your shop in minutes!</p>
              
              <center>
                <a href="${setupUrl}" class="cta-button">
                  🎯 Create Your Admin Account
                </a>
              </center>

              <div class="expiry-note">
                ⏰ <strong>Note:</strong> This invitation link will expire in 7 days for security reasons. If it expires, please request a new invitation from your administrator.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} MB Barber Management. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Invitation email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    
    // Provide specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check your SMTP credentials.');
    } else if (error.code === 'EENVELOPE') {
      throw new Error('Sender email not verified. Please verify your email in your SMTP settings.');
    } else if (error.code === 'ESOCKET') {
      throw new Error('Connection to email server failed. Check your SMTP host and port.');
    } else {
      throw new Error(`Failed to send invitation email: ${error.message}`);
    }
  }
};


const sendChainAdminInvitationEmail = async (email, token) => {
  const emailTransporter = getTransporter();

  if (!emailTransporter) {
    throw new Error('Email service is not configured');
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    throw new Error('SMTP_FROM is not set. Please configure your email settings');
  }

  const setupUrl = `${'http://localhost:5173' || 'http://localhost:5173'}/chainadmin-setup/${token}`;

  const mailOptions = {
    from: `"MB Barber Management" <${fromEmail}>`,
    to: email,
    subject: `🚀 You've Been Invited as a Chain Admin - MB Barber Management`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Chain Admin Invitation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px 20px; }
            .features { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .features h3 { margin-top: 0; color: #495057; }
            .feature-item { margin: 10px 0; padding-left: 20px; position: relative; }
            .feature-item:before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Chain Admin Invitation</h1>
            </div>
           <div class="content">
              <p>Hello,</p>
              <p>You've been invited as a <strong>Chain Admin</strong> on MB Barber Management — a single dashboard to oversee all of your barber shops at once.</p>

              <div class="features">
                <h3>✨ As a Chain Admin, you can:</h3>
                <div class="feature-item">See revenue, top barbers, and jobs across every shop you own</div>
                <div class="feature-item">Create new shops directly under your account</div>
                <div class="feature-item">Compare running costs and monthly expenses shop-by-shop</div>
                <div class="feature-item">Drill into any single shop's full admin view in one click</div>
                <div class="feature-item">Check out all shops progress daily weekly mothly efficiently</div>
                <div class="feature-item">Check which shops are making or losing money</div>
                <div class="feature-item">Know are you getting profite in any period of time</div>
                <div class="feature-item">Get daily, weekly and mothly analysis send to you email or telegram or both</div>
                <div class="feature-item">And much more!</div>
              </div>

              <p><strong>Ready to get started?</strong></p>
              <p>Click below to set your name and password.</p>

              <center>
                <a href="${setupUrl}" class="cta-button">
                  🎯 Set Up Your Chain Admin Account
                </a>
              </center>

              <div class="expiry-note">
                ⏰ <strong>Note:</strong> This invitation link will expire in 7 days for security reasons.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} MB Barber Management. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Chain admin invitation email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending chain admin invitation email:', error);
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check your SMTP credentials.');
    } else if (error.code === 'EENVELOPE') {
      throw new Error('Sender email not verified. Please verify your email in your SMTP settings.');
    } else if (error.code === 'ESOCKET') {
      throw new Error('Connection to email server failed. Check your SMTP host and port.');
    } else {
      throw new Error(`Failed to send chain admin invitation email: ${error.message}`);
    }
  }
};

const formatMoney = (n) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const buildShopTable = (rows, columns) => `
  <table style="width:100%; border-collapse:collapse; font-size:13px; margin:10px 0;">
    <thead>
      <tr style="background:#f3f3f3;">
        ${columns.map((c) => `<th style="text-align:left; padding:6px 8px; border:1px solid #ddd;">${c.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          ${columns.map((c) => `<td style="padding:6px 8px; border:1px solid #ddd;">${c.value(row)}</td>`).join("")}
        </tr>`
        )
        .join("")}
    </tbody>
  </table>
`;

const DAILY_COLUMNS = [
  { label: "Shop", value: (r) => r.name },
  { label: "Revenue", value: (r) => `${formatMoney(r.totalRevenue)} Birr` },
  { label: "Barbers Payment", value: (r) => `${formatMoney(r.barbersPayment)} Birr` },
  { label: "Total Income", value: (r) => `${formatMoney(r.totalIncome)} Birr` },
  { label: "Best Barber", value: (r) => (r.bestBarber ? r.bestBarber.name : "—") },
];

const WEEKLY_COLUMNS = DAILY_COLUMNS; // same shape, different date range

const MONTHLY_COLUMNS = [
  { label: "Shop", value: (r) => r.name },
  { label: "Revenue", value: (r) => `${formatMoney(r.totalRevenue)} Birr` },
  { label: "Barbers Payment", value: (r) => `${formatMoney(r.barbersPayment)} Birr` },
  { label: "Running Cost", value: (r) => `${formatMoney(r.runningCost)} Birr` },
  { label: "Monthly Expense", value: (r) => `${formatMoney(r.monthlyExpense)} Birr` },
  { label: "Net Profit", value: (r) => `${formatMoney(r.netProfit)} Birr` },
];

/**
 * sections: { daily: [...shopEntries], weekly: [...shopEntries]|null, monthly: [...shopEntries]|null }
 * Each shopEntry already carries { name, totalRevenue, barbersPayment, runningCost, totalIncome, bestBarber, monthlyExpense?, netProfit? }
 */
const sendChainDailyAnalysisEmail = async (email, chainAdminName, dateLabel, sections) => {
  const emailTransporter = getTransporter();
  if (!emailTransporter) throw new Error("Email service is not configured");

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) throw new Error("SMTP_FROM is not set. Please configure your email settings");

  const totalDailyRevenue = sections.daily.rows.reduce((sum, r) => sum + r.totalRevenue, 0);

  let html = `
    <div style="font-family: Arial, sans-serif; color:#333; max-width:640px; margin:0 auto;">
      <h2 style="margin-bottom:4px;">Daily Analysis — ${dateLabel}</h2>
      <p>Hi ${chainAdminName},</p>
      <p>Here's how your shops performed today. Total revenue across all shops: <strong>${formatMoney(totalDailyRevenue)} Birr</strong>.</p>
     ${buildShopTable(sections.daily.rows, DAILY_COLUMNS)}
      ${buildNarrativeBlock(sections.daily)}
  `;

  if (sections.weekly) {
    const totalWeeklyRevenue = sections.weekly.rows.reduce((sum, r) => sum + r.totalRevenue, 0);
    html += `
      <h3 style="margin-top:28px;">This Week's Summary</h3>
      <p>Total weekly revenue across all shops: <strong>${formatMoney(totalWeeklyRevenue)} Birr</strong>.</p>
      ${buildShopTable(sections.weekly.rows, WEEKLY_COLUMNS)}
      ${buildNarrativeBlock(sections.weekly)}
    `;
  }

  if (sections.monthly) {
    const totalNetProfit = sections.monthly.rows.reduce((sum, r) => sum + r.netProfit, 0);
    html += `
      <h3 style="margin-top:28px;">This Month's Financial Summary</h3>
      <p>Total net profit across all shops this month: <strong>${formatMoney(totalNetProfit)} Birr</strong>.</p>
      ${buildShopTable(sections.monthly.rows, MONTHLY_COLUMNS)}
      ${buildNarrativeBlock(sections.monthly)}
    `;
  }

  html += `
      <p style="margin-top:28px; font-size:12px; color:#888;">
        You're receiving this because Daily Email Analysis is turned on in your Settings.
        You can turn it off any time from your dashboard.
      </p>
    </div>
  `;

  const mailOptions = {
    from: `"MB Barber Management" <${fromEmail}>`,
    to: email,
    subject: `Daily Analysis — ${dateLabel}`,
    html,
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log("✅ Chain daily analysis email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending chain daily analysis email:", error);
    throw new Error(`Failed to send daily analysis email: ${error.message}`);
  }
};

module.exports = {
  sendAdminInvitationEmail,
  sendChainAdminInvitationEmail,
  sendChainDailyAnalysisEmail
};