// config/emailConfig.js
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter with Gmail credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS         // Replace with your email password or app-specific password
  },
});

// Function to send the signup email with credentials
const sendSignupEmail = (userEmail, userCredentials) => {
  const mailOptions = {
    from: 'carineumbereye7@gmail.com',
    to: userEmail, // User email from the signup form
    subject: 'Signup Successful - Your Credentials',
    text: `
      Hi there,

      Welcome! You've successfully signed up.

      Here are your credentials:

      Username: ${userCredentials.username}
      Password: ${userCredentials.password}

      Please keep this information safe.

      Best regards,
      Your Company
    `,
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email: ', error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

module.exports = { sendSignupEmail };
