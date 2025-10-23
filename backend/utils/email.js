const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_AUTH_USER,
    pass: process.env.GMAIL_AUTH_PWD,
  },
});

const sendBillByEmail = async (toEmail, orderId, cartGrandTotal, receiptPath) => {
  const mailOptions = {
    from: process.env.GMAIL_AUTH_USER,
    to: toEmail,
    subject: `Your POS System Bill - Order ID: ${orderId}`,
    html: `
      <p>Dear Customer,</p>
      <p>Thank you for your order! Here are your bill details:</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total Amount:</strong> ₹ ${cartGrandTotal.toFixed(2)}</p>
      <p>You can download your receipt <a href="${receiptPath}">here</a>.</p>
      <p>Regards,</p>
      <p>Your POS Team</p>
    `,
     attachments: [
       {
         filename: `receipt_${orderId}.pdf`,
         path: receiptPath, // This path needs to be accessible from the backend server
         contentType: 'application/pdf'
       }
     ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    return { success: true, message: 'Email sent successfully.' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: 'Failed to send email.', error: error.message };
  }
};

module.exports = { sendBillByEmail };
