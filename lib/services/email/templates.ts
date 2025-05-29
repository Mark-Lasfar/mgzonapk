import { EMAIL_CONFIG } from '@/lib/config/email';

const styles = `
  .email-container { 
    font-family: Arial, sans-serif; 
    max-width: 600px; 
    margin: 0 auto; 
    padding: 20px; 
    background-color: #ffffff;
  }
  .email-header { 
    text-align: center; 
    margin-bottom: 30px;
  }
  .email-code, .email-box {
    background-color: #f4f4f4; 
    padding: 15px; 
    text-align: center; 
    font-size: 24px; 
    letter-spacing: 2px; 
    margin: 20px 0; 
    border-radius: 5px;
  }
  .email-footer { 
    margin-top: 30px; 
    text-align: center; 
    font-size: 12px; 
    color: #666;
  }
  table {
    width: 100%; 
    border-collapse: collapse;
    margin-top: 20px;
  }
  th, td {
    padding: 10px; 
    border: 1px solid #ddd;
    text-align: left;
  }
  th {
    background-color: #f8f9fa;
  }
`;

export const emailTemplates = {
  verification: (name: string, code: string) => ({
    subject: EMAIL_CONFIG.TEMPLATES.VERIFICATION.SUBJECT,
    from: `${EMAIL_CONFIG.TEMPLATES.VERIFICATION.FROM_NAME} <${EMAIL_CONFIG.TEMPLATES.VERIFICATION.FROM_EMAIL}>`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <div class="email-container">
          <div class="email-header"><h1>Email Verification</h1></div>
          <p>Hello ${name},</p>
          <p>Please use this code to verify your email:</p>
          <div class="email-code"><strong>${code}</strong></div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div class="email-footer">
            <p>This is an automated message from MGZon</p>
            <p>&copy; ${new Date().getFullYear()} MGZon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${name},

Please use this code to verify your email:
${code}

This code will expire in 10 minutes.
If you didn't request this code, please ignore this email.

MGZon © ${new Date().getFullYear()}
    `
  }),

  orderConfirmation: (user: { name: string }, order: any) => ({
    subject: EMAIL_CONFIG.TEMPLATES.ORDER_CONFIRMATION.SUBJECT,
    from: `${EMAIL_CONFIG.TEMPLATES.ORDER_CONFIRMATION.FROM_NAME} <${EMAIL_CONFIG.TEMPLATES.ORDER_CONFIRMATION.FROM_EMAIL}>`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <div class="email-container">
          <div class="email-header"><h1>Order Confirmation</h1></div>
          <p>Thanks for your order, ${user.name}!</p>
          <p>Your order <strong>#${order._id}</strong> has been confirmed.</p>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p><strong>Total:</strong> $${order.totalPrice.toFixed(2)}</p>
          <p>Expected Delivery: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}</p>
          <div class="email-footer">
            <p>View your order <a href="${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order._id}">here</a>.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Thanks for your order, ${user.name}!
Order #${order._id}

Items:
${order.items.map((item: any) => `${item.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`).join('\n')}

Total: $${order.totalPrice.toFixed(2)}
Expected Delivery: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}
View: ${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order._id}
    `
  }),

  passwordReset: (name: string, resetToken: string) => ({
    subject: EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET.SUBJECT,
    from: `${EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET.FROM_NAME} <${EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET.FROM_EMAIL}>`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <div class="email-container">
          <div class="email-header"><h1>Password Reset</h1></div>
          <p>Hello ${name},</p>
          <p>Click the link below to reset your password:</p>
          <div class="email-box">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${resetToken}">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
          <div class="email-footer">
            <p>MGZon Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${name},

Click the link to reset your password:
${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${resetToken}

This link will expire in 1 hour.
If you didn't request this, ignore this email.
    `
  }),

  shipmentUpdate: (order: any, status: string, trackingNumber?: string) => ({
    subject: `Order ${status} - MGZon`,
    from: `MGZon Orders <orders@mgzon.com>`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <div class="email-container">
          <div class="email-header"><h1>Shipment Update</h1></div>
          <p>Your order <strong>#${order._id}</strong> has been ${status}.</p>
          ${trackingNumber ? `<p>Tracking Number: <strong>${trackingNumber}</strong></p>` : ''}
          <p>Track your order <a href="${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order._id}">here</a>.</p>
          <div class="email-footer">
            <p>MGZon Shipping</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your order #${order._id} has been ${status}.
${trackingNumber ? `Tracking Number: ${trackingNumber}` : ''}

Track here: ${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order._id}
    `
  }),
};
