import nodemailer from 'nodemailer';

export const transport = process.env.ETHEREAL_USER && process.env.ETHEREAL_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      port: Number(process.env.ETHEREAL_PORT || 587),
      secure: Number(process.env.ETHEREAL_PORT) === 465,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASSWORD,
      },
    })
  : null;
